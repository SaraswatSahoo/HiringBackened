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
  validateRequest([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty().trim(),
    body('role').optional().isIn(['ADMIN', 'HR', 'RECRUITER']),
  ]),
  authController.register
);

router.post(
  '/login',
  strictLimiter,
  validateRequest([
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ]),
  authController.login
);

router.post(
  '/refresh-token',
  validateRequest([body('refreshToken').notEmpty()]),
  authController.refreshToken
);

router.get('/profile', authenticate, authController.getProfile);

router.put(
  '/profile',
  authenticate,
  validateRequest([
    body('name').optional().notEmpty().trim(),
    body('phone').optional().isMobilePhone('any'),
  ]),
  authController.updateProfile
);

router.post(
  '/change-password',
  authenticate,
  validateRequest([
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ]),
  authController.changePassword
);

export default router;
