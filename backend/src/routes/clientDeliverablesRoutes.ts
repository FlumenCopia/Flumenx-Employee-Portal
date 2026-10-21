import { Router } from 'express';
import {
  getClientDeliverables,
  getYearlyDeliverablesReport,
  createClientDeliverable,
  updateClientDeliverable,
  logDeliveredItem,
  deleteDeliveredItem,
  copyMonthTargets,
  deleteClientDeliverable,
  seedFromExcelHandler,
} from '../controllers/clientDeliverablesController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Reports & Lists
router.get('/client-deliverables/?', requirePermission('client_deliverables', 'canView'), getClientDeliverables);
router.get('/client-deliverables/yearly/?', requirePermission('client_deliverables', 'canView'), getYearlyDeliverablesReport);

// Creation & Batch Copies
router.post('/client-deliverables/?', requirePermission('client_deliverables', 'canCreate'), createClientDeliverable);
router.post('/client-deliverables/copy-month/?', requirePermission('client_deliverables', 'canCreate'), copyMonthTargets);
router.post('/client-deliverables/seed-from-excel/?', requirePermission('client_deliverables', 'canCreate'), seedFromExcelHandler);

// Single Item Mutations
router.put('/client-deliverables/:id/?', requirePermission('client_deliverables', 'canEdit'), updateClientDeliverable);
router.patch('/client-deliverables/:id/?', requirePermission('client_deliverables', 'canEdit'), updateClientDeliverable);
router.delete('/client-deliverables/:id/?', requirePermission('client_deliverables', 'canDelete'), deleteClientDeliverable);

// Logging individual delivered deliverables with post reference URL
router.post('/client-deliverables/:id/log-item/?', requirePermission('client_deliverables', 'canEdit'), logDeliveredItem);
router.patch('/client-deliverables/:id/log-item/?', requirePermission('client_deliverables', 'canEdit'), logDeliveredItem);
router.delete('/client-deliverables/:id/items/:itemId/?', requirePermission('client_deliverables', 'canEdit'), deleteDeliveredItem);

export default router;
