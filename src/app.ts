import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import config from './config/env';
import { limiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth.routes';
import jdRoutes from './routes/jd.routes';
import candidateRoutes from './routes/candidate.routes';
import bulkRoutes from './routes/bulk.routes';
import communicationRoutes from './routes/communication.routes';
import feedbackRoutes from './routes/feedback.routes';
import dashboardRoutes from './routes/dashboard.routes';
import adminRoutes from './routes/admin.routes';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin.split(','),
  credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Rate limiting
app.use(limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
const apiPrefix = config.apiPrefix;
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/jds`, jdRoutes);
app.use(`${apiPrefix}/candidates`, candidateRoutes);
app.use(`${apiPrefix}/bulk`, bulkRoutes);
app.use(`${apiPrefix}/communications`, communicationRoutes);
app.use(`${apiPrefix}/feedback`, feedbackRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

export default app;
