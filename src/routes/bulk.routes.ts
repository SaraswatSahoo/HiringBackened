// src/routes/bulk.routes.ts
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import * as bulkController from '../controllers/bulk.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

// Configure multer for file upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv',
    ];
    
    // Also check file extension
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExt = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

const router = Router();

// All routes require authentication
router.use(authenticate);

// Upload bulk candidates CSV
router.post(
  '/upload',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  upload.single('file'),
  validateRequest([
    body('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ]),
  bulkController.bulkUploadCandidates
);

// Get bulk upload status by upload ID
router.get(
  '/status/:id',
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid upload ID is required'),
  ]),
  bulkController.getBulkUploadStatus
);

// Get all bulk uploads for a specific JD
router.get(
  '/jd/:jdId',
  validateRequest([
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
    query('status')
      .optional()
      .isIn(['PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL'])
      .withMessage('Invalid status value'),
  ]),
  bulkController.getBulkUploadsByJD
);

// Get all bulk uploads (admin view)
router.get(
  '/all',
  authorize('ADMIN', 'HR'),
  validateRequest([
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL'])
      .withMessage('Invalid status value'),
  ]),
  bulkController.getAllBulkUploads
);

// Mark eligible candidates based on JD criteria
router.post(
  '/mark-eligible/:jdId',
  authorize('ADMIN', 'HR'),
  validateRequest([
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ]),
  bulkController.markEligibleCandidates
);

// Re-process failed bulk upload
router.post(
  '/retry/:id',
  authorize('ADMIN', 'HR'),
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid upload ID is required'),
  ]),
  bulkController.retryBulkUpload
);

// Delete bulk upload record
router.delete(
  '/:id',
  authorize('ADMIN', 'HR'),
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid upload ID is required'),
  ]),
  bulkController.deleteBulkUpload
);

// Download error log for failed uploads
router.get(
  '/:id/error-log',
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid upload ID is required'),
  ]),
  bulkController.downloadErrorLog
);

// Download sample CSV template
router.get(
  '/sample-csv',
  bulkController.downloadSampleCSV
);

// Download sample CSV with all optional fields
router.get(
  '/sample-csv-extended',
  bulkController.downloadExtendedSampleCSV
);

// Validate CSV before upload (preview)
router.post(
  '/validate',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  upload.single('file'),
  validateRequest([
    body('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ]),
  bulkController.validateCSV
);

export default router;
