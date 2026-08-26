import type { Request, Response } from "express";
import { ReportStatus, ReportType } from "../../generated/prisma-chat/enums.js";
import prisma from "../utils/prisma.js";
import { distanceInMetres, getCoverageZone } from "../utils/location.js";

const include = { location: true, user: { select: { id: true, name: true, department: true } } } as const;
const isReportType = (value: unknown): value is ReportType =>
  typeof value === "string" && Object.values(ReportType).includes(value as ReportType);

const validImage = (value: unknown) => typeof value === "string" && value.startsWith("data:image/") && value.length <= 4_000_000;

const parseLocation = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const location = value as Record<string, unknown>;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const stringField = (field: string) => typeof location[field] === "string" && location[field].trim() ? location[field].trim() : null;
  return { latitude, longitude, building: stringField("building"), floor: stringField("floor"), room: stringField("room") };
};

export const createReport = async (req: Request, res: Response) => {
  try {
    const { itemName, category, description, imageUrl, reportType, date, reward } = req.body;
    const location = parseLocation(req.body.location);
    const reportDate = new Date(date);
    if (![itemName, category, description].every((item) => typeof item === "string" && item.trim()) || !isReportType(reportType) || !location || Number.isNaN(reportDate.getTime())) {
      return res.status(400).json({ success: false, message: "Provide item details, a valid report type, date, and map location." });
    }
    if (imageUrl && !validImage(imageUrl)) return res.status(400).json({ success: false, message: "Upload a valid image smaller than 3 MB." });
    const coverage = getCoverageZone(location.latitude, location.longitude);
    if (!coverage.zone) return res.status(422).json({ success: false, message: "This location is outside the CampusFind coverage area. Please select a location within the campus or nearby campus zone." });
    const report = await prisma.report.create({ data: {
      itemName: itemName.trim(), category: category.trim(), description: description.trim(), reportType, date: reportDate,
      imageUrl: validImage(imageUrl) ? imageUrl : null,
      reward: typeof reward === "string" && reward.trim() ? reward.trim() : null,
      userId: req.auth!.userId, location: { create: { ...location, zone: coverage.zone } },
    }, include });
    return res.status(201).json({ success: true, message: "Report created successfully", report });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Unable to create report" }); }
};

export const listReports = async (req: Request, res: Response) => {
  try {
    const { search, category, type, status, zone } = req.query;
    const reports = await prisma.report.findMany({ where: {
      ...(typeof category === "string" ? { category: { equals: category, mode: "insensitive" } } : {}),
      ...(isReportType(type) ? { reportType: type } : {}),
      ...(status === ReportStatus.ACTIVE || status === ReportStatus.RECOVERED ? { status } : {}),
      ...(typeof zone === "string" ? { location: { is: { zone } } } : {}),
      ...(typeof search === "string" && search.trim() ? { OR: [{ itemName: { contains: search.trim(), mode: "insensitive" } }, { description: { contains: search.trim(), mode: "insensitive" } }] } : {}),
    }, include, orderBy: { createdAt: "desc" } });
    return res.json({ success: true, reports });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Unable to fetch reports" }); }
};

export const getReport = async (req: Request, res: Response) => {
  const id = typeof req.params.id === "string" ? req.params.id : undefined;
  if (!id) return res.status(400).json({ success: false, message: "Report id is required" });
  const report = await prisma.report.findUnique({ where: { id }, include });
  return report ? res.json({ success: true, report }) : res.status(404).json({ success: false, message: "Report not found" });
};

export const getMyReports = async (req: Request, res: Response) => {
  const reports = await prisma.report.findMany({ where: { userId: req.auth!.userId }, include, orderBy: { createdAt: "desc" } });
  return res.json({ success: true, reports });
};

const keywords = (value: string) => new Set(
  value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2),
);

const matchingKeywords = (first: string, second: string) => {
  const secondWords = keywords(second);
  return [...keywords(first)].filter((word) => secondWords.has(word));
};

const compatibleTypes = (first: ReportType, second: ReportType) =>
  first !== second && (first === ReportType.LOST || second === ReportType.LOST);

export const getPossibleMatches = async (req: Request, res: Response) => {
  try {
    const reports = await prisma.report.findMany({
      where: { status: ReportStatus.ACTIVE },
      include,
      orderBy: { createdAt: "desc" },
    });
    const mine = reports.filter((report) => report.userId === req.auth!.userId);
    const matches = mine.flatMap((source) => reports.flatMap((candidate) => {
      if (candidate.userId === source.userId || !source.location || !candidate.location || !compatibleTypes(source.reportType, candidate.reportType)) return [];

      const sharedWords = matchingKeywords(
        `${source.itemName} ${source.category} ${source.description}`,
        `${candidate.itemName} ${candidate.category} ${candidate.description}`,
      );
      const sameCategory = source.category.toLowerCase() === candidate.category.toLowerCase();
      const daysApart = Math.abs(source.date.getTime() - candidate.date.getTime()) / 86_400_000;
      const distance = distanceInMetres(source.location.latitude, source.location.longitude, candidate.location.latitude, candidate.location.longitude);
      if ((!sameCategory && sharedWords.length === 0) || daysApart > 14 || distance > 2_500) return [];

      const score = (sameCategory ? 45 : 0) + Math.min(sharedWords.length * 15, 30) + (daysApart <= 2 ? 15 : 5) + (distance <= 500 ? 10 : 5);
      const reasons = [
        sameCategory ? "same category" : null,
        sharedWords.length ? `matching words: ${sharedWords.slice(0, 3).join(", ")}` : null,
        distance <= 500 ? "nearby location" : "within the campus area",
        daysApart <= 2 ? "reported around the same time" : null,
      ].filter((reason): reason is string => Boolean(reason));
      return [{ source, report: candidate, score, reasons, distance: Math.round(distance) }];
    }));
    matches.sort((first, second) => second.score - first.score);
    return res.json({ success: true, matches });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Unable to find possible matches" });
  }
};

export const markRecovered = async (req: Request, res: Response) => {
  const id = typeof req.params.id === "string" ? req.params.id : undefined;
  if (!id) return res.status(400).json({ success: false, message: "Report id is required" });
  const report = await prisma.report.findFirst({ where: { id, userId: req.auth!.userId } });
  if (!report) return res.status(404).json({ success: false, message: "Report not found" });
  const updated = await prisma.report.update({ where: { id: report.id }, data: { status: ReportStatus.RECOVERED }, include });
  return res.json({ success: true, message: "Report marked as recovered", report: updated });
};
