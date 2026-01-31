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
      from: `"Hiring Platform" <${env.EMAIL_USER}>`,
      to,
      subject: subject || "Interview Update",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>Hiring Update</h2>
          <p>${html}</p>
          <hr>
          <small>This is an automated message from Hiring Platform</small>
        </div>
      `
    });
    console.log(`✅ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error);
    return false;
  }
};
