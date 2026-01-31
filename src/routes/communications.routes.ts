import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { CommunicationChannel, CommunicationStatus } from "@prisma/client";
import { sendEmail } from "../services/email.service";
import { sendSMS } from "../services/sms.service";
import { sendWhatsApp } from "../services/whatsapp.service";

const router = Router();

router.use(authenticate);

// POST /api/communications/send-bulk
router.post(
  "/send-bulk",
  authorize("ADMIN", "HR"),
  [
    body("candidateIds").isArray({ min: 1 }),
    body("channel").isIn(["EMAIL", "SMS", "WHATSAPP"]),
    body("message").trim().notEmpty(),
    body("subject").trim().optional()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { candidateIds, channel, message, subject } = req.body;

      const candidates = await prisma.candidate.findMany({
        where: { id: { in: candidateIds as string[] } },
        select: { id: true, name: true, email: true, phone: true }
      });

      const communications = candidates.map((candidate) => ({
        candidateId: candidate.id,
        channel: channel as CommunicationChannel,
        subject: subject || null,
        message: message.replace("{{name}}", candidate.name),
        status: "PENDING" as CommunicationStatus
      }));

      const createdComms = await prisma.communication.createMany({
        data: communications
      });

      // Process asynchronously
      setImmediate(async () => {
        for (const candidate of candidates) {
          try {
            const personalizedMessage = message.replace(
              "{{name}}",
              candidate.name
            );

            let sent = false;
            if (channel === "EMAIL") {
              sent = await sendEmail(candidate.email, subject, personalizedMessage);
            } else if (channel === "SMS") {
              sent = await sendSMS(candidate.phone, personalizedMessage);
            } else if (channel === "WHATSAPP") {
              sent = await sendWhatsApp(candidate.phone, personalizedMessage);
            }

            await prisma.communication.updateMany({
              where: {
                candidateId: candidate.id,
                message: personalizedMessage,
                status: "PENDING"
              },
              data: {
                status: sent ? "SENT" : "FAILED",
                sentAt: sent ? new Date() : null,
                errorMessage: sent ? null : "Sending failed"
              }
            });
          } catch (error) {
            console.error(
              `Failed to send ${channel} to ${candidate.email}:`,
              error
            );
            await prisma.communication.updateMany({
              where: {
                candidateId: candidate.id,
                status: "PENDING"
              },
              data: {
                status: "FAILED",
                errorMessage: (error as Error).message
              }
            });
          }
        }
      });

      res.json({
        message: "Bulk communication initiated",
        count: createdComms.count
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/communications/history/:candidateId
router.get(
  "/history/:candidateId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const communications = await prisma.communication.findMany({
        where: { candidateId: req.params.candidateId },
        orderBy: { createdAt: "desc" }
      });

      res.json(communications);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/communications/stats/:jobDescriptionId
router.get(
  "/stats/:jobDescriptionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await prisma.communication.groupBy({
        by: ["channel", "status"],
        where: {
          candidate: {
            jobDescriptionId: req.params.jobDescriptionId
          }
        },
        _count: true
      });

      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
