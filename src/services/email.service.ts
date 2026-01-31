import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  secure: false,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASSWORD
  }
});

export const sendEmail = async (
  to: string,
  subject: string | null,
  html: string
): Promise<boolean> => {
  try {
    await transporter.sendMail({
      from: env.EMAIL_USER,
      to,
      subject: subject || "Interview Update",
      html
    });
    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    return false;
  }
};
