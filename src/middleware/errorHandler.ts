import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { env } from "../config/env";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error("Error:", err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Resource already exists" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Resource not found" });
    }
  }

  const error = err as Error & { status?: number };

  res.status(error.status || 500).json({
    error: error.message || "Internal server error",
    ...(env.NODE_ENV === "development" && { stack: error.stack })
  });
};
