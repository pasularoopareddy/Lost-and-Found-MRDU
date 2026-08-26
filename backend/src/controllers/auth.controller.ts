import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/prisma.js";
import { generateToken } from "../utils/jwt.js";
import { VerificationPurpose } from "../../generated/prisma-chat/enums.js";
import { sendOtpEmail } from "../utils/email.js";

const session = (user: { id: string; name: string; email: string; studentId: string; department: string; year: number }) => ({ token: generateToken(user.id), user: { id: user.id, name: user.name, email: user.email, studentId: user.studentId, department: user.department, year: user.year } });
const code = () => String(Math.floor(100000 + Math.random() * 900000));
const emailOf = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const createCode = async (email: string, purpose: VerificationPurpose, payload?: object, userId?: string) => { const value = code(); await prisma.verificationCode.deleteMany({ where: { email, purpose } }); await prisma.verificationCode.create({ data: { email, purpose, codeHash: await bcrypt.hash(value, 10), payload, userId, expiresAt: new Date(Date.now() + 600000) } }); await sendOtpEmail(email, value, purpose === VerificationPurpose.REGISTER ? "registration" : "password reset"); };

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, studentId, department, year, password } = req.body;
    const normalizedEmail = emailOf(email);
    const normalizedStudentId = typeof studentId === "string" ? studentId.trim() : "";
    if (![name, normalizedEmail, normalizedStudentId, department, year, password].every(Boolean)) return res.status(400).json({ success: false, message: "All fields are required" });
    const existing = await prisma.user.findFirst({ where: { OR: [{ email: normalizedEmail }, { studentId: normalizedStudentId }] } });
    if (existing) return res.status(409).json({ success: false, message: "Email or Student ID already exists" });
    await createCode(normalizedEmail, VerificationPurpose.REGISTER, { name, studentId: normalizedStudentId, department, year: Number(year), password: await bcrypt.hash(password, 10) });
    return res.json({ success: true, message: "Verification code sent to your email." });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Something went wrong" }); }
};

export const login = async (req: Request, res: Response) => {
  try {
    const email = emailOf(req.body.email);
    const password = req.body.password;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || typeof password !== "string" || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: "Invalid email or password" });
    return res.json({ success: true, message: "Login successful", ...session(user) });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Unable to log in" }); }
};

export const verifyRegistration = async (req: Request, res: Response) => { const email = emailOf(req.body.email); const record = await prisma.verificationCode.findFirst({ where: { email, purpose: VerificationPurpose.REGISTER }, orderBy: { createdAt: "desc" } }); if (!record || record.expiresAt < new Date() || typeof req.body.code !== "string" || !(await bcrypt.compare(req.body.code, record.codeHash))) return res.status(400).json({ success: false, message: "Invalid or expired OTP." }); const data = record.payload as { name: string; studentId: string; department: string; year: number; password: string }; try { const user = await prisma.user.create({ data: { ...data, email, emailVerifiedAt: new Date() } }); await prisma.verificationCode.delete({ where: { id: record.id } }); return res.status(201).json({ success: true, message: "Email verified.", ...session(user) }); } catch { return res.status(409).json({ success: false, message: "Email or Student ID already exists." }); } };
export const forgotPassword = async (req: Request, res: Response) => { const email = emailOf(req.body.email); const user = await prisma.user.findUnique({ where: { email } }); if (user) await createCode(email, VerificationPurpose.RESET_PASSWORD, undefined, user.id); return res.json({ success: true, message: "If the account exists, an OTP has been sent." }); };
export const resetPassword = async (req: Request, res: Response) => { const email = emailOf(req.body.email); const { code, password } = req.body; const record = await prisma.verificationCode.findFirst({ where: { email, purpose: VerificationPurpose.RESET_PASSWORD }, orderBy: { createdAt: "desc" } }); if (!record || record.expiresAt < new Date() || typeof code !== "string" || typeof password !== "string" || password.length < 6 || !(await bcrypt.compare(code, record.codeHash))) return res.status(400).json({ success: false, message: "Invalid OTP or password." }); await prisma.user.update({ where: { id: record.userId! }, data: { password: await bcrypt.hash(password, 10) } }); await prisma.verificationCode.delete({ where: { id: record.id } }); return res.json({ success: true, message: "Password reset successful." }); };
