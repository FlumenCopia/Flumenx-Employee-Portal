import { Router } from 'express';
import {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from '../controllers/holidayController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

router.get('/holidays/?', requirePermission('attendance', 'canView'), getHolidays);
router.get('/holidays/:id/?', requirePermission('attendance', 'canView'), getHolidayById);
router.post('/holidays/?', requirePermission('attendance', 'canCreate'), createHoliday);
router.put('/holidays/:id/?', requirePermission('attendance', 'canEdit'), updateHoliday);
router.patch('/holidays/:id/?', requirePermission('attendance', 'canEdit'), updateHoliday);
router.delete('/holidays/:id/?', requirePermission('attendance', 'canDelete'), deleteHoliday);

export default router;
