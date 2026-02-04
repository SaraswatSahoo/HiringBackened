// src/routes/auth.routes.ts
import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { strictLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post(
  '/register',
  strictLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty().trim(),
    body('role').optional().isIn(['ADMIN', 'HR', 'RECRUITER']),
  ],
  validateRequest,
  authController.register
);

router.post(
  '/login',
  strictLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validateRequest,
  authController.login
);

router.post(
  '/refresh-token',
  [body('refreshToken').notEmpty()],
  validateRequest,
  authController.refreshToken
);

router.get('/profile', authenticate, authController.getProfile);

router.put(
  '/profile',
  authenticate,
  [
    body('name').optional().notEmpty().trim(),
    body('phone').optional().isMobilePhone('any'),
  ],
  validateRequest,
  authController.updateProfile
);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  validateRequest,
  authController.changePassword
);

export default router;
