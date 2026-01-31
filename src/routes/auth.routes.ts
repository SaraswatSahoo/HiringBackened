import { Router, Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { authenticate } from "../middleware/auth";
import { UserRole } from "@prisma/client";

const router = Router();

const JWT_SECRET: jwt.Secret = env.JWT_SECRET;
const JWT_EXPIRES_IN: jwt.SignOptions["expiresIn"] = (env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) || "7d";

const signToken = (userId: string, role: UserRole) =>
  jwt.sign({ userId, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

// POST /api/auth/register
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("name").trim().notEmpty(),
    body("role").isIn(["ADMIN", "HR", "RECRUITER"]).optional()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, role, phone } = req.body;

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: (role as UserRole) || "RECRUITER",
          phone
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true
        }
      });

      const token = signToken(user.id, user.role);

      res.status(201).json({ user, token });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = signToken(user.id, user.role);

      const { password: _pw, ...safeUser } = user;

      res.json({ user: safeUser, token });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          createdAt: true
        }
      });

      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
