import { Router } from 'express';
import { body, param } from 'express-validator';
import * as communicationController from '../controllers/communication.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('ADMIN', 'HR'),
  validateRequest([
    body('jdId').isUUID(),
    body('channel').isIn(['EMAIL']),
    body('subject').optional().trim(),
    body('message').notEmpty(),
    body('candidateIds').isArray({ min: 1 }),
  ]),
  communicationController.createCommunication
);

router.get(
  '/jd/:jdId',
  validateRequest([param('jdId').isUUID()]),
  communicationController.getCommunicationsByJD
);

router.get(
  '/:id',
  validateRequest([param('id').isUUID()]),
  communicationController.getCommunicationById
);

export default router;
