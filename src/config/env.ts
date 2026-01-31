import dotenv from "dotenv";

dotenv.config();

const requiredEnv = [
  "DATABASE_URL",
  "JWT_SECRET"
] as const;

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
});

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 5000),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:3000",

  EMAIL_HOST: process.env.EMAIL_HOST ?? "",
  EMAIL_PORT: Number(process.env.EMAIL_PORT ?? 587),
  EMAIL_USER: process.env.EMAIL_USER ?? "",
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ?? "",

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER ?? ""
};
