from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from portal.models import Department, DynamicRole, Employee, PortalPage, RolePermission, UserRole
from portal.permissions import IsSuperAdmin, portal_role, normalize_portal_role
from portal.serializer_modules.super_admin import (
    DepartmentSerializer,
    DynamicRoleSerializer,
    PortalPageSerializer,
    RolePermissionMatrixUpdateSerializer,
    SuperAdminPasswordResetSerializer,
    SuperAdminUserCreateSerializer,
    SuperAdminUserSerializer,
    SuperAdminUserUpdateSerializer,
)

SYSTEM_PAGE_CODES = {
    "DASHBOARD",
    "TASKS",
    "TIMELINE",
    "KPI",
    "EMPLOYEES",
    "ATTENDANCE",
    "LEAVES",
    "MEETINGS",
    "PAGE_MANAGEMENT",
    "SETTINGS_ACCESS",
}


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all().order_by("display_order", "name")
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsSuperAdmin()]

    def get_queryset(self):
        user = self.request.user
        qs = Department.objects.all().order_by("display_order", "name")
        if not user.is_superuser and portal_role(user) != "SUPER_ADMIN":
            return qs.filter(is_active=True)
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.employees.exists():
            return Response(
                {"detail": "Cannot delete a department that is currently assigned to employees. Deactivate it instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class PortalPageViewSet(viewsets.ModelViewSet):
    queryset = PortalPage.objects.all().order_by("sidebar_order", "title")
    serializer_class = PortalPageSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.module_code in SYSTEM_PAGE_CODES:
            return Response(
                {"detail": "System default pages cannot be deleted. You can deactivate them instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class DynamicRoleViewSet(viewsets.ModelViewSet):
    queryset = DynamicRole.objects.all().order_by("name")
    serializer_class = DynamicRoleSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def perform_create(self, serializer):
        if serializer.validated_data.get("is_superadmin_wildcard"):
            if not self.request.user.is_superuser and portal_role(self.request.user) != "SUPER_ADMIN":
                serializer.validated_data["is_superadmin_wildcard"] = False
        serializer.save()

    def perform_update(self, serializer):
        if serializer.validated_data.get("is_superadmin_wildcard"):
            if not self.request.user.is_superuser and portal_role(self.request.user) != "SUPER_ADMIN":
                serializer.validated_data["is_superadmin_wildcard"] = False
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.code.upper() == "SUPER_ADMIN" or instance.is_superadmin_wildcard:
            return Response(
                {"detail": "The SUPER_ADMIN role cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fallback_role = (
            DynamicRole.objects.filter(code__in=["TEAM_MEMBER", "EMPLOYEE"]).first()
            or DynamicRole.objects.filter(is_system_role=True).exclude(code="SUPER_ADMIN").first()
        )

        valid_legacy_roles = [choice[0] for choice in UserRole.ROLES]

        for user_role in instance.user_roles.all():
            user_role.dynamic_role = fallback_role
            if fallback_role and fallback_role.code.upper() in valid_legacy_roles:
                user_role.role = fallback_role.code.upper()
            else:
                user_role.role = "EMPLOYEE"
            user_role.save()

        return super().destroy(request, *args, **kwargs)


class RolePermissionMatrixView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request, role_id):
        role = DynamicRole.objects.filter(id=role_id).first()
        if not role:
            return Response({"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)

        pages = PortalPage.objects.filter(is_active=True).order_by("sidebar_order", "title")
        existing_perms = {
            p.page_id: p
            for p in RolePermission.objects.filter(role=role).select_related("page")
        }

        matrix = []
        for page in pages:
            perm = existing_perms.get(page.id)
            is_super = role.is_superadmin_wildcard or role.code == "SUPER_ADMIN"
            matrix.append({
                "page_id": page.id,
                "page_title": page.title,
                "route_path": page.route_path,
                "module_code": page.module_code,
                "can_view": is_super or (perm.can_view if perm else False),
                "can_create": is_super or (perm.can_create if perm else False),
                "can_edit": is_super or (perm.can_edit if perm else False),
                "can_delete": is_super or (perm.can_delete if perm else False),
            })

        return Response({
            "role": {
                "id": role.id,
                "code": role.code,
                "name": role.name,
                "is_superadmin_wildcard": role.is_superadmin_wildcard,
                "is_system_role": role.is_system_role,
            },
            "permissions": matrix,
        })

    def put(self, request, role_id):
        role = DynamicRole.objects.filter(id=role_id).first()
        if not role:
            return Response({"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = RolePermissionMatrixUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["permissions"]

        with transaction.atomic():
            for item in items:
                page_id = item["page_id"]
                RolePermission.objects.update_or_create(
                    role=role,
                    page_id=page_id,
                    defaults={
                        "can_view": item["can_view"],
                        "can_create": item["can_create"],
                        "can_edit": item["can_edit"],
                        "can_delete": item["can_delete"],
                    },
                )

        return self.get(request, role_id)


class SuperAdminUserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        return User.objects.all().select_related("employee", "portal_profile__dynamic_role").order_by("-date_joined")

    def get_serializer_class(self):
        if self.action == "create":
            return SuperAdminUserCreateSerializer
        if self.action in ("update", "partial_update"):
            return SuperAdminUserUpdateSerializer
        return SuperAdminUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = SuperAdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        read_serializer = SuperAdminUserSerializer(user)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = SuperAdminUserUpdateSerializer(data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        emp = getattr(user, "employee", None)

        if emp:
            if "full_name" in data and data["full_name"]:
                emp.name = data["full_name"]
                names = data["full_name"].split()
                user.first_name = names[0]
                user.last_name = " ".join(names[1:]) if len(names) > 1 else ""
            if "designation" in data:
                emp.designation = data["designation"]
            if "department_id" in data and data["department_id"]:
                dept_obj = Department.objects.filter(id=data["department_id"]).first()
                if dept_obj:
                    emp.department_ref = dept_obj
                    emp.department = dept_obj.name
            elif "department" in data and data["department"]:
                dept_str = data["department"]
                dept_obj = Department.objects.filter(name__iexact=dept_str).first()
                emp.department = dept_str
                if dept_obj:
                    emp.department_ref = dept_obj
            if "status" in data:
                emp.status = data["status"]
                if data["status"] == "Inactive":
                    user.is_active = False
                elif data["status"] == "Active":
                    user.is_active = True
            emp.save()

        if "is_active" in data:
            user.is_active = data["is_active"]
            if emp and not data["is_active"]:
                emp.status = "Inactive"
                emp.save()

        if "dynamic_role_id" in data and data["dynamic_role_id"]:
            drole = DynamicRole.objects.filter(id=data["dynamic_role_id"]).first()
            if drole:
                profile = getattr(user, "portal_profile", None)
                norm_code = normalize_portal_role(drole.code)
                valid_legacy_roles = [choice[0] for choice in UserRole.ROLES]
                legacy_role = norm_code if norm_code in valid_legacy_roles else "EMPLOYEE"
                if profile:
                    profile.dynamic_role = drole
                    profile.role = legacy_role
                    profile.save()
                else:
                    UserRole.objects.create(user=user, role=legacy_role, dynamic_role=drole)

        user.save()
        read_serializer = SuperAdminUserSerializer(user)
        return Response(read_serializer.data)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.id == request.user.id:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser and User.objects.filter(is_superuser=True).count() <= 1:
            return Response(
                {"detail": "The primary superuser account cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        username = user.username
        user.delete()
        return Response({"detail": f"User {username} deleted successfully."})

    @action(detail=True, methods=["post"], url_path="password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = SuperAdminPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_password = serializer.validated_data["password"]

        user.set_password(new_password)
        user.save()
        return Response({"detail": f"Password for {user.username} updated successfully."})


class DynamicNavigationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role = portal_role(user)

        active_pages = PortalPage.objects.filter(is_active=True).order_by("sidebar_order", "title")

        if role == "SUPER_ADMIN" or user.is_superuser:
            return Response(self._serialize_pages(active_pages))

        profile = getattr(user, "portal_profile", None)
        drole = getattr(profile, "dynamic_role", None) if profile else None

        if drole:
            if drole.is_superadmin_wildcard:
                return Response(self._serialize_pages(active_pages))

            permitted_page_ids = set(
                RolePermission.objects.filter(
                    role=drole,
                    page__is_active=True,
                    can_view=True,
                ).values_list("page_id", flat=True)
            )

            if permitted_page_ids:
                pages = active_pages.filter(id__in=permitted_page_ids)
                return Response(self._serialize_pages(pages))

        # Fallback to legacy role default pages if dynamic_role missing or permissions empty
        fallback_pages = self._get_legacy_fallback_pages(role, active_pages)
        return Response(self._serialize_pages(fallback_pages))

    def _serialize_pages(self, queryset):
        return [
            {
                "id": page.id,
                "title": page.title,
                "route_path": page.route_path,
                "module_code": page.module_code,
                "icon": page.icon,
                "sidebar_order": page.sidebar_order,
            }
            for page in queryset
        ]

    def _get_legacy_fallback_pages(self, role, active_pages):
        role_module_map = {
            "ADMIN": {"DASHBOARD", "TASKS", "TIMELINE", "KPI", "EMPLOYEES", "ATTENDANCE", "LEAVES", "MEETINGS"},
            "HR": {"DASHBOARD", "TASKS", "TIMELINE", "KPI", "EMPLOYEES", "ATTENDANCE", "LEAVES", "MEETINGS"},
            "TEAM_LEAD": {"DASHBOARD", "TASKS", "TIMELINE", "KPI", "MEETINGS"},
            "EMPLOYEE": {"DASHBOARD", "TASKS", "KPI", "ATTENDANCE", "LEAVES", "MEETINGS"},
            "ACCOUNTANT": {"DASHBOARD", "TASKS", "ATTENDANCE"},
            "BDE": {"DASHBOARD", "TASKS", "TIMELINE", "LEAVES", "MEETINGS"},
            "OPERATIONS": {"DASHBOARD", "TASKS", "TIMELINE", "KPI"},
            "OPERATIONS_HEAD": {"DASHBOARD", "TASKS", "TIMELINE", "KPI"},
        }
        allowed_modules = role_module_map.get(role, {"DASHBOARD", "TASKS"})
        return active_pages.filter(module_code__in=allowed_modules)
