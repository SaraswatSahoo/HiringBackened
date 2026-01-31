import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// GET /api/dashboard/admin
router.get(
  "/admin",
  authorize("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [
        totalJDs,
        activeJDs,
        totalCandidates,
        stageDistribution,
        recentActivity,
        topColleges
      ] = await Promise.all([
        prisma.jobDescription.count(),
        prisma.jobDescription.count({ where: { isActive: true } }),
        prisma.candidate.count(),
        prisma.candidate.groupBy({
          by: ["stage"],
          _count: true
        }),
        prisma.candidateHistory.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                jobDescription: {
                  select: { id: true, title: true }
                }
              }
            },
            changedBy: {
              select: { id: true, name: true }
            }
          }
        }),
        prisma.candidate.groupBy({
          by: ["college"],
          where: {
            college: { not: null }
          },
          _count: true,
          orderBy: { _count: { college: "desc" } },
          take: 10
        })
      ]);

      const selections = stageDistribution.find(
        (s) => s.stage === "SELECTED"
      )?._count || 0;
      const joined = stageDistribution.find((s) => s.stage === "JOINED")?._count || 0;
      const dropouts = stageDistribution.find((s) => s.stage === "DROPPED")?._count || 0;
      const rejected = stageDistribution.find((s) => s.stage === "REJECTED")?._count || 0;

      res.json({
        overview: {
          totalJDs,
          activeJDs,
          totalCandidates,
          totalSelections: selections + joined,
          totalDropouts: dropouts + rejected
        },
        stageDistribution,
        recentActivity,
        topColleges
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/dashboard/jd/:jobDescriptionId
router.get(
  "/jd/:jobDescriptionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobDescriptionId = req.params.jobDescriptionId;

      const [jd, candidates, stageStats, collegeStats] = await Promise.all([
        prisma.jobDescription.findUnique({
          where: { id: jobDescriptionId },
          include: {
            createdBy: {
              select: { id: true, name: true }
            }
          }
        }),
        prisma.candidate.findMany({
          where: { jobDescriptionId },
          select: {
            id: true,
            name: true,
            email: true,
            stage: true,
            isEligible: true,
            rating: true,
            createdAt: true
          }
        }),
        prisma.candidate.groupBy({
          by: ["stage"],
          where: { jobDescriptionId },
          _count: true
        }),
        prisma.candidate.groupBy({
          by: ["college"],
          where: {
            jobDescriptionId,
            college: { not: null }
          },
          _count: true,
          orderBy: { _count: { college: "desc" } }
        })
      ]);

      if (!jd) {
        return res.status(404).json({ error: "Job description not found" });
      }

      const eligible = candidates.filter((c) => c.isEligible).length;
      const avgRating =
        candidates.reduce((sum, c) => sum + (c.rating || 0), 0) /
          candidates.filter((c) => c.rating).length || 0;

      res.json({
        jd,
        summary: {
          total: candidates.length,
          eligible,
          avgRating
        },
        stageStats,
        collegeStats,
        recentCandidates: candidates.slice(0, 10)
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/dashboard/user
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req!.user!.id;

      const [createdJDs, recentActions, upcomingInterviews] = await Promise.all([
        prisma.jobDescription.findMany({
          where: { createdById: userId },
          include: {
            _count: {
              select: { candidates: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        }),
        prisma.candidateHistory.findMany({
          where: { changedById: userId },
          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                jobDescription: {
                  select: { id: true, title: true }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        }),
        prisma.interview.findMany({
          where: {
            interviewerId: userId,
            scheduledAt: { gte: new Date() },
            status: "SCHEDULED"
          },
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
            }
          },
          orderBy: { scheduledAt: "asc" },
          take: 10
        })
      ]);

      res.json({
        createdJDs,
        recentActions,
        upcomingInterviews
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
