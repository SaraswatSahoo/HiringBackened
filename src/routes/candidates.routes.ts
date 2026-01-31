import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../config/prisma";
import { authenticate } from "../middleware/auth";
import { CandidateStage } from "@prisma/client";

const router = Router();

router.use(authenticate);

// POST /api/candidates
router.post(
  "/",
  [
    body("name").trim().notEmpty(),
    body("email").isEmail().normalizeEmail(),
    body("phone").trim().notEmpty(),
    body("jobDescriptionId").notEmpty()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const candidate = await prisma.candidate.create({
        data: {
          ...req.body,
          stage: "APPLIED"
        },
        include: {
          jobDescription: {
            select: { id: true, title: true, hiringType: true }
          }
        }
      });

      // Create history entry
      await prisma.candidateHistory.create({
        data: {
          candidateId: candidate.id,
          toStage: "APPLIED",
          changedById: req!.user!.id
        }
      });

      res.status(201).json(candidate);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/candidates
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        jobDescriptionId,
        stage,
        college,
        yearOfPassing,
        isEligible,
        search,
        page = "1",
        limit = "50"
      } = req.query;

      const where: any = {};
      if (jobDescriptionId) where.jobDescriptionId = String(jobDescriptionId);
      if (stage) where.stage = stage as CandidateStage;
      if (college) where.college = String(college);
      if (yearOfPassing) where.yearOfPassing = parseInt(String(yearOfPassing));
      if (isEligible !== undefined) where.isEligible = isEligible === "true";
      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: "insensitive" } },
          { email: { contains: String(search), mode: "insensitive" } },
          { phone: { contains: String(search), mode: "insensitive" } }
        ];
      }

      const pageNum = parseInt(String(page), 10);
      const limitNum = parseInt(String(limit), 10);

      const [candidates, total] = await Promise.all([
        prisma.candidate.findMany({
          where,
          include: {
            jobDescription: {
              select: { id: true, title: true, hiringType: true }
            },
            _count: {
              select: {
                comments: true,
                interviews: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          skip: (pageNum - 1) * limitNum,
          take: limitNum
        }),
        prisma.candidate.count({ where })
      ]);

      res.json({
        candidates,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/candidates/:id
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const candidate = await prisma.candidate.findUnique({
        where: { id: req.params.id },
        include: {
          jobDescription: {
            select: {
              id: true,
              title: true,
              hiringType: true,
              department: true
            }
          },
          history: {
            include: {
              changedBy: {
                select: { id: true, name: true }
              }
            },
            orderBy: { createdAt: "desc" }
          },
          comments: {
            include: {
              author: {
                select: { id: true, name: true }
              }
            },
            orderBy: { createdAt: "desc" }
          },
          interviews: {
            include: {
              interviewer: {
                select: { id: true, name: true }
              }
            },
            orderBy: { scheduledAt: "desc" }
          },
          communications: {
            orderBy: { createdAt: "desc" },
            take: 10
          }
        }
      });

      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      res.json(candidate);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/candidates/:id
router.patch(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stage, ...otherUpdates } = req.body;

      // If stage is being updated, create history entry
      if (stage) {
        const currentCandidate = await prisma.candidate.findUnique({
          where: { id: req.params.id },
          select: { stage: true }
        });

        if (currentCandidate && currentCandidate.stage !== stage) {
          await prisma.candidateHistory.create({
            data: {
              candidateId: req.params.id,
              fromStage: currentCandidate.stage,
              toStage: stage as CandidateStage,
              notes: req.body.notes,
              changedById: req!.user!.id
            }
          });
        }
      }

      const candidate = await prisma.candidate.update({
        where: { id: req.params.id },
        data: { stage: stage as CandidateStage, ...otherUpdates },
        include: {
          jobDescription: {
            select: { id: true, title: true }
          }
        }
      });

      res.json(candidate);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/candidates/bulk-update-stage
router.post(
  "/bulk-update-stage",
  [
    body("candidateIds").isArray({ min: 1 }),
    body("stage").isIn(Object.values(CandidateStage))
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { candidateIds, stage, notes } = req.body;

      const candidates = await prisma.candidate.findMany({
        where: { id: { in: candidateIds as string[] } },
        select: { id: true, stage: true }
      });

      const historyEntries = candidates.map((candidate) => ({
        candidateId: candidate.id,
        fromStage: candidate.stage,
        toStage: stage as CandidateStage,
        notes,
        changedById: req!.user!.id
      }));

      await prisma.$transaction([
        prisma.candidateHistory.createMany({
          data: historyEntries
        }),
        prisma.candidate.updateMany({
          where: { id: { in: candidateIds as string[] } },
          data: { stage: stage as CandidateStage }
        })
      ]);

      res.json({
        message: `Updated ${candidateIds.length} candidates to stage ${stage}`,
        count: candidateIds.length
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/candidates/mark-eligibility
router.post(
  "/mark-eligibility",
  [
    body("jobDescriptionId").notEmpty(),
    body("criteria.degrees").isArray().optional(),
    body("criteria.years").isArray().optional()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobDescriptionId, criteria } = req.body;

      const where = { jobDescriptionId };
      const eligible: any = {};
      const ineligible: any = {};

      if (criteria.degrees?.length) {
        eligible.degree = { in: criteria.degrees };
        ineligible.degree = { notIn: criteria.degrees };
      }

      if (criteria.years?.length) {
        eligible.yearOfPassing = { in: criteria.years };
        ineligible.yearOfPassing = { notIn: criteria.years };
      }

      const [eligibleCount, ineligibleCount] = await Promise.all([
        prisma.candidate.updateMany({
          where: { ...where, ...eligible },
          data: { isEligible: true }
        }),
        prisma.candidate.updateMany({
          where: { ...where, ...ineligible },
          data: { isEligible: false }
        })
      ]);

      res.json({
        message: "Eligibility marked successfully",
        eligible: eligibleCount.count,
        ineligible: ineligibleCount.count
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/candidates/:id
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.candidate.delete({
        where: { id: req.params.id }
      });

      res.json({ message: "Candidate deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
