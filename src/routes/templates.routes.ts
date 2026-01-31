import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { CommunicationChannel } from "@prisma/client";

const router = Router();

router.use(authenticate);

// POST /api/templates
router.post(
  "/",
  authorize("ADMIN", "HR"),
  [
    body("name").trim().notEmpty(),
    body("channel").isIn(["EMAIL", "SMS", "WHATSAPP"]),
    body("content").trim().notEmpty()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const template = await prisma.messageTemplate.create({
        data: {
          ...req.body,
          jobDescriptionId: req.body.jobDescriptionId || null,
          channel: req.body.channel as CommunicationChannel
        }
      });

      res.status(201).json(template);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/templates
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobDescriptionId, channel, isGlobal } = req.query;

      const where: any = {};
      if (channel) where.channel = channel as CommunicationChannel;
      if (isGlobal !== undefined) {
        where.isGlobal = isGlobal === "true";
      }
      if (jobDescriptionId) {
        where.OR = [
          { jobDescriptionId: String(jobDescriptionId) },
          { isGlobal: true }
        ];
      }

      const templates = await prisma.messageTemplate.findMany({
        where,
        orderBy: { createdAt: "desc" }
      });

      res.json(templates);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/templates/:id
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await prisma.messageTemplate.findUnique({
        where: { id: req.params.id }
      });

      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      res.json(template);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/templates/:id
router.patch(
  "/:id",
  authorize("ADMIN", "HR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await prisma.messageTemplate.update({
        where: { id: req.params.id },
        data: req.body
      });

      res.json(template);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/templates/:id
router.delete(
  "/:id",
  authorize("ADMIN", "HR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.messageTemplate.delete({
        where: { id: req.params.id }
      });

      res.json({ message: "Template deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
