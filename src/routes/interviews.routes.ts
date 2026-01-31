import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../config/prisma";
import { authenticate } from "../middleware/auth";
import { InterviewStatus } from "@prisma/client";

const router = Router();

router.use(authenticate);

// POST /api/interviews
router.post(
  "/",
  [
    body("candidateId").notEmpty(),
    body("scheduledAt").isISO8601(),
    body("interviewType").trim().notEmpty(),
    body("duration").isInt({ min: 15 }).optional()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const interview = await prisma.interview.create({
        data: {
          ...req.body,
          interviewerId: req!.user!.id,
          status: "SCHEDULED"
        },
        include: {
          candidate: {
            select: { id: true, name: true, email: true }
          },
          interviewer: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      res.status(201).json(interview);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/interviews
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { candidateId, status, interviewerId, from, to } = req.query;

      const where: any = {};
      if (candidateId) where.candidateId = String(candidateId);
      if (status) where.status = status as InterviewStatus;
      if (interviewerId) where.interviewerId = String(interviewerId);
      if (from || to) {
        where.scheduledAt = {};
        if (from) where.scheduledAt.gte = new Date(String(from));
        if (to) where.scheduledAt.lte = new Date(String(to));
      }

      const interviews = await prisma.interview.findMany({
        where,
        include: {
          candidate: {
            select: {
              id: true,
              name: true,
              email: true,
              jobDescription: {
                select: { id: true, title: true }
              }
            }
          },
          interviewer: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { scheduledAt: "asc" }
      });

      res.json(interviews);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/interviews/:id
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interview = await prisma.interview.findUnique({
        where: { id: req.params.id },
        include: {
          candidate: {
            include: {
              jobDescription: {
                select: { id: true, title: true }
              }
            }
          },
          interviewer: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      if (!interview) {
        return res.status(404).json({ error: "Interview not found" });
      }

      res.json(interview);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/interviews/:id
router.patch(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interview = await prisma.interview.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
          candidate: {
            select: { id: true, name: true, email: true }
          },
          interviewer: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      res.json(interview);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/interviews/:id/feedback
router.post(
  "/:id/feedback",
  [
    body("feedback").trim().notEmpty(),
    body("rating").isFloat({ min: 1, max: 5 }),
    body("status")
      .isIn(["COMPLETED", "CANCELLED", "NO_SHOW"])
      .optional()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { feedback, rating, status } = req.body;

      const interview = await prisma.interview.update({
        where: { id: req.params.id },
        data: {
          feedback,
          rating: parseFloat(String(rating)),
          status: (status || "COMPLETED") as InterviewStatus
        },
        include: {
          candidate: true
        }
      });

      // Update candidate average rating
      const allInterviews = await prisma.interview.findMany({
        where: {
          candidateId: interview.candidateId,
          rating: { not: null }
        },
        select: { rating: true }
      });

      if (allInterviews.length > 0) {
        const avgRating =
          allInterviews.reduce((sum, i) => sum + (i.rating || 0), 0) /
          allInterviews.length;

        await prisma.candidate.update({
          where: { id: interview.candidateId },
          data: { rating: avgRating }
        });
      }

      res.json(interview);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/interviews/:id
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.interview.delete({
        where: { id: req.params.id }
      });

      res.json({ message: "Interview deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
