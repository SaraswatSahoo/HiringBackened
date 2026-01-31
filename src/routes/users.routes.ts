import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { UserRole } from "@prisma/client";

const router = Router();

router.use(authenticate);

// GET /api/users
router.get(
  "/",
  authorize("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, isActive, search } = req.query;

      const where: any = {};
      if (role) where.role = role as UserRole;
      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }
      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: "insensitive" } },
          { email: { contains: String(search), mode: "insensitive" } }
        ];
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          isActive: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      });

      res.json(users);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/users/:id
router.get(
  "/:id",
  authorize("ADMIN", "HR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              createdJDs: true,
              candidateActions: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/users/:id
router.patch(
  "/:id",
  [
    body("name").trim().optional(),
    body("phone").optional(),
    body("role").isIn(["ADMIN", "HR", "RECRUITER"]).optional(),
    body("isActive").isBoolean().optional()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const isSelf = req.params.id === req.user.id;

      if (!isSelf && req.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Access denied" });
      }

      const data: any = { ...req.body };
      if (req.user.role !== "ADMIN") {
        delete data.role;
        delete data.isActive;
      }

      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          isActive: true,
          updatedAt: true
        }
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/users/:id/change-password
router.post(
  "/:id/change-password",
  [body("currentPassword").notEmpty(), body("newPassword").isLength({ min: 6 })],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user || req.params.id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.params.id }
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isValid = await bcrypt.compare(
        req.body.currentPassword,
        user.password
      );
      if (!isValid) {
        return res.status(401).json({ error: "Invalid current password" });
      }

      const hashed = await bcrypt.hash(req.body.newPassword, 12);

      await prisma.user.update({
        where: { id: req.params.id },
        data: { password: hashed }
      });

      res.json({ message: "Password changed successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/users/:id
router.delete(
  "/:id",
  authorize("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      if (req.params.id === req.user.id) {
        return res
          .status(400)
          .json({ error: "Cannot delete your own account" });
      }

      await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive: false }
      });

      res.json({ message: "User deactivated successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
