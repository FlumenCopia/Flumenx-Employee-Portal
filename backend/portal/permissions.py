from rest_framework.permissions import BasePermission, SAFE_METHODS

def portal_role(user):
    profile = getattr(user, "portal_profile", None)
    if profile:
        return profile.role
    return "ADMIN" if user.is_superuser else "EMPLOYEE"

class HasPortalRole(BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        return request.user.is_authenticated and portal_role(request.user) in self.allowed_roles

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

class IsAdminOrHR(HasPortalRole):
    allowed_roles = ("ADMIN", "HR")

class IsWorkClientUser(BasePermission):
    read_roles = ("ADMIN", "HR", "BDE", "TEAM_LEAD")
    write_roles = ("ADMIN", "HR", "BDE")

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        role = portal_role(request.user)
        if request.method in SAFE_METHODS:
            return role in self.read_roles
        return role in self.write_roles

class IsWorkAssignmentUser(BasePermission):
    allowed_roles = ("ADMIN", "HR", "BDE", "TEAM_LEAD", "EMPLOYEE")

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        role = portal_role(request.user)
        if request.method == "POST":
            return role in ("ADMIN", "HR", "BDE", "TEAM_LEAD")
        if request.method == "DELETE":
            return role in ("ADMIN", "HR", "BDE", "TEAM_LEAD")
        return role in self.allowed_roles

class IsAdminOrAccountant(HasPortalRole):
    allowed_roles = ("ADMIN", "ACCOUNTANT")

class IsManagementReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        role = portal_role(request.user)
        if request.method in SAFE_METHODS:
            return role in ("ADMIN", "HR", "ACCOUNTANT")
        return role == "ADMIN"

class IsAdminOrHRWriteReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return portal_role(request.user) in ("ADMIN", "HR")

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.method in SAFE_METHODS or portal_role(request.user) == "ADMIN"
