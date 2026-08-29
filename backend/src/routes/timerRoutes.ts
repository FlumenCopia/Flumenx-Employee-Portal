import { Router } from 'express';
import {
  getActiveTimer,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getTimeEntries,
  createManualTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
} from '../controllers/timerController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Timer Live Engine Routes
router.get('/active/?', authenticateToken, getActiveTimer);
router.post('/start/:id?/?', authenticateToken, startTimer);
router.post('/pause/:id?/?', authenticateToken, pauseTimer);
router.post('/resume/:id?/?', authenticateToken, resumeTimer);
router.post('/stop/:id?/?', authenticateToken, stopTimer);

// Time Entry History Routes
router.get('/entries/?', authenticateToken, getTimeEntries);
router.post('/entries/manual/?', authenticateToken, createManualTimeEntry);
router.put('/entries/:id/?', authenticateToken, updateTimeEntry);
router.patch('/entries/:id/?', authenticateToken, updateTimeEntry);
router.delete('/entries/:id/?', authenticateToken, deleteTimeEntry);

export default router;
