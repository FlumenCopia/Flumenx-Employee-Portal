import { Router } from 'express';
import {
  getAttendancePolicyHandler,
  updateAttendancePolicyHandler,
  getAttendanceRecords,
  getAttendanceSummary,
  getMonthlyStatistics,
  getAttendanceMatrixReport,
  exportAttendanceCSV,
  checkInAttendance,
  checkOutAttendance,
  getAttendanceCorrections,
  createAttendanceCorrection,
  updateAttendanceCorrection,
  triggerForcedCheckoutHandler,
  adjustAttendanceTimeHandler,
  createManualAttendanceRecord,
  deleteAttendanceRecord,
  deleteAttendanceCorrection,
} from '../controllers/attendanceController.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Policy
router.get('/attendance-policy/?', requirePermission('attendance', 'canView'), getAttendancePolicyHandler);
router.put('/attendance-policy/?', requirePermission('attendance', 'canEdit'), updateAttendancePolicyHandler);
router.patch('/attendance-policy/?', requirePermission('attendance', 'canEdit'), updateAttendancePolicyHandler);

// Sub-actions
router.get('/attendance/summary/?', requirePermission('attendance', 'canView'), getAttendanceSummary);
router.get('/attendance/monthly-statistics/?', requirePermission('attendance', 'canView'), getMonthlyStatistics);
router.get('/attendance/matrix-report/?', requirePermission('attendance', 'canView'), getAttendanceMatrixReport);
router.get('/attendance/export/?', requirePermission('attendance', 'canView'), exportAttendanceCSV);
router.post('/attendance/check-in/?', requirePermission('attendance', 'canView'), upload.single('photo'), checkInAttendance);
router.post('/attendance/check-out/?', requirePermission('attendance', 'canView'), checkOutAttendance);
router.post('/attendance/forced-checkout/?', requirePermission('attendance', 'canEdit'), triggerForcedCheckoutHandler);
router.patch('/attendance/:id/adjust-time/?', requirePermission('attendance', 'canEdit'), adjustAttendanceTimeHandler);
router.put('/attendance/:id/adjust-time/?', requirePermission('attendance', 'canEdit'), adjustAttendanceTimeHandler);
router.patch('/attendance/:id/adjust/?', requirePermission('attendance', 'canEdit'), adjustAttendanceTimeHandler);
router.post('/attendance/:id/adjust/?', requirePermission('attendance', 'canEdit'), adjustAttendanceTimeHandler);

// Attendance Records - Admin Manual Create & Delete
router.post('/attendance/manual/?', requirePermission('attendance', 'canCreate'), createManualAttendanceRecord);
router.delete('/attendance/:id/?', requirePermission('attendance', 'canDelete'), deleteAttendanceRecord);

// Attendance Records - Standard Self Endpoints
router.get('/attendance/?', requirePermission('attendance', 'canView'), getAttendanceRecords);
router.post('/attendance/?', requirePermission('attendance', 'canView'), upload.single('photo'), checkInAttendance);
router.put('/attendance/:id/?', requirePermission('attendance', 'canView'), checkOutAttendance);
router.patch('/attendance/:id/?', requirePermission('attendance', 'canView'), checkOutAttendance);

// Attendance Corrections
router.get('/attendance-corrections/?', requirePermission('attendance', 'canView'), getAttendanceCorrections);
router.post('/attendance-corrections/?', requirePermission('attendance', 'canView'), createAttendanceCorrection);
router.put('/attendance-corrections/:id/?', requirePermission('attendance', 'canEdit'), updateAttendanceCorrection);
router.patch('/attendance-corrections/:id/?', requirePermission('attendance', 'canEdit'), updateAttendanceCorrection);
router.delete('/attendance-corrections/:id/?', requirePermission('attendance', 'canDelete'), deleteAttendanceCorrection);

export default router;
