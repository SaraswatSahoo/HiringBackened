// src/routes/candidate.routes.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import multer from 'multer';
import * as candidateController from '../controllers/candidate.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticate);

router.post(
  '/',
  [
    body('jdId').isUUID(),
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('phone').notEmpty(),
  ],
  validateRequest,
  candidateController.createCandidate
);

router.get('/jd/:jdId', candidateController.getCandidatesByJD);

router.get(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  candidateController.getCandidateById
);

router.put(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  candidateController.updateCandidate
);

router.delete(
  '/:id',
  authorize('ADMIN', 'HR'),
  [param('id').isUUID()],
  validateRequest,
  candidateController.deleteCandidate
);

router.post(
  '/:id/move-stage',
  [
    param('id').isUUID(),
    body('stageId').isUUID(),
  ],
  validateRequest,
  candidateController.moveCandidateStage
);

router.post(
  '/:id/resume',
  upload.single('resume'),
  [param('id').isUUID()],
  validateRequest,
  candidateController.uploadResume
);

router.post(
  '/bulk-move',
  [
    body('candidateIds').isArray({ min: 1 }),
    body('stageId').isUUID(),
  ],
  validateRequest,
  candidateController.bulkMoveCandidates
);

export default router;
