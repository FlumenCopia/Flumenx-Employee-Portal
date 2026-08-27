import { Router } from 'express';
import { getLeaves, createLeave, updateLeave, decideLeave, deleteLeave } from '../controllers/leaveController.js';
import { getSalarySlips, createSalarySlip, generateSalarySlip, downloadSalarySlip, deleteSalarySlip } from '../controllers/salaryController.js';
import {
  getMeetings,
  getMeetingByCode,
  getMeetingChatHistory,
  createMeeting,
  endMeeting,
  deleteMeeting,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsRead,
  getAuditLogs,
} from '../controllers/communicationController.js';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { getReportsData } from '../controllers/reportsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Dashboard
router.get('/dashboard/?', getDashboardStats);

// Leaves
router.get('/leaves/?', requirePermission('leaves', 'canView'), getLeaves);
router.post('/leaves/?', requirePermission('leaves', 'canCreate'), createLeave);
router.put('/leaves/:id/?', requirePermission('leaves', 'canEdit'), updateLeave);
router.patch('/leaves/:id/?', requirePermission('leaves', 'canEdit'), updateLeave);
router.post('/leaves/:id/decide/?', requirePermission('leaves', 'canEdit'), decideLeave);
router.delete('/leaves/:id/?', requirePermission('leaves', 'canDelete'), deleteLeave);

// Salary Slips
router.get('/salary-slips/?', requirePermission('salary_slips', 'canView'), getSalarySlips);
router.get('/salary-slips/:id/download/?', requirePermission('salary_slips', 'canView'), downloadSalarySlip);
router.post('/salary-slips/generate/?', requirePermission('salary_slips', 'canCreate'), generateSalarySlip);
router.post('/salary-slips/?', requirePermission('salary_slips', 'canCreate'), upload.single('file'), createSalarySlip);
router.delete('/salary-slips/:id/?', requirePermission('salary_slips', 'canDelete'), deleteSalarySlip);

// Meetings
router.get('/meetings/?', requirePermission('meetings', 'canView'), getMeetings);
router.get('/meetings/code/:code/?', getMeetingByCode);
router.get('/meetings/code/:code/messages/?', getMeetingChatHistory);
router.post('/meetings/code/:code/end/?', endMeeting);
router.post('/meetings/?', requirePermission('meetings', 'canCreate'), createMeeting);
router.delete('/meetings/:id/?', requirePermission('meetings', 'canDelete'), deleteMeeting);

// Announcements
router.get('/announcements/?', requirePermission('announcements', 'canView'), getAnnouncements);
router.post('/announcements/?', requirePermission('announcements', 'canCreate'), createAnnouncement);
router.delete('/announcements/:id/?', requirePermission('announcements', 'canDelete'), deleteAnnouncement);

// Notifications
router.get('/notifications/unread-count/?', getUnreadNotificationCount);
router.post('/notifications/mark-all-read/?', markAllNotificationsRead);
router.get('/notifications/?', getNotifications);
router.post('/notifications/:id/read/?', markNotificationAsRead);

// Audit Logs
router.get('/audit-logs/?', requirePermission('audit_logs', 'canView'), getAuditLogs);

// Enterprise Reports Center
router.get('/reports/?', requirePermission('reports', 'canView'), getReportsData);

export default router;
