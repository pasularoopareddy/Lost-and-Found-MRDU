import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOtpEmail = async (
  email: string,
  code: string,
  purpose: "registration" | "password reset" = "registration"
) => {
  const subject = `CampusFind ${purpose} code`;

  const text = `Your CampusFind ${purpose} code is ${code}. It expires in 10 minutes. Do not share this code.`;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { data, error } = await resend.emails.send({
    from: "CampusFind <onboarding@resend.dev>",
    to: [email],
    subject,
    text,
  });

  if (error) {
    console.error("Resend email error:", error);
    throw new Error("Failed to send verification email");
  }

  console.log("Email sent:", data?.id);
};