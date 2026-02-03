// src/routes/feedback.routes.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import * as feedbackController from '../controllers/feedback.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  [
    body('candidateId').isUUID(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comments').notEmpty(),
  ],
  validateRequest,
  feedbackController.createFeedback
);

router.get('/candidate/:candidateId', feedbackController.getFeedbacksByCandidate);

router.get('/jd/:jdId', feedbackController.getFeedbacksByJD);

router.get(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  feedbackController.getFeedbackById
);

router.put(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  feedbackController.updateFeedback
);

router.delete(
  '/:id',
  [param('id').isUUID()],
  validateRequest,
  feedbackController.deleteFeedback
);

export default router;
