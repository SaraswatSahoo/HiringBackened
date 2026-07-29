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

router.get(
  '/jd/:jdId',
  validateRequest([param('jdId').isUUID()]),
  feedbackController.getFeedbacksByJD
);

router.get(
  '/:id',
  validateRequest([param('id').isUUID()]),
  feedbackController.getFeedbackById
);

router.put(
  '/:id',
  validateRequest([
    param('id').isUUID(),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('comments').optional().notEmpty(),
    body('technicalSkills').optional().isInt({ min: 1, max: 5 }),
    body('communication').optional().isInt({ min: 1, max: 5 }),
    body('cultureFit').optional().isInt({ min: 1, max: 5 }),
    body('problemSolving').optional().isInt({ min: 1, max: 5 }),
  ]),
  feedbackController.updateFeedback
);

router.delete(
  '/:id',
  validateRequest([param('id').isUUID()]),
  feedbackController.deleteFeedback
);

export default router;
