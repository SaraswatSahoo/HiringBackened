// src/routes/dashboard.routes.ts
import { Router } from 'express';
import { param } from 'express-validator';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

router.use(authenticate);

router.get('/admin', authorize('ADMIN'), dashboardController.getAdminDashboard);

router.get(
  '/jd/:jdId',
  [param('jdId').isUUID()],
  validateRequest,
  dashboardController.getJDDashboard
);

router.get(
  '/college-performance/:jdId',
  [param('jdId').isUUID()],
  validateRequest,
  dashboardController.getCollegePerformance
);

router.get(
  '/analytics/:jdId',
  [param('jdId').isUUID()],
  validateRequest,
  dashboardController.getAnalytics
);

export default router;
