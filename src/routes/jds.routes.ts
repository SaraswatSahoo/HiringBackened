import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { EmploymentType, HiringType } from "@prisma/client";

const router = Router();

router.use(authenticate);

// POST /api/jds
router.post(
  "/",
  authorize("ADMIN", "HR"),
  [
    body("title").trim().notEmpty(),
    body("description").trim().notEmpty(),
    body("hiringType").isIn(["BULK", "NORMAL"]),
    body("employmentType")
      .isIn(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"])
      .optional(),
    body("openings").isInt({ min: 1 }).optional()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const data = req.body;

      const jd = await prisma.jobDescription.create({
        data: {
          title: data.title,
          description: data.description,
          hiringType: data.hiringType as HiringType,
          employmentType: (data.employmentType ??
            "FULL_TIME") as EmploymentType,
          department: data.department,
          location: data.location,
          experienceMin: data.experienceMin ?? null,
          experienceMax: data.experienceMax ?? null,
          salary: data.salary ?? null,
          requiredSkills: data.requiredSkills ?? [],
          targetColleges: data.targetColleges ?? [],
          eligibleDegrees: data.eligibleDegrees ?? [],
          eligibleYears: data.eligibleYears ?? [],
          openings: data.openings ?? 1,
          createdById: req.user.id
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      res.status(201).json(jd);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/jds
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hiringType, isActive, search, page = "1", limit = "20" } =
        req.query;

      const where: any = {};
      if (hiringType) where.hiringType = hiringType as HiringType;
      if (isActive !== undefined) where.isActive = isActive === "true";
      if (search) {
        where.OR = [
          {
            title: {
              contains: String(search),
              mode: "insensitive"
            }
          },
          {
            description: {
              contains: String(search),
              mode: "insensitive"
            }
          }
        ];
      }

      const pageNum = parseInt(String(page), 10);
      const limitNum = parseInt(String(limit), 10);

      const [jds, total] = await Promise.all([
        prisma.jobDescription.findMany({
          where,
          include: {
            createdBy: {
              select: { id: true, name: true, email: true }
            },
            _count: {
              select: { candidates: true }
            }
          },
          orderBy: { createdAt: "desc" },
          skip: (pageNum - 1) * limitNum,
          take: limitNum
        }),
        prisma.jobDescription.count({ where })
      ]);

      res.json({
        jds,
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

// GET /api/jds/:id
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jdId = req.params.id;

      const jd = await prisma.jobDescription.findUnique({
        where: { id: jdId },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          candidates: {
            include: {
              _count: {
                select: {
                  comments: true,
                  interviews: true
                }
              }
            },
            orderBy: { createdAt: "desc" }
          },
          _count: {
            select: {
              candidates: true,
              templates: true
            }
          }
        }
      });

      if (!jd) {
        return res.status(404).json({ error: "Job description not found" });
      }

      const stageStats = await prisma.candidate.groupBy({
        by: ["stage"],
        where: { jobDescriptionId: jdId },
        _count: true
      });

      res.json({ ...jd, stageStats });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/jds/:id
router.patch(
  "/:id",
  authorize("ADMIN", "HR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jd = await prisma.jobDescription.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      res.json(jd);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/jds/:id
router.delete(
  "/:id",
  authorize("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.jobDescription.update({
        where: { id: req.params.id },
        data: { isActive: false }
      });

      res.json({ message: "Job description deactivated successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
