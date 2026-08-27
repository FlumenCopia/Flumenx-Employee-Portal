import { Request, Response, NextFunction } from 'express';
import { DynamicRole, IDynamicRole } from '../models/DynamicRole.js';
import { PortalPage } from '../models/PortalPage.js';

export const defaultRolePermissions: Record<string, string[]> = {
  EMPLOYEE: ['TASKS', 'KPI', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'TIMER'],
  TEAM_LEAD: ['TASKS', 'TEAM_WORK', 'KPI', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'TIMER'],
  BDE: ['TASKS', 'CLIENTS', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'TIMER'],
  ACCOUNTANT: ['TASKS', 'ATTENDANCE', 'LEAVES', 'SALARY_SLIPS', 'MEETINGS', 'ANNOUNCEMENTS', 'TIMER'],
  HR: ['TASKS', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'KPI', 'SALARY_SLIPS', 'ANNOUNCEMENTS', 'TIMER'],
  ADMIN: ['TASKS', 'TEAM_WORK', 'KPI', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'SALARY_SLIPS', 'ROLES', 'SUPER_ADMIN_USERS', 'PAGE_MANAGEMENT', 'AUDIT_LOGS', 'SETTINGS_ACCESS', 'CLIENTS', 'TIMER'],
  OPERATIONS: ['TASKS', 'TEAM_WORK', 'KPI', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'SALARY_SLIPS', 'ROLES', 'SUPER_ADMIN_USERS', 'PAGE_MANAGEMENT', 'AUDIT_LOGS', 'SETTINGS_ACCESS', 'CLIENTS', 'TIMER'],
  OPERATIONS_HEAD: ['TASKS', 'TEAM_WORK', 'KPI', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'SALARY_SLIPS', 'ROLES', 'SUPER_ADMIN_USERS', 'PAGE_MANAGEMENT', 'AUDIT_LOGS', 'SETTINGS_ACCESS', 'CLIENTS', 'TIMER'],
};

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    if (req.user.role === 'SUPER_ADMIN' || req.user.isSuperuser) {
      return next();
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    res.status(403).json({ detail: 'You do not have permission to perform this action.' });
  };
}

export function requirePermission(moduleCode: string, action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ detail: 'Authentication required.' });
        return;
      }

      // Super admin always has full access
      if (req.user.role === 'SUPER_ADMIN' || req.user.isSuperuser) {
        return next();
      }

      const normalizedCode = moduleCode.trim().toUpperCase();

      // Check dynamic role if attached to user
      if (req.user.dynamicRole) {
        const dynamicRole = await DynamicRole.findById(req.user.dynamicRole).populate('permissions.page');

        if (dynamicRole) {
          if (dynamicRole.isSuperadminWildcard) {
            return next();
          }

          const targetPage = await PortalPage.findOne({
            $or: [
              { moduleCode: normalizedCode },
              { moduleCode: moduleCode.trim() }
            ]
          });

          if (targetPage) {
            const permissionEntry = dynamicRole.permissions.find(
              (p) => p.page && p.page.toString() === targetPage._id.toString()
            );

            if (permissionEntry && permissionEntry[action]) {
              return next();
            }
          }
        }
      }

      // Standard role fallback checks synchronized with portalController.ts ROLE_ALLOWED_MODULES
      const userRole = (req.user.role || 'EMPLOYEE').toUpperCase();
      const allowedModules = defaultRolePermissions[userRole] || ['TASKS', 'ATTENDANCE', 'LEAVES', 'MEETINGS'];

      if (allowedModules.includes(normalizedCode) || allowedModules.includes(moduleCode)) {
        return next();
      }

      res.status(403).json({ detail: `Permission denied for ${normalizedCode}:${action}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
