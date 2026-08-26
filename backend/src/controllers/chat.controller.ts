import type { Request, Response } from "express";
import { ChatRequestStatus } from "../../generated/prisma-chat/enums.js";
import prisma from "../utils/prisma.js";

const chatInclude = {
  report: { select: { id: true, itemName: true, imageUrl: true } },
  requester: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
} as const;

const requestId = (req: Request) => typeof req.params.id === "string" ? req.params.id : undefined;

export const requestChat = async (req: Request, res: Response) => {
  const reportId = requestId(req);
  if (!reportId) return res.status(400).json({ success: false, message: "Report id is required" });
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return res.status(404).json({ success: false, message: "Report not found" });
  if (report.userId === req.auth!.userId) return res.status(400).json({ success: false, message: "You cannot request a chat on your own report" });

  const chatRequest = await prisma.chatRequest.upsert({
    where: { reportId_requesterId: { reportId, requesterId: req.auth!.userId } },
    update: { status: ChatRequestStatus.PENDING },
    create: { reportId, requesterId: req.auth!.userId, ownerId: report.userId },
    include: chatInclude,
  });
  return res.status(201).json({ success: true, message: "Chat request sent to the report owner", chatRequest });
};

export const listChatRequests = async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const [received, sent] = await Promise.all([
    prisma.chatRequest.findMany({ where: { ownerId: userId }, include: chatInclude, orderBy: { updatedAt: "desc" } }),
    prisma.chatRequest.findMany({ where: { requesterId: userId }, include: chatInclude, orderBy: { updatedAt: "desc" } }),
  ]);
  return res.json({ success: true, received, sent });
};

export const respondToChatRequest = async (req: Request, res: Response) => {
  const id = requestId(req);
  const action = req.body.action;
  if (!id || (action !== "accept" && action !== "decline")) return res.status(400).json({ success: false, message: "Choose accept or decline" });
  const chatRequest = await prisma.chatRequest.findFirst({ where: { id, ownerId: req.auth!.userId }, include: chatInclude });
  if (!chatRequest) return res.status(404).json({ success: false, message: "Chat request not found" });
  if (chatRequest.status !== ChatRequestStatus.PENDING) return res.status(409).json({ success: false, message: "This chat request has already been handled" });
  const updated = await prisma.chatRequest.update({
    where: { id }, data: { status: action === "accept" ? ChatRequestStatus.ACCEPTED : ChatRequestStatus.DECLINED }, include: chatInclude,
  });
  return res.json({ success: true, message: action === "accept" ? "Chat request accepted" : "Chat request declined", chatRequest: updated });
};

const accessibleChat = (id: string, userId: string) => prisma.chatRequest.findFirst({
  where: { id, status: ChatRequestStatus.ACCEPTED, OR: [{ ownerId: userId }, { requesterId: userId }] }, include: chatInclude,
});

export const getMessages = async (req: Request, res: Response) => {
  const id = requestId(req);
  if (!id) return res.status(400).json({ success: false, message: "Chat id is required" });
  const chatRequest = await accessibleChat(id, req.auth!.userId);
  if (!chatRequest) return res.status(403).json({ success: false, message: "This private chat is not available" });
  const messages = await prisma.chatMessage.findMany({ where: { chatRequestId: id }, include: { sender: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } });
  return res.json({ success: true, chatRequest, messages });
};

export const sendMessage = async (req: Request, res: Response) => {
  const id = requestId(req);
  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
  if (!id || !content) return res.status(400).json({ success: false, message: "A message is required" });
  if (content.length > 1_000) return res.status(400).json({ success: false, message: "Messages must be 1,000 characters or less" });
  const chatRequest = await accessibleChat(id, req.auth!.userId);
  if (!chatRequest) return res.status(403).json({ success: false, message: "This private chat is not available" });
  const message = await prisma.chatMessage.create({ data: { chatRequestId: id, senderId: req.auth!.userId, content }, include: { sender: { select: { id: true, name: true } } } });
  return res.status(201).json({ success: true, message });
};
