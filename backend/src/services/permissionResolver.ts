import { DynamicRole } from '../models/DynamicRole.js';
import { PortalPage } from '../models/PortalPage.js';
import { defaultRoleActionMatrix, ActionPerms } from '../middleware/rbac.js';

export type UserPermissionsMap = Record<string, ActionPerms>;

const FULL_ACCESS: ActionPerms = { canView: true, canCreate: true, canEdit: true, canDelete: true };
const NO_ACCESS: ActionPerms = { canView: false, canCreate: false, canEdit: false, canDelete: false };

function normalizeAliases(result: UserPermissionsMap): UserPermissionsMap {
  if (result.TASKS) result.WORK_BOARD = result.TASKS;
  if (result.WORK_BOARD && !result.TASKS) result.TASKS = result.WORK_BOARD;

  if (result.EMPLOYEE_TRACKING) result.TRACKING = result.EMPLOYEE_TRACKING;
  if (result.TRACKING && !result.EMPLOYEE_TRACKING) result.EMPLOYEE_TRACKING = result.TRACKING;

  if (result.CLIENTS) result.CLIENT_TASKS = result.CLIENTS;
  if (result.CLIENT_TASKS && !result.CLIENTS) result.CLIENTS = result.CLIENT_TASKS;

  return result;
}

export async function resolveUserPermissions(user: any): Promise<UserPermissionsMap> {
  const result: UserPermissionsMap = {};

  if (!user) return result;

  const userRole = (user.role || 'EMPLOYEE').toUpperCase();
  const isSuperadmin = userRole === 'SUPER_ADMIN' || Boolean(user.isSuperuser);

  // Retrieve active portal pages
  const pages = await PortalPage.find({ isActive: true });

  // 1. Handle Super Admin Wildcard
  if (isSuperadmin) {
    for (const page of pages) {
      result[page.moduleCode] = FULL_ACCESS;
    }
    return normalizeAliases(result);
  }

  // 2. Handle Custom Dynamic Role
  let dynamicRoleDoc: any = null;
  if (user.dynamicRole) {
    if (typeof user.dynamicRole === 'object' && user.dynamicRole.permissions) {
      dynamicRoleDoc = user.dynamicRole;
    } else {
      dynamicRoleDoc = await DynamicRole.findById(user.dynamicRole).populate('permissions.page');
    }
  }

  if (dynamicRoleDoc) {
    if (dynamicRoleDoc.isSuperadminWildcard) {
      for (const page of pages) {
        result[page.moduleCode] = FULL_ACCESS;
      }
      return normalizeAliases(result);
    }

    for (const page of pages) {
      const pageIdStr = page._id.toString();
      const permEntry = dynamicRoleDoc.permissions?.find((p: any) => {
        if (!p.page) return false;
        const pId = p.page._id ? p.page._id.toString() : p.page.toString();
        return pId === pageIdStr;
      });

      if (permEntry) {
        result[page.moduleCode] = {
          canView: Boolean(permEntry.canView),
          canCreate: Boolean(permEntry.canCreate),
          canEdit: Boolean(permEntry.canEdit),
          canDelete: Boolean(permEntry.canDelete),
        };
      } else {
        result[page.moduleCode] = NO_ACCESS;
      }
    }

    return normalizeAliases(result);
  }

  // 3. Fallback to System Role Action Matrix
  const rolePerms = defaultRoleActionMatrix[userRole] || {};

  for (const page of pages) {
    const perm = rolePerms[page.moduleCode];
    if (perm) {
      result[page.moduleCode] = perm;
    } else {
      result[page.moduleCode] = NO_ACCESS;
    }
  }

  return normalizeAliases(result);
}
