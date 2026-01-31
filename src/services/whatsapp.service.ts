import twilio from "twilio";
import { env } from "../config/env";

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export const sendWhatsApp = async (
  to: string,
  body: string
): Promise<boolean> => {
  try {
    await client.messages.create({
      body,
      from: `whatsapp:${env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${to}`
    });
    return true;
  } catch (error) {
    console.error("WhatsApp sending failed:", error);
    return false;
  }
};
