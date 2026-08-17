from rest_framework.permissions import BasePermission, SAFE_METHODS

def normalize_portal_role(role):
    normalized = str(role or "EMPLOYEE").strip().upper().replace("-", "_").replace(" ", "_")
    aliases = {
        "ADMINISTRATOR": "ADMIN",
        "SUPERADMIN": "SUPER_ADMIN",
        "SUPER_ADMINISTRATOR": "SUPER_ADMIN",
        "TEAMLEAD": "TEAM_LEAD",
        "TEAM_LEADER": "TEAM_LEAD",
        "OPERATIONSHEAD": "OPERATIONS_HEAD",
        "OPERATION_HEAD": "OPERATIONS_HEAD",
    }
    return aliases.get(normalized, normalized)

def portal_role(user):
    if not user or not user.is_authenticated:
        return "EMPLOYEE"
    profile = getattr(user, "portal_profile", None)
    if profile:
        if getattr(profile, "dynamic_role", None) and profile.dynamic_role.code:
            return normalize_portal_role(profile.dynamic_role.code)
        if getattr(profile, "role", None):
            return normalize_portal_role(profile.role)
    if getattr(user, "is_superuser", False):
        return "SUPER_ADMIN"
    if getattr(user, "is_staff", False):
        return "ADMIN"
    return "EMPLOYEE"


class HasPortalRole(BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        role = portal_role(request.user)
        return role == "SUPER_ADMIN" or role in self.allowed_roles

class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return portal_role(request.user) == "SUPER_ADMIN"


def has_page_permission(user, module_code, action="view"):
    if not user or not user.is_authenticated:
        return False
    role = portal_role(user)
    if role == "SUPER_ADMIN" or getattr(user, "is_superuser", False):
        return True
    profile = getattr(user, "portal_profile", None)
    if not profile or not profile.dynamic_role:
        return False
    drole = profile.dynamic_role
    if drole.is_superadmin_wildcard:
        return True
    field_map = {
        "view": "can_view",
        "create": "can_create",
        "edit": "can_edit",
        "delete": "can_delete",
    }
    field_name = field_map.get(action, "can_view")
    from .models import RolePermission
    perm = RolePermission.objects.filter(
        role=drole,
        page__module_code=module_code,
        page__is_active=True,
    ).first()
    if not perm:
        return False
    return getattr(perm, field_name, False)


class HasPagePermission(BasePermission):
    def __init__(self, module_code=None, action="view"):
        self.module_code = module_code
        self.action = action

    def has_permission(self, request, view):
        module_code = self.module_code or getattr(view, "module_code", None)
        if not module_code:
            return True
        action = self.action
        if request.method in SAFE_METHODS and action == "view":
            pass
        elif request.method == "POST" and action == "view":
            action = "create"
        elif request.method in ("PUT", "PATCH") and action == "view":
            action = "edit"
        elif request.method == "DELETE" and action == "view":
            action = "delete"
        return has_page_permission(request.user, module_code, action)

class IsPortalAdmin(HasPortalRole):
    allowed_roles = ("ADMIN",)

class IsHR(HasPortalRole):
    allowed_roles = ("HR",)

class IsAccountant(HasPortalRole):
    allowed_roles = ("ACCOUNTANT",)

class IsBDE(HasPortalRole):
    allowed_roles = ("BDE",)

class IsEmployeeRole(HasPortalRole):
    allowed_roles = ("EMPLOYEE",)

class IsAdminOrHR(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        if request.method in SAFE_METHODS:
            return True
        return portal_role(request.user) in ("SUPER_ADMIN", "ADMIN", "HR")


class IsWorkClientUser(BasePermission):
    read_roles = ("SUPER_ADMIN", "ADMIN", "HR", "BDE", "TEAM_LEAD", "EMPLOYEE", "OPERATIONS_HEAD", "OPERATIONS", "MEMBER")
    write_roles = ("SUPER_ADMIN", "ADMIN", "HR", "TEAM_LEAD", "OPERATIONS_HEAD")

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        role = portal_role(request.user)
        if request.method in SAFE_METHODS:
            return True
        return role in self.write_roles

WORK_CREATOR_ROLES = ("SUPER_ADMIN", "ADMIN", "HR", "TEAM_LEAD", "OPERATIONS_HEAD")

class IsWorkAssignmentUser(BasePermission):
    allowed_roles = ("SUPER_ADMIN", "ADMIN", "HR", "BDE", "TEAM_LEAD", "EMPLOYEE", "OPERATIONS_HEAD", "OPERATIONS", "MEMBER")

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        role = str(portal_role(request.user)).upper()
        if request.method == "POST":
            return role in WORK_CREATOR_ROLES
        return True

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        role = str(portal_role(request.user)).upper()

        if request.method == "DELETE":
            if role in WORK_CREATOR_ROLES:
                return True
            if obj.reviewer_id and obj.reviewer_id == request.user.id:
                return True
            return False

        if request.method in ("PUT", "PATCH"):
            if role in WORK_CREATOR_ROLES:
                return True
            if obj.reviewer_id and obj.reviewer_id == request.user.id:
                return True
            if obj.employee and obj.employee.user_id == request.user.id:
                return True
            return False

        return True


class IsAdminOrAccountant(HasPortalRole):
    allowed_roles = ("ADMIN", "ACCOUNTANT")

class IsManagementReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        role = portal_role(request.user)
        if request.method in SAFE_METHODS:
            return role in ("SUPER_ADMIN", "ADMIN", "HR", "ACCOUNTANT")
        return role in ("SUPER_ADMIN", "ADMIN")

class IsAdminOrHRWriteReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return portal_role(request.user) in ("SUPER_ADMIN", "ADMIN", "HR")

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.method in SAFE_METHODS or portal_role(request.user) in ("SUPER_ADMIN", "ADMIN")


def is_operations_head(user):
    if not user or not user.is_authenticated:
        return False
    role = portal_role(user)
    if role in ("SUPER_ADMIN", "OPERATIONS_HEAD"):
        return True
    emp = getattr(user, "employee", None)
    if emp and emp.department == "Operations" and ("Head" in emp.designation or role in ("SUPER_ADMIN", "ADMIN", "HR", "TEAM_LEAD")):
        return True
    return False


def can_manage_kpis(user):
    if not user or not user.is_authenticated:
        return False
    role = portal_role(user)
    return role in ("SUPER_ADMIN", "ADMIN", "HR") or is_operations_head(user)


class CanViewKPIDashboard(BasePermission):
    def has_permission(self, request, view):
        return can_manage_kpis(request.user)


class CanManageKPIRating(BasePermission):
    def has_permission(self, request, view):
        return can_manage_kpis(request.user)


class CanManageShareLinks(BasePermission):
    allowed_roles = ("SUPER_ADMIN", "ADMIN", "HR", "BDE", "OPERATIONS_HEAD", "TEAM_LEAD")

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        role = portal_role(request.user)
        return role in self.allowed_roles or is_operations_head(request.user)
