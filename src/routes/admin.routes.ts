// src/routes/admin.routes.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import * as adminController from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/users', adminController.getAllUsers);

router.get(
  '/users/:id',
  [param('id').isUUID()],
  validateRequest,
  adminController.getUserById
);

router.post(
  '/users',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty().trim(),
    body('role').isIn(['ADMIN', 'HR', 'RECRUITER']),
  ],
  validateRequest,
  adminController.createUser
);

router.put(
  '/users/:id',
  [param('id').isUUID()],
  validateRequest,
  adminController.updateUser
);

router.delete(
  '/users/:id',
  [param('id').isUUID()],
  validateRequest,
  adminController.deleteUser
);

router.post(
  '/users/:id/reset-password',
  [
    param('id').isUUID(),
    body('newPassword').isLength({ min: 8 }),
  ],
  validateRequest,
  adminController.resetUserPassword
);

router.get('/activity-logs', adminController.getActivityLogs);

export default router;
