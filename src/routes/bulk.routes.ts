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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
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
  authorize('ADMIN', 'HR'),
  upload.single('file'),
  [
    body('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ],
  validateRequest,
  bulkController.bulkUploadCandidates
);

// Get bulk upload status by upload ID
router.get(
  '/status/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Valid upload ID is required'),
  ],
  validateRequest,
  bulkController.getBulkUploadStatus
);

// Get all bulk uploads for a specific JD
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
  ],
  validateRequest,
  bulkController.getBulkUploadsByJD
);

// Mark eligible candidates based on JD criteria
router.post(
  '/mark-eligible/:jdId',
  authorize('ADMIN', 'HR'),
  [
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
  ],
  validateRequest,
  bulkController.markEligibleCandidates
);

// Download sample CSV template
router.get(
  '/sample-csv',
  bulkController.downloadSampleCSV
);

export default router;
