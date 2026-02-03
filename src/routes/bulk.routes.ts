// src/routes/bulk.routes.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import multer from 'multer';
import * as bulkController from '../controllers/bulk.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticate);

router.post(
  '/upload',
  authorize('ADMIN', 'HR'),
  upload.single('file'),
  [body('jdId').isUUID()],
  validateRequest,
  bulkController.bulkUploadCandidates
);

router.get(
  '/status/:id',
  [param('id').isUUID()],
  validateRequest,
  bulkController.getBulkUploadStatus
);

router.get('/jd/:jdId', bulkController.getBulkUploadsByJD);

router.post(
  '/mark-eligible/:jdId',
  authorize('ADMIN', 'HR'),
  [param('jdId').isUUID()],
  validateRequest,
  bulkController.markEligibleCandidates
);

router.get('/sample-csv', bulkController.downloadSampleCSV);

export default router;
