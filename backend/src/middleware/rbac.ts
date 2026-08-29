import { Request, Response, NextFunction } from 'express';
import { DynamicRole } from '../models/DynamicRole.js';
import { PortalPage } from '../models/PortalPage.js';

export type PermissionAction = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';

export interface ActionPerms {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const READ_ONLY: ActionPerms = { canView: true, canCreate: false, canEdit: false, canDelete: false };
const FULL_ACCESS: ActionPerms = { canView: true, canCreate: true, canEdit: true, canDelete: true };
const MANAGE_NO_DELETE: ActionPerms = { canView: true, canCreate: true, canEdit: true, canDelete: false };
const VIEW_CREATE: ActionPerms = { canView: true, canCreate: true, canEdit: false, canDelete: false };
const SELF_OPERATIONS: ActionPerms = { canView: true, canCreate: true, canEdit: true, canDelete: false };

export const defaultRoleActionMatrix: Record<string, Record<string, ActionPerms>> = {
  SUPER_ADMIN: {}, // Wildcard handled directly
  ADMIN: {
    TASKS: FULL_ACCESS,
    TEAM_WORK: FULL_ACCESS,
    KPI: FULL_ACCESS,
    EMPLOYEES: FULL_ACCESS,
    ATTENDANCE: FULL_ACCESS,
    LEAVES: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    ANNOUNCEMENTS: FULL_ACCESS,
    SALARY_SLIPS: FULL_ACCESS,
    CLIENTS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    ROLES: READ_ONLY,
    SUPER_ADMIN_USERS: READ_ONLY,
    PAGE_MANAGEMENT: READ_ONLY,
    AUDIT_LOGS: READ_ONLY,
    SETTINGS_ACCESS: READ_ONLY,
  },
  OPERATIONS: {
    TASKS: FULL_ACCESS,
    TEAM_WORK: FULL_ACCESS,
    KPI: FULL_ACCESS,
    EMPLOYEES: MANAGE_NO_DELETE,
    ATTENDANCE: FULL_ACCESS,
    LEAVES: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    ANNOUNCEMENTS: FULL_ACCESS,
    SALARY_SLIPS: READ_ONLY,
    CLIENTS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
  },
  OPERATIONS_HEAD: {
    TASKS: FULL_ACCESS,
    TEAM_WORK: FULL_ACCESS,
    KPI: FULL_ACCESS,
    EMPLOYEES: MANAGE_NO_DELETE,
    ATTENDANCE: FULL_ACCESS,
    LEAVES: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    ANNOUNCEMENTS: FULL_ACCESS,
    SALARY_SLIPS: READ_ONLY,
    CLIENTS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
  },
  HR: {
    EMPLOYEES: MANAGE_NO_DELETE,
    ATTENDANCE: FULL_ACCESS,
    LEAVES: FULL_ACCESS,
    SALARY_SLIPS: FULL_ACCESS,
    KPI: FULL_ACCESS,
    TASKS: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    ANNOUNCEMENTS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    CLIENTS: READ_ONLY,
  },
  ACCOUNTANT: {
    SALARY_SLIPS: FULL_ACCESS,
    ATTENDANCE: READ_ONLY,
    LEAVES: READ_ONLY,
    REPORTS: FULL_ACCESS,
    TASKS: SELF_OPERATIONS,
    MEETINGS: FULL_ACCESS,
    ANNOUNCEMENTS: READ_ONLY,
    TIMER: FULL_ACCESS,
  },
  TEAM_LEAD: {
    TEAM_WORK: FULL_ACCESS,
    TASKS: FULL_ACCESS,
    EMPLOYEES: READ_ONLY,
    ATTENDANCE: VIEW_CREATE,
    LEAVES: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    KPI: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    ANNOUNCEMENTS: READ_ONLY,
    TIMER: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    CLIENTS: READ_ONLY,
  },
  BDE: {
    CLIENTS: FULL_ACCESS,
    TASKS: SELF_OPERATIONS,
    ATTENDANCE: VIEW_CREATE,
    LEAVES: VIEW_CREATE,
    MEETINGS: FULL_ACCESS,
    ANNOUNCEMENTS: READ_ONLY,
    TIMER: FULL_ACCESS,
    SALARY_SLIPS: READ_ONLY,
    REPORTS: READ_ONLY,
  },
  BDO: {
    CLIENTS: FULL_ACCESS,
    TASKS: SELF_OPERATIONS,
    ATTENDANCE: VIEW_CREATE,
    LEAVES: VIEW_CREATE,
    MEETINGS: FULL_ACCESS,
    ANNOUNCEMENTS: READ_ONLY,
    TIMER: FULL_ACCESS,
    SALARY_SLIPS: READ_ONLY,
    REPORTS: READ_ONLY,
  },
  EMPLOYEE: {
    TASKS: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    ATTENDANCE: VIEW_CREATE,
    LEAVES: VIEW_CREATE,
    KPI: READ_ONLY,
    MEETINGS: FULL_ACCESS,
    ANNOUNCEMENTS: READ_ONLY,
    TIMER: FULL_ACCESS,
    EMPLOYEES: READ_ONLY,
    SALARY_SLIPS: READ_ONLY,
    REPORTS: READ_ONLY,
  },
};

export const defaultRolePermissions: Record<string, string[]> = Object.fromEntries(
  Object.entries(defaultRoleActionMatrix).map(([role, modules]) => [
    role,
    Object.keys(modules).filter((mod) => modules[mod].canView),
  ])
);

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

export function requirePermission(moduleCode: string, action: PermissionAction = 'canView') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ detail: 'Authentication required.' });
        return;
      }

      // Super admin and Superuser always have full wildcard bypass
      if (req.user.role === 'SUPER_ADMIN' || req.user.isSuperuser) {
        return next();
      }

      const normalizedCode = moduleCode.trim().toUpperCase();

      // 1. Dynamic Role Evaluation (Custom role assigned to user)
      if (req.user.dynamicRole) {
        const dynamicRole = await DynamicRole.findById(req.user.dynamicRole).populate('permissions.page');

        if (dynamicRole) {
          if (dynamicRole.isSuperadminWildcard) {
            return next();
          }

          const targetPage = await PortalPage.findOne({
            $or: [
              { moduleCode: normalizedCode },
              { moduleCode: moduleCode.trim() },
            ],
          });

          if (targetPage) {
            const permissionEntry = dynamicRole.permissions.find((p) => {
              if (!p.page) return false;
              const pageIdStr = (p.page as any)._id ? (p.page as any)._id.toString() : p.page.toString();
              return pageIdStr === targetPage._id.toString();
            });

            if (permissionEntry && permissionEntry[action]) {
              return next();
            }
          }
        }
      }

      // 2. Standard System Role Action Matrix Evaluation
      const userRole = (req.user.role || 'EMPLOYEE').toUpperCase();
      const rolePerms = defaultRoleActionMatrix[userRole];

      if (rolePerms) {
        const modulePerm = rolePerms[normalizedCode];
        if (modulePerm && modulePerm[action]) {
          return next();
        }
      }

      res.status(403).json({
        detail: `Access denied. Your role '${userRole}' does not have '${action}' permission for module '${normalizedCode}'.`,
        code: 'permission_denied',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
