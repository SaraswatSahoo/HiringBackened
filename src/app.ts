import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/users.routes";
import jdRoutes from "./routes/jds.routes";
import candidateRoutes from "./routes/candidates.routes";
import bulkRoutes from "./routes/bulk.routes";
import communicationRoutes from "./routes/communications.routes";
import templateRoutes from "./routes/templates.routes";
import interviewRoutes from "./routes/interviews.routes";
import commentRoutes from "./routes/comments.routes";
import dashboardRoutes from "./routes/dashboard.routes";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin:
      env.NODE_ENV === "production"
        ? env.FRONTEND_URL
        : ["http://localhost:3000", "http://localhost:5173"],
    credentials: true
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use("/api", apiLimiter);

app.use(compression());
app.use(
  morgan(env.NODE_ENV === "development" ? "dev" : "combined")
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// All API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/jds", jdRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/bulk", bulkRoutes);
app.use("/api/communications", communicationRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(errorHandler);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
