// src/services/sms.service.ts
import twilio from 'twilio';
import config from '../config/env';
import logger from '../utils/logger';

const client = twilio(config.sms.accountSid, config.sms.authToken);

class SMSService {
  async send(to: string, message: string): Promise<{ success: boolean }> {
    try {
      const formattedNumber = to.startsWith('+') ? to : `+91${to}`;
      
      await client.messages.create({
        body: message,
        from: config.sms.number,
        to: formattedNumber,
      });
      
      logger.info(`SMS sent to ${to}`);
      return { success: true };
    } catch (error) {
      logger.error(`SMS failed to ${to}:`, error);
      throw error;
    }
  }
}

export default new SMSService();
