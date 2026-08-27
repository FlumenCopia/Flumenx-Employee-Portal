import { Router } from 'express';
import {
  getKPIDashboard,
  getMyKPI,
  getEmployeeKPI,
  saveKPIRating,
  exportKPICSV,
} from '../controllers/kpiController.js';
import { authenticateToken } from '../middleware/auth.js';

import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

router.get('/kpi/dashboard/?', requirePermission('kpi', 'canView'), getKPIDashboard);
router.get('/kpi/my-kpi/?', getMyKPI);
router.get('/kpi/employee/:employeeId/?', requirePermission('kpi', 'canView'), getEmployeeKPI);
router.post('/kpi/rating/?', requirePermission('kpi', 'canEdit'), saveKPIRating);
router.get('/kpi/export-csv/?', requirePermission('kpi', 'canView'), exportKPICSV);

export default router;
