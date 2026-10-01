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

// In-memory cache for Portal Pages (TTL: 60 seconds)
let cachedPages: any[] | null = null;
let cachedPagesExpiry = 0;

export async function getCachedPortalPages(): Promise<any[]> {
  const now = Date.now();
  if (cachedPages && now < cachedPagesExpiry) {
    return cachedPages;
  }
  cachedPages = await PortalPage.find({ isActive: true });
  cachedPagesExpiry = now + 60000; // 60s cache
  return cachedPages;
}

export function clearPortalPagesCache(): void {
  cachedPages = null;
  cachedPagesExpiry = 0;
  userPermCache.clear();
}

// In-memory cache for resolved user permissions (TTL: 30 seconds)
interface PermCacheEntry {
  expiresAt: number;
  perms: UserPermissionsMap;
}
const userPermCache = new Map<string, PermCacheEntry>();

export function clearUserPermCache(userId?: string): void {
  if (userId) {
    userPermCache.delete(userId);
  } else {
    userPermCache.clear();
  }
}

function getDefaultScopeForRole(role: string): string {
  const r = (role || '').toUpperCase();
  if (['SUPER_ADMIN', 'ADMIN', 'HR', 'OPERATIONS', 'OPERATIONS_HEAD'].includes(r)) return 'ALL';
  if (['TEAM_LEAD', 'LEAD'].includes(r)) return 'TEAM';
  return 'OWN';
}

export async function resolveUserPermissions(user: any): Promise<UserPermissionsMap> {
  if (!user) return {};

  const userId = user._id ? user._id.toString() : user.id ? String(user.id) : null;
  const userRole = (user.role || 'EMPLOYEE').toUpperCase();
  const isSuperadmin = userRole === 'SUPER_ADMIN' || Boolean(user.isSuperuser);

  // Check cache for non-superadmin
  const now = Date.now();
  if (userId && userPermCache.has(userId)) {
    const entry = userPermCache.get(userId)!;
    if (now < entry.expiresAt) {
      return entry.perms;
    }
    userPermCache.delete(userId);
  }

  const result: UserPermissionsMap = {};

  // Retrieve cached active portal pages
  const pages = await getCachedPortalPages();

  // 1. Handle Super Admin Wildcard
  if (isSuperadmin) {
    for (const page of pages) {
      result[page.moduleCode] = {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        dataScope: 'ALL',
        features: (page.features || []).map((f: any) => f.key),
      };
    }
    const normalized = normalizeAliases(result);
    if (userId) userPermCache.set(userId, { expiresAt: now + 30000, perms: normalized });
    return normalized;
  }

  // 2. Handle Dynamic Role (by reference or role code)
  let dynamicRoleDoc: any = null;
  if (user.dynamicRole) {
    if (typeof user.dynamicRole === 'object' && user.dynamicRole.permissions) {
      dynamicRoleDoc = user.dynamicRole;
    } else {
      dynamicRoleDoc = await DynamicRole.findById(user.dynamicRole).populate('permissions.page');
    }
  }
  if (!dynamicRoleDoc && userRole) {
    dynamicRoleDoc = await DynamicRole.findOne({ code: userRole }).populate('permissions.page');
  }

  if (dynamicRoleDoc) {
    if (dynamicRoleDoc.isSuperadminWildcard) {
      for (const page of pages) {
        result[page.moduleCode] = {
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          dataScope: 'ALL',
          features: (page.features || []).map((f: any) => f.key),
        };
      }
      const normalized = normalizeAliases(result);
      if (userId) userPermCache.set(userId, { expiresAt: now + 30000, perms: normalized });
      return normalized;
    }

    const effectiveRoleCode = (dynamicRoleDoc.code || userRole).toUpperCase();
    const systemRolePerms = defaultRoleActionMatrix[effectiveRoleCode] || defaultRoleActionMatrix[userRole] || {};
    const defaultScope = getDefaultScopeForRole(effectiveRoleCode);

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
          dataScope: permEntry.dataScope || defaultScope,
          features: permEntry.features || [],
        };
      } else if (systemRolePerms[page.moduleCode]) {
        result[page.moduleCode] = {
          ...systemRolePerms[page.moduleCode],
          dataScope: defaultScope,
          features: (page.features || []).map((f: any) => f.key),
        };
      } else {
        result[page.moduleCode] = NO_ACCESS;
      }
    }

    const normalized = normalizeAliases(result);
    if (userId) userPermCache.set(userId, { expiresAt: now + 30000, perms: normalized });
    return normalized;
  }

  // 3. Fallback to System Role Action Matrix
  const rolePerms = defaultRoleActionMatrix[userRole] || {};
  const defaultScope = getDefaultScopeForRole(userRole);

  for (const page of pages) {
    const perm = rolePerms[page.moduleCode];
    if (perm) {
      result[page.moduleCode] = {
        ...perm,
        dataScope: defaultScope,
        features: (page.features || []).map((f: any) => f.key),
      };
    } else {
      result[page.moduleCode] = NO_ACCESS;
    }
  }

  const normalized = normalizeAliases(result);
  if (userId) userPermCache.set(userId, { expiresAt: now + 30000, perms: normalized });
  return normalized;
}
