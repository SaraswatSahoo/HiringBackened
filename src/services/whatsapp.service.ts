// src/services/whatsapp.service.ts
import twilio from 'twilio';
import config from '../config/env';
import logger from '../utils/logger';

const client = twilio(config.whatsapp.accountSid, config.whatsapp.authToken);

class WhatsAppService {
  async send(to: string, message: string): Promise<{ success: boolean }> {
    try {
      const formattedNumber = to.startsWith('+') ? to : `+91${to}`;
      
      await client.messages.create({
        body: message,
        from: config.whatsapp.number,
        to: `whatsapp:${formattedNumber}`,
      });
      
      logger.info(`WhatsApp sent to ${to}`);
      return { success: true };
    } catch (error) {
      logger.error(`WhatsApp failed to ${to}:`, error);
      throw error;
    }
  }
}

export default new WhatsAppService();
