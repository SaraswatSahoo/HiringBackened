// src/routes/candidate.routes.ts
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as candidateController from '../controllers/candidate.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new candidate manually
router.post(
  '/',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  [
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .trim(),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .isMobilePhone('any')
      .withMessage('Valid phone number is required'),
    body('alternatePhone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Valid alternate phone number required'),
    body('college')
      .notEmpty()
      .withMessage('College name is required')
      .trim(),
    body('degree')
      .notEmpty()
      .withMessage('Degree is required')
      .trim(),
    body('branch')
      .optional()
      .trim(),
    body('passOutYear')
      .isInt({ min: 2020, max: 2030 })
      .withMessage('Valid pass out year is required (2020-2030)'),
    body('cgpa')
      .optional()
      .isFloat({ min: 0, max: 10 })
      .withMessage('CGPA must be between 0 and 10'),
    body('resumeLink')
      .optional()
      .isURL()
      .withMessage('Valid resume link is required'),
    body('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
  ],
  validateRequest,
  candidateController.createCandidate
);

// Get all candidates for a specific JD with filters
router.get(
  '/jd/:jdId',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('stageId')
      .optional()
      .isUUID()
      .withMessage('Valid stage ID required'),
    query('isEligible')
      .optional()
      .isBoolean()
      .withMessage('isEligible must be boolean'),
    query('college')
      .optional()
      .trim(),
    query('degree')
      .optional()
      .trim(),
    query('passOutYear')
      .optional()
      .isInt()
      .withMessage('Pass out year must be an integer'),
    query('search')
      .optional()
      .trim(),
  ],
  validateRequest,
  candidateController.getCandidatesByJD
);

// Get candidates by college
router.get(
  '/jd/:jdId/college/:college',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    param('college')
      .notEmpty()
      .withMessage('College name is required')
      .trim(),
  ],
  validateRequest,
  candidateController.getCandidatesByCollege
);

// Get eligible candidates for a JD
router.get(
  '/jd/:jdId/eligible',
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  validateRequest,
  candidateController.getEligibleCandidates
);

// Get candidate by ID
router.get(
  '/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
  ],
  validateRequest,
  candidateController.getCandidateById
);

// Update candidate
router.put(
  '/:id',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  [
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
    body('name')
      .optional()
      .trim(),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Valid phone number is required'),
    body('alternatePhone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Valid alternate phone number required'),
    body('college')
      .optional()
      .trim(),
    body('degree')
      .optional()
      .trim(),
    body('branch')
      .optional()
      .trim(),
    body('passOutYear')
      .optional()
      .isInt({ min: 2020, max: 2030 })
      .withMessage('Valid pass out year is required'),
    body('cgpa')
      .optional()
      .isFloat({ min: 0, max: 10 })
      .withMessage('CGPA must be between 0 and 10'),
    body('resumeLink')
      .optional()
      .isURL()
      .withMessage('Valid resume link is required'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
  ],
  validateRequest,
  candidateController.updateCandidate
);

// Delete candidate
router.delete(
  '/:id',
  authorize('ADMIN', 'HR'),
  [
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
  ],
  validateRequest,
  candidateController.deleteCandidate
);

// Move candidate to a different stage
router.post(
  '/:id/move-stage',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  [
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
    body('stageId')
      .isUUID()
      .withMessage('Valid stage ID is required'),
    body('notes')
      .optional()
      .trim(),
    body('interviewDate')
      .optional()
      .isISO8601()
      .withMessage('Valid interview date is required (ISO 8601 format)'),
    body('interviewMode')
      .optional()
      .isIn(['Online', 'Offline', 'Telephonic', 'Video'])
      .withMessage('Invalid interview mode'),
    body('interviewerName')
      .optional()
      .trim(),
  ],
  validateRequest,
  candidateController.moveCandidateStage
);

// Bulk move candidates to a stage
router.post(
  '/bulk/move-stage',
  authorize('ADMIN', 'HR'),
  [
    body('candidateIds')
      .isArray({ min: 1 })
      .withMessage('At least one candidate ID is required'),
    body('candidateIds.*')
      .isUUID()
      .withMessage('All candidate IDs must be valid UUIDs'),
    body('stageId')
      .isUUID()
      .withMessage('Valid stage ID is required'),
    body('notes')
      .optional()
      .trim(),
  ],
  validateRequest,
  candidateController.bulkMoveCandidates
);

export default router;
