// src/routes/dashboard.routes.ts
import { Router } from 'express';
import { param, query } from 'express-validator';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Admin dashboard - Overview of all JDs
router.get(
  '/admin',
  authorize('ADMIN'),
  dashboardController.getAdminDashboard
);

// JD-specific dashboard - Complete overview
router.get(
  '/jd/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ],
  validateRequest,
  dashboardController.getJDDashboard
);

// Dashboard summary - Quick stats
router.get(
  '/summary/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ],
  validateRequest,
  dashboardController.getDashboardSummary
);

// Stage-wise statistics
router.get(
  '/stages/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ],
  validateRequest,
  dashboardController.getStageWiseStats
);

// College performance analytics
router.get(
  '/college-performance/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ],
  validateRequest,
  dashboardController.getCollegePerformance
);

// Top performing colleges
router.get(
  '/top-colleges/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ],
  validateRequest,
  dashboardController.getTopColleges
);

// CGPA distribution analysis
router.get(
  '/cgpa-distribution/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ],
  validateRequest,
  dashboardController.getCGPADistribution
);

// Degree distribution analysis
router.get(
  '/degree-distribution/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ],
  validateRequest,
  dashboardController.getDegreeDistribution
);

// Eligibility statistics
router.get(
  '/eligibility-stats/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ],
  validateRequest,
  dashboardController.getEligibilityStats
);

// Detailed analytics with date range
router.get(
  '/analytics/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Valid start date is required (ISO 8601 format)'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Valid end date is required (ISO 8601 format)'),
  ],
  validateRequest,
  dashboardController.getAnalytics
);

export default router;
