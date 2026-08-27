import { Router } from 'express';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getPortalPages,
  createPortalPage,
  updatePortalPage,
  deletePortalPage,
  getDynamicRoles,
  createDynamicRole,
  updateDynamicRole,
  deleteDynamicRole,
  getRolePermissionMatrix,
  updateRolePermissionMatrix,
  getDynamicNavigationMe,
  getSuperAdminUsers,
  createSuperAdminUser,
  updateSuperAdminUser,
  resetSuperAdminUserPassword,
  deleteSuperAdminUser,
} from '../controllers/portalController.js';
import { authenticateToken } from '../middleware/auth.js';

import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Navigation for logged-in user
router.get('/portal/navigation/me/?', getDynamicNavigationMe);

// Departments
router.get('/portal/departments/?', getDepartments);
router.post('/portal/departments/?', requirePermission('settings_access', 'canEdit'), createDepartment);
router.put('/portal/departments/:id/?', requirePermission('settings_access', 'canEdit'), updateDepartment);
router.delete('/portal/departments/:id/?', requirePermission('settings_access', 'canDelete'), deleteDepartment);

// Pages
router.get('/portal/pages/?', requirePermission('page_management', 'canView'), getPortalPages);
router.post('/portal/pages/?', requirePermission('page_management', 'canCreate'), createPortalPage);
router.put('/portal/pages/:id/?', requirePermission('page_management', 'canEdit'), updatePortalPage);
router.delete('/portal/pages/:id/?', requirePermission('page_management', 'canDelete'), deletePortalPage);

// Dynamic Roles & Matrix
router.get('/portal/roles/?', requirePermission('roles', 'canView'), getDynamicRoles);
router.post('/portal/roles/?', requirePermission('roles', 'canCreate'), createDynamicRole);
router.put('/portal/roles/:id/?', requirePermission('roles', 'canEdit'), updateDynamicRole);
router.patch('/portal/roles/:id/?', requirePermission('roles', 'canEdit'), updateDynamicRole);
router.delete('/portal/roles/:id/?', requirePermission('roles', 'canDelete'), deleteDynamicRole);
router.get('/portal/roles/:roleId/permissions/?', requirePermission('roles', 'canView'), getRolePermissionMatrix);
router.put('/portal/roles/:roleId/permissions/?', requirePermission('roles', 'canEdit'), updateRolePermissionMatrix);
router.patch('/portal/roles/:roleId/permissions/?', requirePermission('roles', 'canEdit'), updateRolePermissionMatrix);
router.post('/portal/roles/:roleId/permissions/?', requirePermission('roles', 'canEdit'), updateRolePermissionMatrix);

// SuperAdmin Users
router.get('/portal/super-admin/users/?', requirePermission('super_admin_users', 'canView'), getSuperAdminUsers);
router.post('/portal/super-admin/users/?', requirePermission('super_admin_users', 'canCreate'), createSuperAdminUser);
router.put('/portal/super-admin/users/:id/?', requirePermission('super_admin_users', 'canEdit'), updateSuperAdminUser);
router.patch('/portal/super-admin/users/:id/?', requirePermission('super_admin_users', 'canEdit'), updateSuperAdminUser);
router.post('/portal/super-admin/users/:id/password/?', requirePermission('super_admin_users', 'canEdit'), resetSuperAdminUserPassword);
router.delete('/portal/super-admin/users/:id/?', requirePermission('super_admin_users', 'canDelete'), deleteSuperAdminUser);

export default router;
