// src/routes/communication.routes.ts
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as communicationController from '../controllers/communication.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== EMAIL ROUTES ====================

/**
 * Send individual email to a candidate
 * POST /api/v1/communication/email/individual
 */
router.post(
  '/email/individual',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  validateRequest([
    body('candidateId').isUUID().withMessage('Valid candidate ID is required'),
    body('jdId').isUUID().withMessage('Valid JD ID is required'),
    body('subject').notEmpty().trim().withMessage('Subject is required'),
    body('message').notEmpty().trim().withMessage('Message is required'),
    body('htmlBody').optional().trim(),
    body('templateId').optional().isUUID(),
    body('variables').optional().isObject(),
    body('attachments').optional().isArray(),
  ]),
  communicationController.sendIndividualEmail
);

/**
 * Send bulk email to multiple candidates
 * POST /api/v1/communication/email/bulk
 */
router.post(
  '/email/bulk',
  authorize('ADMIN', 'HR'),
  validateRequest([
    body('jdId').isUUID().withMessage('Valid JD ID is required'),
    body('subject').notEmpty().trim().withMessage('Subject is required'),
    body('message').notEmpty().trim().withMessage('Message is required'),
    body('htmlBody').optional().trim(),
    body('templateId').optional().isUUID(),
    body('variables').optional().isObject(),
    body('filters').optional().isObject(),
    body('candidateIds').optional().isArray(),
    body('scheduledAt').optional().isISO8601().toDate(),
    body('priority').optional().isInt({ min: 0, max: 10 }),
    body('attachments').optional().isArray(),
  ]),
  communicationController.sendBulkEmail
);

/**
 * Get all emails with pagination and filters
 * GET /api/v1/communication/emails
 */
router.get(
  '/emails',
  validateRequest([
    query('jdId').optional().isUUID(),
    query('type').optional().isIn(['BULK', 'INDIVIDUAL']),
    query('status').optional().isIn(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sortBy').optional().isIn(['createdAt', 'sentAt', 'priority']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ]),
  communicationController.getAllEmails
);

/**
 * Get single email by ID
 * GET /api/v1/communication/email/:id
 */
router.get(
  '/email/:id',
  validateRequest([param('id').isUUID().withMessage('Valid email ID is required')]),
  communicationController.getEmailById
);

/**
 * Get emails by JD
 * GET /api/v1/communication/jd/:jdId/emails
 */
router.get(
  '/jd/:jdId/emails',
  validateRequest([
    param('jdId').isUUID().withMessage('Valid JD ID is required'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ]),
  communicationController.getEmailsByJD
);

/**
 * Get candidate emails (emails sent to a specific candidate)
 * GET /api/v1/communication/candidate/:candidateId/emails
 */
router.get(
  '/candidate/:candidateId/emails',
  validateRequest([
    param('candidateId').isUUID().withMessage('Valid candidate ID is required'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ]),
  communicationController.getCandidateEmails
);

/**
 * Retry failed email
 * POST /api/v1/communication/email/:candidateEmailId/retry
 */
router.post(
  '/email/:candidateEmailId/retry',
  authorize('ADMIN', 'HR'),
  validateRequest([
    param('candidateEmailId').isUUID().withMessage('Valid candidate email ID is required'),
  ]),
  communicationController.retryFailedEmail
);

// ==================== TEMPLATE ROUTES ====================

/**
 * Get all email templates
 * GET /api/v1/communication/templates
 */
router.get(
  '/templates',
  validateRequest([
    query('category')
      .optional()
      .isIn([
        'INTERVIEW_CALL',
        'TEST_LINK',
        'REJECTION',
        'OFFER',
        'SHORTLIST',
        'REMINDER',
        'FEEDBACK_REQUEST',
        'ONBOARDING',
        'GENERAL',
      ]),
    query('isActive').optional().isBoolean().toBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ]),
  communicationController.getAllTemplates
);

/**
 * Get single template by ID
 * GET /api/v1/communication/template/:id
 */
router.get(
  '/template/:id',
  validateRequest([param('id').isUUID().withMessage('Valid template ID is required')]),
  communicationController.getTemplateById
);

/**
 * Create new email template
 * POST /api/v1/communication/template
 */
router.post(
  '/template',
  authorize('ADMIN', 'HR'),
  validateRequest([
    body('name').notEmpty().trim().withMessage('Template name is required'),
    body('category')
      .isIn([
        'INTERVIEW_CALL',
        'TEST_LINK',
        'REJECTION',
        'OFFER',
        'SHORTLIST',
        'REMINDER',
        'FEEDBACK_REQUEST',
        'ONBOARDING',
        'GENERAL',
      ])
      .withMessage('Valid category is required'),
    body('subject').notEmpty().trim().withMessage('Subject is required'),
    body('body').notEmpty().trim().withMessage('Body is required'),
    body('htmlBody').optional().trim(),
    body('description').optional().trim(),
    body('variables').optional().isArray(),
    body('defaultValues').optional().isObject(),
    body('previewData').optional().isObject(),
    body('attachments').optional().isArray(),
    body('isDefault').optional().isBoolean(),
  ]),
  communicationController.createTemplate
);

/**
 * Update email template
 * PUT /api/v1/communication/template/:id
 */
router.put(
  '/template/:id',
  authorize('ADMIN', 'HR'),
  validateRequest([
    param('id').isUUID().withMessage('Valid template ID is required'),
    body('name').optional().trim(),
    body('subject').optional().trim(),
    body('body').optional().trim(),
    body('htmlBody').optional().trim(),
    body('description').optional().trim(),
    body('variables').optional().isArray(),
    body('defaultValues').optional().isObject(),
    body('previewData').optional().isObject(),
    body('attachments').optional().isArray(),
    body('isActive').optional().isBoolean(),
    body('isDefault').optional().isBoolean(),
  ]),
  communicationController.updateTemplate
);

/**
 * Delete email template
 * DELETE /api/v1/communication/template/:id
 */
router.delete(
  '/template/:id',
  authorize('ADMIN'),
  validateRequest([param('id').isUUID().withMessage('Valid template ID is required')]),
  communicationController.deleteTemplate
);

/**
 * Preview template with variables
 * POST /api/v1/communication/template/:id/preview
 */
router.post(
  '/template/:id/preview',
  validateRequest([
    param('id').isUUID().withMessage('Valid template ID is required'),
    body('variables').optional().isObject(),
  ]),
  communicationController.previewTemplate
);

// ==================== STATS ROUTES ====================

/**
 * Get email statistics
 * GET /api/v1/communication/stats
 */
router.get(
  '/stats',
  validateRequest([
    query('jdId').optional().isUUID(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
  ]),
  communicationController.getEmailStats
);

/**
 * Get email statistics by JD
 * GET /api/v1/communication/jd/:jdId/stats
 */
router.get(
  '/jd/:jdId/stats',
  validateRequest([param('jdId').isUUID().withMessage('Valid JD ID is required')]),
  communicationController.getEmailStatsByJD
);

export default router;
