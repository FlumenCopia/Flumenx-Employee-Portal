import { Router } from 'express';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projectController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/?', authenticateToken, getProjects);
router.post('/?', authenticateToken, createProject);
router.put('/:id/?', authenticateToken, updateProject);
router.delete('/:id/?', authenticateToken, deleteProject);

export default router;
