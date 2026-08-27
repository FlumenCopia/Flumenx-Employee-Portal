import { Router } from 'express';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeDocuments,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
} from '../controllers/employeeController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(authenticateToken);

router.get('/?', requirePermission('employees', 'canView'), getEmployees);
router.post('/?', requirePermission('employees', 'canCreate'), createEmployee);
router.get('/:id/?', requirePermission('employees', 'canView'), getEmployeeById);
router.put('/:id/?', requirePermission('employees', 'canEdit'), updateEmployee);
router.patch('/:id/?', requirePermission('employees', 'canEdit'), updateEmployee);
router.delete('/:id/?', requirePermission('employees', 'canDelete'), deleteEmployee);

// Employee Document Routes
router.get('/:id/documents/?', requirePermission('employees', 'canView'), getEmployeeDocuments);
router.post('/:id/documents/?', requirePermission('employees', 'canEdit'), upload.single('file'), uploadEmployeeDocument);
router.delete('/:id/documents/:docId/?', requirePermission('employees', 'canDelete'), deleteEmployeeDocument);

export default router;

