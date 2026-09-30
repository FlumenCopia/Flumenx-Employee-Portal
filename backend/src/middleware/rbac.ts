import { Request, Response, NextFunction } from 'express';
import { DynamicRole } from '../models/DynamicRole.js';
import { PortalPage } from '../models/PortalPage.js';
import { resolveUserPermissions } from '../services/permissionResolver.js';

export type PermissionAction = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';

export interface ActionPerms {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  dataScope?: string;
  features?: string[];
}

const READ_ONLY: ActionPerms = { canView: true, canCreate: false, canEdit: false, canDelete: false };
const FULL_ACCESS: ActionPerms = { canView: true, canCreate: true, canEdit: true, canDelete: true };
const MANAGE_NO_DELETE: ActionPerms = { canView: true, canCreate: true, canEdit: true, canDelete: false };
const VIEW_CREATE: ActionPerms = { canView: true, canCreate: true, canEdit: false, canDelete: false };
const SELF_OPERATIONS: ActionPerms = { canView: true, canCreate: true, canEdit: true, canDelete: false };

export const defaultRoleActionMatrix: Record<string, Record<string, ActionPerms>> = {
  SUPER_ADMIN: {}, // Wildcard handled directly
  ADMIN: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    TEAM_WORK: FULL_ACCESS,
    CLIENTS: FULL_ACCESS,
    CLIENT_TASKS: FULL_ACCESS,
    TIMELINE: FULL_ACCESS,
    KPI: FULL_ACCESS,
    EMPLOYEES: FULL_ACCESS,
    ATTENDANCE: FULL_ACCESS,
    EMPLOYEE_TRACKING: FULL_ACCESS,
    TRACKING: FULL_ACCESS,
    LEAVES: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    ROLES: READ_ONLY,
    SUPER_ADMIN_USERS: READ_ONLY,
    PAGE_MANAGEMENT: READ_ONLY,
    SALARY_SLIPS: FULL_ACCESS,
    ACCOUNTING: FULL_ACCESS,
    ANNOUNCEMENTS: FULL_ACCESS,
    AUDIT_LOGS: READ_ONLY,
    SETTINGS_ACCESS: READ_ONLY,
  },
  OPERATIONS: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    TEAM_WORK: FULL_ACCESS,
    CLIENTS: FULL_ACCESS,
    CLIENT_TASKS: FULL_ACCESS,
    TIMELINE: FULL_ACCESS,
    KPI: FULL_ACCESS,
    EMPLOYEES: MANAGE_NO_DELETE,
    ATTENDANCE: FULL_ACCESS,
    EMPLOYEE_TRACKING: FULL_ACCESS,
    TRACKING: FULL_ACCESS,
    LEAVES: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    SALARY_SLIPS: READ_ONLY,
    ANNOUNCEMENTS: FULL_ACCESS,
  },
  OPERATIONS_HEAD: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    TEAM_WORK: FULL_ACCESS,
    CLIENTS: FULL_ACCESS,
    CLIENT_TASKS: FULL_ACCESS,
    TIMELINE: FULL_ACCESS,
    KPI: FULL_ACCESS,
    EMPLOYEES: MANAGE_NO_DELETE,
    ATTENDANCE: FULL_ACCESS,
    EMPLOYEE_TRACKING: FULL_ACCESS,
    TRACKING: FULL_ACCESS,
    LEAVES: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    SALARY_SLIPS: READ_ONLY,
    ANNOUNCEMENTS: FULL_ACCESS,
  },
  HR: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    TEAM_WORK: FULL_ACCESS,
    CLIENTS: READ_ONLY,
    CLIENT_TASKS: FULL_ACCESS,
    TIMELINE: FULL_ACCESS,
    KPI: FULL_ACCESS,
    EMPLOYEES: MANAGE_NO_DELETE,
    ATTENDANCE: FULL_ACCESS,
    EMPLOYEE_TRACKING: FULL_ACCESS,
    TRACKING: FULL_ACCESS,
    LEAVES: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    SALARY_SLIPS: FULL_ACCESS,
    ANNOUNCEMENTS: FULL_ACCESS,
  },
  ACCOUNTANT: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: SELF_OPERATIONS,
    TIMER: FULL_ACCESS,
    TEAM_WORK: READ_ONLY,
    CLIENTS: READ_ONLY,
    CLIENT_TASKS: READ_ONLY,
    TIMELINE: READ_ONLY,
    KPI: READ_ONLY,
    EMPLOYEES: READ_ONLY,
    ATTENDANCE: READ_ONLY,
    EMPLOYEE_TRACKING: READ_ONLY,
    TRACKING: READ_ONLY,
    LEAVES: READ_ONLY,
    MEETINGS: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    SALARY_SLIPS: FULL_ACCESS,
    ACCOUNTING: MANAGE_NO_DELETE,
    ANNOUNCEMENTS: READ_ONLY,
  },
  CFO: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    TEAM_WORK: FULL_ACCESS,
    CLIENTS: FULL_ACCESS,
    CLIENT_TASKS: FULL_ACCESS,
    TIMELINE: FULL_ACCESS,
    KPI: FULL_ACCESS,
    EMPLOYEES: FULL_ACCESS,
    ATTENDANCE: FULL_ACCESS,
    EMPLOYEE_TRACKING: FULL_ACCESS,
    TRACKING: FULL_ACCESS,
    LEAVES: FULL_ACCESS,
    MEETINGS: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    SALARY_SLIPS: FULL_ACCESS,
    ACCOUNTING: MANAGE_NO_DELETE,
    ANNOUNCEMENTS: FULL_ACCESS,
    AUDIT_LOGS: READ_ONLY,
    SETTINGS_ACCESS: READ_ONLY,
  },
  TEAM_LEAD: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: FULL_ACCESS,
    TIMER: FULL_ACCESS,
    TEAM_WORK: FULL_ACCESS,
    CLIENTS: READ_ONLY,
    CLIENT_TASKS: FULL_ACCESS,
    TIMELINE: FULL_ACCESS,
    KPI: FULL_ACCESS,
    EMPLOYEES: READ_ONLY,
    ATTENDANCE: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    EMPLOYEE_TRACKING: FULL_ACCESS,
    TRACKING: FULL_ACCESS,
    LEAVES: { canView: true, canCreate: true, canEdit: true, canDelete: false },
    MEETINGS: FULL_ACCESS,
    REPORTS: FULL_ACCESS,
    SALARY_SLIPS: READ_ONLY,
    ANNOUNCEMENTS: READ_ONLY,
  },
  BDE: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: SELF_OPERATIONS,
    TIMER: FULL_ACCESS,
    TEAM_WORK: READ_ONLY,
    CLIENTS: FULL_ACCESS,
    CLIENT_TASKS: FULL_ACCESS,
    TIMELINE: READ_ONLY,
    KPI: READ_ONLY,
    EMPLOYEES: READ_ONLY,
    ATTENDANCE: VIEW_CREATE,
    EMPLOYEE_TRACKING: VIEW_CREATE,
    TRACKING: VIEW_CREATE,
    LEAVES: VIEW_CREATE,
    MEETINGS: FULL_ACCESS,
    REPORTS: READ_ONLY,
    SALARY_SLIPS: READ_ONLY,
    ANNOUNCEMENTS: READ_ONLY,
  },
  BDO: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: SELF_OPERATIONS,
    TIMER: FULL_ACCESS,
    TEAM_WORK: READ_ONLY,
    CLIENTS: FULL_ACCESS,
    CLIENT_TASKS: FULL_ACCESS,
    TIMELINE: READ_ONLY,
    KPI: READ_ONLY,
    EMPLOYEES: READ_ONLY,
    ATTENDANCE: VIEW_CREATE,
    EMPLOYEE_TRACKING: VIEW_CREATE,
    TRACKING: VIEW_CREATE,
    LEAVES: VIEW_CREATE,
    MEETINGS: FULL_ACCESS,
    REPORTS: READ_ONLY,
    SALARY_SLIPS: READ_ONLY,
    ANNOUNCEMENTS: READ_ONLY,
  },
  EMPLOYEE: {
    COMMAND_CENTER: FULL_ACCESS,
    TOOLS: FULL_ACCESS,
    CHAT: FULL_ACCESS,
    TASKS: { canView: true, canCreate: false, canEdit: true, canDelete: false },
    TIMER: FULL_ACCESS,
    TEAM_WORK: READ_ONLY,
    CLIENTS: READ_ONLY,
    CLIENT_TASKS: READ_ONLY,
    TIMELINE: READ_ONLY,
    KPI: READ_ONLY,
    EMPLOYEES: READ_ONLY,
    ATTENDANCE: VIEW_CREATE,
    EMPLOYEE_TRACKING: VIEW_CREATE,
    TRACKING: VIEW_CREATE,
    LEAVES: VIEW_CREATE,
    MEETINGS: FULL_ACCESS,
    REPORTS: READ_ONLY,
    SALARY_SLIPS: READ_ONLY,
    ANNOUNCEMENTS: READ_ONLY,
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

export function requirePermission(moduleCode: string, action: PermissionAction | string = 'canView') {
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
      const userPerms = await resolveUserPermissions(req.user);
      const modulePerm = userPerms[normalizedCode];

      if (modulePerm) {
        // 1. Direct CRUD flag match
        if ((modulePerm as any)[action] === true) {
          return next();
        }

        // 2. Granular feature key match
        if (modulePerm.features && (modulePerm.features.includes(action) || modulePerm.features.includes('*'))) {
          return next();
        }

        // 3. Dynamic semantic action mappings (NO hardcoded role names)
        const actLower = action.toLowerCase();
        if (
          ['create', 'apply', 'add', 'record', 'bulk_create', 'create_task', 'manual_entry', 'create_invoice', 'record_expense', 'add_employee'].some((k) => actLower.includes(k))
        ) {
          if (modulePerm.canCreate) return next();
        }

        if (
          ['edit', 'update', 'manage', 'review', 'policy_settings', 'adjust_balance', 'reconcile_bank', 'can_edit'].some((k) => actLower.includes(k))
        ) {
          if (modulePerm.canEdit) return next();
        }

        if (['delete', 'remove'].some((k) => actLower.includes(k))) {
          if (modulePerm.canDelete) return next();
        }

        if (['view', 'read', 'export', 'download', 'report', 'live_map', 'history_playback', 'view_register'].some((k) => actLower.includes(k))) {
          if (modulePerm.canView) return next();
        }
      }

      const userRole = (req.user.role || 'EMPLOYEE').toUpperCase();
      res.status(403).json({
        detail: `Access denied. Your role '${userRole}' does not have '${action}' permission for module '${normalizedCode}'.`,
        code: 'permission_denied',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

export function requireSuperAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ detail: 'Authentication required.' });
        return;
      }

      if (req.user.role === 'SUPER_ADMIN' || req.user.isSuperuser) {
        return next();
      }

      if (req.user.dynamicRole) {
        const dynamicRole = await DynamicRole.findById(req.user.dynamicRole);
        if (dynamicRole && dynamicRole.isSuperadminWildcard) {
          return next();
        }
      }

      res.status(403).json({
        detail: 'Access denied: Only Super Admin is permitted to delete accounting data.',
        code: 'super_admin_required',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

