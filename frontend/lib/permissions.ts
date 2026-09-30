import { AuthUser, DataScope } from "./types";
import { getCachedAuthUser } from "./auth-cache";

export function hasPermission(
  user: AuthUser | null | undefined,
  moduleCode: string,
  actionOrFeature?: string
): boolean {
  const currentUser = user || getCachedAuthUser();
  if (!currentUser) return false;

  const role = (currentUser.portal_role || currentUser.role || "").toUpperCase();
  const isSuperadmin =
    role === "SUPER_ADMIN" ||
    Boolean(currentUser.is_superuser) ||
    Boolean((currentUser as any).isSuperuser);

  if (isSuperadmin) return true;

  const modKey = moduleCode.trim().toUpperCase();
  const perms = currentUser.permissions || {};
  const perm = perms[modKey] || perms[modKey.replace(/\s+/g, "_")];

  if (!perm) return false;

  const canView = Boolean(perm.canView ?? perm.can_view);

  // If no specific action/feature requested, just verify view access
  if (!actionOrFeature) {
    return canView;
  }

  // 1. Direct CRUD flags
  if (actionOrFeature === "canView" || actionOrFeature === "can_view") return canView;
  if (actionOrFeature === "canCreate" || actionOrFeature === "can_create") {
    return Boolean(perm.canCreate ?? perm.can_create);
  }
  if (actionOrFeature === "canEdit" || actionOrFeature === "can_edit") {
    return Boolean(perm.canEdit ?? perm.can_edit);
  }
  if (actionOrFeature === "canDelete" || actionOrFeature === "can_delete") {
    return Boolean(perm.canDelete ?? perm.can_delete);
  }

  // 2. Granular sub-feature check
  if (Array.isArray(perm.features)) {
    if (perm.features.includes("*") || perm.features.includes(actionOrFeature)) {
      return true;
    }
  }

  // 3. Sensible fallbacks for backward compatibility
  if (actionOrFeature === "manual_entry") return Boolean(perm.canCreate ?? perm.can_create);
  if (actionOrFeature === "policy_settings") return Boolean(perm.canEdit ?? perm.can_edit);
  if (actionOrFeature === "reports_export") {
    return canView || Boolean(perms.REPORTS?.canView ?? perms.REPORTS?.can_view);
  }
  if (actionOrFeature === "view_register") {
    const scope = perm.data_scope || perm.dataScope || "OWN";
    return scope !== "OWN" || canView;
  }
  if (actionOrFeature === "live_map") {
    const scope = perm.data_scope || perm.dataScope || "OWN";
    return scope !== "OWN" || canView;
  }

  return false;
}

export function getDataScope(
  user: AuthUser | null | undefined,
  moduleCode: string
): DataScope {
  const currentUser = user || getCachedAuthUser();
  if (!currentUser) return "OWN";

  const role = (currentUser.portal_role || currentUser.role || "").toUpperCase();
  if (role === "SUPER_ADMIN" || Boolean(currentUser.is_superuser)) {
    return "ALL";
  }

  const modKey = moduleCode.trim().toUpperCase();
  const perms = currentUser.permissions || {};
  const perm = perms[modKey] || perms[modKey.replace(/\s+/g, "_")];

  if (!perm) return "OWN";
  return perm.data_scope || perm.dataScope || "OWN";
}
