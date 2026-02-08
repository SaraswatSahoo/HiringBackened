// src/routes/jd.routes.ts
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as jdController from '../controllers/jd.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

router.use(authenticate);

// Create new JD
router.post(
  '/',
  authorize('ADMIN', 'HR'),
  validateRequest([
    body('title').notEmpty().trim().withMessage('Title is required'),
    body('description').notEmpty().trim().withMessage('Description is required'),
    body('department').notEmpty().trim().withMessage('Department is required'),
    body('location').optional().trim(),
    body('status').optional().isIn(['ACTIVE', 'PAUSED', 'CLOSED', 'DRAFT']),

    // Compensation
    body('salaryMin').optional().isNumeric().withMessage('Salary min must be a number'),
    body('salaryMax').optional().isNumeric().withMessage('Salary max must be a number'),
    body('openings').optional().isInt({ min: 1 }).withMessage('Openings must be at least 1'),

    // Eligibility criteria
    body('eligibleDegrees').optional().isArray().withMessage('Eligible degrees must be an array'),
    body('eligibleStreams').optional().isArray().withMessage('Eligible streams must be an array'),
    body('eligibleYears').optional().isArray().withMessage('Eligible years must be an array'),
    body('eligibleYears.*').optional().isInt({ min: 2020, max: 2030 }).withMessage('Invalid year'),
    body('minCGPA').optional().isFloat({ min: 0, max: 10 }).withMessage('CGPA must be between 0 and 10'),

    // Eligibility criteria
    body('eligibleDegrees').optional().isArray().withMessage('Eligible degrees must be an array'),
    body('eligibleStreams').optional().isArray().withMessage('Eligible streams must be an array'),
    body('eligibleYears').optional().isArray().withMessage('Eligible years must be an array'),
    body('eligibleYears.*').optional().isInt({ min: 2020, max: 2030 }).withMessage('Invalid year'),
    body('minCGPA').optional().isFloat({ min: 0, max: 10 }).withMessage('CGPA must be between 0 and 10'),
  ]),
  jdController.createJD
);

// Get all JDs with filters
router.get(
  '/',
  validateRequest([
    query('status').optional().isIn(['ACTIVE', 'PAUSED', 'CLOSED', 'DRAFT']),
    query('department').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
  ]),
  jdController.getAllJDs
);

// Get single JD by ID
router.get(
  '/:id',
  validateRequest([param('id').isUUID()]),
  jdController.getJDById
);

// Update JD
router.put(
  '/:id',
  authorize('ADMIN', 'HR'),
  [
    param('id').isUUID().withMessage('Invalid JD ID'),
    body('title').optional().notEmpty().trim(),
    body('description').optional().notEmpty().trim(),
    body('department').optional().notEmpty().trim(),
    body('location').optional().trim(),
    body('salaryMin').optional().isNumeric(),
    body('salaryMax').optional().isNumeric(),
    body('openings').optional().isInt({ min: 1 }),
    body('eligibleDegrees').optional().isArray(),
    body('eligibleStreams').optional().isArray(),
    body('eligibleYears').optional().isArray(),
    body('eligibleYears.*').optional().isInt({ min: 2020, max: 2030 }),
    body('minCGPA').optional().isFloat({ min: 0, max: 10 }),
    body('skills').optional().isArray(),
    body('employmentType').optional().trim(),
    body('experienceLevel').optional().trim(),
    body('workMode').optional().isIn(['Onsite', 'Remote', 'Hybrid']),
  ],
  validateRequest,
  jdController.updateJD
);

// Delete JD
router.delete(
  '/:id',
  authorize('ADMIN', 'HR'),
  validateRequest([param('id').isUUID()]),
  jdController.deleteJD
);

// Update JD status
router.patch(
  '/:id/status',
  authorize('ADMIN', 'HR'),
  validateRequest([
    param('id').isUUID(),
    body('status').isIn(['ACTIVE', 'PAUSED', 'CLOSED', 'DRAFT']),
  ]),
  jdController.updateJDStatus
);

// Get JD stages with candidate counts
router.get(
  '/:id/stages',
  validateRequest([param('id').isUUID()]),
  jdController.getJDStages
);

// Get JD statistics
router.get(
  '/:id/stats',
  validateRequest([
    param('id').isUUID().withMessage('Invalid JD ID'),
  ]),
  jdController.getJDStats
);

// Duplicate JD
router.post(
  '/:id/duplicate',
  authorize('ADMIN', 'HR'),
  validateRequest([
    param('id').isUUID().withMessage('Invalid JD ID'),
  ]),
  jdController.duplicateJD
);

export default router;
