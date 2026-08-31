import { Router } from 'express';
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  getClientKPIHealthHandler,
  getWorkAssignments,
  getWorkAssignmentsSummary,
  getWorkAssignmentById,
  createWorkAssignment,
  bulkCreateWorkAssignments,
  updateWorkAssignment,
  reviewWorkAssignment,
  deleteWorkAssignment,
  startTaskTimer,
  stopTaskTimer,
  adjustTaskTime,
  getWorkDeliverables,
  createWorkDeliverable,
  getWorkEmployeeOptions,
  getWorkReviewerOptions,
  getShareLinks,
  createShareLinkHandler,
  revokeShareLink,
  regenerateShareLink,
  getPublicWorkProgress,
  incrementDeliverable,
} from '../controllers/workController.js';
import { authenticateToken } from '../middleware/auth.js';
import { getDepartments } from '../controllers/portalController.js';

import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// Public endpoint
router.get('/public/work-progress/:token/?', getPublicWorkProgress);

// Authenticated routes
router.use(authenticateToken);

// Clients
router.get('/clients/?', requirePermission('clients', 'canView'), getClients);
router.post('/clients/?', requirePermission('clients', 'canCreate'), createClient);
router.get('/clients/:id/kpi-health/?', requirePermission('clients', 'canView'), getClientKPIHealthHandler);
router.put('/clients/:id/?', requirePermission('clients', 'canEdit'), updateClient);
router.delete('/clients/:id/?', requirePermission('clients', 'canDelete'), deleteClient);

// Work Assignments
router.get('/work-assignments/summary/?', requirePermission('tasks', 'canView'), getWorkAssignmentsSummary);
router.get('/work-assignments/?', requirePermission('tasks', 'canView'), getWorkAssignments);
router.post('/work-assignments/bulk-create/?', requirePermission('tasks', 'canCreate'), bulkCreateWorkAssignments);
router.post('/work-assignments/?', requirePermission('tasks', 'canCreate'), createWorkAssignment);
router.get('/work-assignments/:id/?', requirePermission('tasks', 'canView'), getWorkAssignmentById);
router.post('/work-assignments/:id/start-timer/?', requirePermission('timer', 'canView'), startTaskTimer);
router.post('/work-assignments/:id/stop-timer/?', requirePermission('timer', 'canView'), stopTaskTimer);
router.post('/work-assignments/:id/adjust-time/?', requirePermission('tasks', 'canEdit'), adjustTaskTime);
router.put('/work-assignments/:id/?', requirePermission('tasks', 'canEdit'), updateWorkAssignment);
router.patch('/work-assignments/:id/?', requirePermission('tasks', 'canEdit'), updateWorkAssignment);
router.post('/work-assignments/:id/review/?', requirePermission('tasks', 'canEdit'), reviewWorkAssignment);
router.post('/work-assignments/:id/deliverables/:deliverableId/increment/?', requirePermission('tasks', 'canEdit'), incrementDeliverable);
router.delete('/work-assignments/:id/?', requirePermission('tasks', 'canDelete'), deleteWorkAssignment);

// Work Deliverables
router.get('/work-deliverables/?', requirePermission('tasks', 'canView'), getWorkDeliverables);
router.post('/work-deliverables/?', requirePermission('tasks', 'canCreate'), createWorkDeliverable);

// Helper Options
router.get('/departments/?', getDepartments);
router.get('/work-employee-options/?', getWorkEmployeeOptions);
router.get('/work-reviewer-options/?', getWorkReviewerOptions);

// Share Links
router.get('/work-share-links/?', requirePermission('clients', 'canView'), getShareLinks);
router.post('/work-share-links/?', requirePermission('clients', 'canCreate'), createShareLinkHandler);
router.post('/work-share-links/:id/revoke/?', requirePermission('clients', 'canEdit'), revokeShareLink);
router.post('/work-share-links/:id/regenerate/?', requirePermission('clients', 'canEdit'), regenerateShareLink);

export default router;
