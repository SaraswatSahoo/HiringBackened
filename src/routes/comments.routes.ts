import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../config/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

// POST /api/comments
router.post(
  "/",
  [body("candidateId").notEmpty(), body("content").trim().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const comment = await prisma.comment.create({
        data: {
          candidateId: req.body.candidateId,
          content: req.body.content,
          authorId: req!.user!.id
        },
        include: {
          author: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      res.status(201).json(comment);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/comments/candidate/:candidateId
router.get(
  "/candidate/:candidateId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comments = await prisma.comment.findMany({
        where: { candidateId: req.params.candidateId },
        include: {
          author: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      res.json(comments);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/comments/:id
router.patch(
  "/:id",
  [body("content").trim().notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existing = await prisma.comment.findUnique({
        where: { id: req.params.id }
      });

      if (!existing) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (
        existing.authorId !== req!.user!.id &&
        req!.user!.role !== "ADMIN"
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      const comment = await prisma.comment.update({
        where: { id: req.params.id },
        data: { content: req.body.content },
        include: {
          author: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      res.json(comment);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/comments/:id
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.comment.findUnique({
        where: { id: req.params.id }
      });

      if (!existing) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (
        existing.authorId !== req!.user!.id &&
        req!.user!.role !== "ADMIN"
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      await prisma.comment.delete({
        where: { id: req.params.id }
      });

      res.json({ message: "Comment deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
