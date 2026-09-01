import { Router } from 'express';
import {
  goOnline,
  goOffline,
  recordLocation,
  getTrackingStatus,
  getLiveTracking,
  getDailyRoute,
  getDailySummary,
  getLocationHistory,
  getTrackingSessions,
  exportLocationHistoryCSV,
} from '../controllers/trackingController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Employee Self-Tracking Controls
router.post('/go-online/?', requirePermission('EMPLOYEE_TRACKING', 'canCreate'), goOnline);
router.post('/go-offline/?', requirePermission('EMPLOYEE_TRACKING', 'canCreate'), goOffline);
router.post('/location/?', requirePermission('EMPLOYEE_TRACKING', 'canCreate'), recordLocation);
router.get('/status/?', requirePermission('EMPLOYEE_TRACKING', 'canView'), getTrackingStatus);

// Manager / Live Map & Analytics Endpoints
router.get('/live/?', requirePermission('EMPLOYEE_TRACKING', 'canView'), getLiveTracking);
router.get('/route/?', requirePermission('EMPLOYEE_TRACKING', 'canView'), getDailyRoute);
router.get('/summary/?', requirePermission('EMPLOYEE_TRACKING', 'canView'), getDailySummary);
router.get('/history/?', requirePermission('EMPLOYEE_TRACKING', 'canView'), getLocationHistory);
router.get('/sessions/?', requirePermission('EMPLOYEE_TRACKING', 'canView'), getTrackingSessions);
router.get('/export/?', requirePermission('EMPLOYEE_TRACKING', 'canView'), exportLocationHistoryCSV);

export default router;
