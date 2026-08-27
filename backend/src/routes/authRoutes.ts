import { Router } from 'express';
import {
  login,
  register,
  logout,
  refresh,
  getMe,
  passwordResetRequest,
  passwordResetConfirm,
} from '../controllers/authController.js';
import { handleCsrfEndpoint } from '../middleware/csrf.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/login/?', login);
router.post('/register/?', register);
router.post('/logout/?', logout);
router.post('/refresh/?', refresh);
router.get('/csrf/?', handleCsrfEndpoint);
router.get('/me/?', authenticateToken, getMe);
router.post('/password-reset/?', passwordResetRequest);
router.post('/password-reset/confirm/?', passwordResetConfirm);

export default router;
