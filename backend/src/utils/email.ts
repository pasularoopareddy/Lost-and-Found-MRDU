import nodemailer from "nodemailer";

export const sendOtpEmail = async (email: string, code: string, purpose: "registration" | "password reset") => {
  const subject = `CampusFind ${purpose} code`;
  const text = `Your CampusFind ${purpose} code is ${code}. It expires in 10 minutes. Do not share this code.`;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (process.env.NODE_ENV === "production") throw new Error("Email service is not configured");
    console.log(`[Development only] ${email}: ${text}`);
    return;
  }
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === "true", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await transporter.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to: email, subject, text });
};
