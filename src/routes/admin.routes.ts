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
  validateRequest([param('id').isUUID()]),
  adminController.getUserById
);

router.post(
  '/users',
  validateRequest([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty().trim(),
    body('role').isIn(['ADMIN', 'HR', 'RECRUITER']),
  ]),
  adminController.createUser
);

router.put(
  '/users/:id',
  validateRequest([param('id').isUUID()]),
  adminController.updateUser
);

router.delete(
  '/users/:id',
  validateRequest([param('id').isUUID()]),
  adminController.deleteUser
);

router.post(
  '/users/:id/reset-password',
  validateRequest([
    param('id').isUUID(),
    body('newPassword').isLength({ min: 8 }),
  ]),
  adminController.resetUserPassword
);

router.get('/activity-logs', adminController.getActivityLogs);

export default router;
