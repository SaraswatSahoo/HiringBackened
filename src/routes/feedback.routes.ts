import { Router } from 'express';
import { body, param } from 'express-validator';
import * as feedbackController from '../controllers/feedback.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validateRequest([
    body('candidateId').isUUID(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comments').notEmpty(),
  ]),
  feedbackController.createFeedback
);

router.get(
  '/candidate/:candidateId',
  validateRequest([param('candidateId').isUUID()]),
  feedbackController.getFeedbacksByCandidate
);

export default router;
