// src/routes/communication.routes.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import * as communicationController from '../controllers/communication.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

router.use(authenticate);

router.post(
  '/send',
  authorize('ADMIN', 'HR'),
  [
    body('jdId').isUUID(),
    body('channel').isIn(['EMAIL', 'WHATSAPP', 'SMS']),
    body('message').notEmpty(),
  ],
  validateRequest,
  communicationController.sendBulkCommunication
);

router.get('/jd/:jdId', communicationController.getCommunicationsByJD);

router.get(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  communicationController.getCommunicationDetails
);

// Template routes
router.post(
  '/templates',
  authorize('ADMIN', 'HR'),
  [
    body('name').notEmpty().trim(),
    body('channel').isIn(['EMAIL', 'WHATSAPP', 'SMS']),
    body('category').notEmpty(),
    body('body').notEmpty(),
  ],
  validateRequest,
  communicationController.createTemplate
);

router.get('/templates', communicationController.getTemplates);

router.put(
  '/templates/:id',
  authorize('ADMIN', 'HR'),
  [param('id').isUUID()],
  validateRequest,
  communicationController.updateTemplate
);

router.delete(
  '/templates/:id',
  authorize('ADMIN', 'HR'),
  [param('id').isUUID()],
  validateRequest,
  communicationController.deleteTemplate
);

export default router;
