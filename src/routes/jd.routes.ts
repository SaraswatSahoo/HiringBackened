// src/routes/jd.routes.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import * as jdController from '../controllers/jd.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('ADMIN', 'HR'),
  [
    body('title').notEmpty().trim(),
    body('description').notEmpty(),
    body('department').notEmpty().trim(),
    body('hiringType').isIn(['BULK', 'NORMAL']),
    body('openings').optional().isInt({ min: 1 }),
  ],
  validateRequest,
  jdController.createJD
);

router.get('/', jdController.getAllJDs);

router.get(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  jdController.getJDById
);

router.put(
  '/:id',
  authorize('ADMIN', 'HR'),
  [param('id').isUUID()],
  validateRequest,
  jdController.updateJD
);

router.delete(
  '/:id',
  authorize('ADMIN', 'HR'),
  [param('id').isUUID()],
  validateRequest,
  jdController.deleteJD
);

router.patch(
  '/:id/status',
  authorize('ADMIN', 'HR'),
  [
    param('id').isUUID(),
    body('status').isIn(['ACTIVE', 'PAUSED', 'CLOSED', 'DRAFT']),
  ],
  validateRequest,
  jdController.updateJDStatus
);

router.get(
  '/:id/stages',
  [param('id').isUUID()],
  validateRequest,
  jdController.getJDStages
);

export default router;
