from datetime import date
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import serializers

from portal.models import Department, DynamicRole, Employee, PortalPage, RolePermission, UserRole
from portal.permissions import portal_role, normalize_portal_role


class DepartmentSerializer(serializers.ModelSerializer):
    employees_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            "id",
            "name",
            "code",
            "description",
            "is_active",
            "display_order",
            "employees_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_employees_count(self, obj):
        return obj.employees.count()

    def validate_code(self, value):
        val = str(value or "").strip().upper().replace(" ", "_")
        if not val:
            raise serializers.ValidationError("Department code is required.")
        return val

    def validate(self, attrs):
        name = attrs.get("name", getattr(self.instance, "name", None))
        code = attrs.get("code", getattr(self.instance, "code", None))

        if name:
            qs = Department.objects.filter(name__iexact=name.strip())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "A department with this name already exists."})

        if code:
            qs = Department.objects.filter(code__iexact=code.strip())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"code": "A department with this code already exists."})

        return attrs


class PortalPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortalPage
        fields = [
            "id",
            "title",
            "route_path",
            "module_code",
            "icon",
            "sidebar_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_module_code(self, value):
        val = str(value or "").strip().upper().replace(" ", "_")
        if not val:
            raise serializers.ValidationError("Module code is required.")
        return val

    def validate_route_path(self, value):
        val = str(value or "").strip()
        if not val:
            raise serializers.ValidationError("Route path is required.")
        if not val.startswith("/"):
            val = "/" + val
        return val

    def validate(self, attrs):
        module_code = attrs.get("module_code", getattr(self.instance, "module_code", None))
        route_path = attrs.get("route_path", getattr(self.instance, "route_path", None))

        if module_code:
            qs = PortalPage.objects.filter(module_code__iexact=module_code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"module_code": "A page with this module code already exists."})

        if route_path:
            qs = PortalPage.objects.filter(route_path__iexact=route_path)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"route_path": "A page with this route path already exists."})

        return attrs


class DynamicRoleSerializer(serializers.ModelSerializer):
    permissions_count = serializers.SerializerMethodField()
    assigned_users_count = serializers.SerializerMethodField()

    class Meta:
        model = DynamicRole
        fields = [
            "id",
            "name",
            "code",
            "description",
            "is_superadmin_wildcard",
            "is_system_role",
            "permissions_count",
            "assigned_users_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "permissions_count", "assigned_users_count"]

    def get_permissions_count(self, obj):
        return obj.permissions.filter(can_view=True).count()

    def get_assigned_users_count(self, obj):
        return obj.user_roles.count()

    def validate_code(self, value):
        val = str(value or "").strip().upper().replace(" ", "_")
        if not val:
            raise serializers.ValidationError("Role code is required.")
        return val

    def validate(self, attrs):
        code = attrs.get("code", getattr(self.instance, "code", None))
        if code:
            qs = DynamicRole.objects.filter(code__iexact=code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"code": "A role with this code already exists."})
        return attrs


class RolePermissionItemSerializer(serializers.Serializer):
    page_id = serializers.IntegerField()
    can_view = serializers.BooleanField(default=False)
    can_create = serializers.BooleanField(default=False)
    can_edit = serializers.BooleanField(default=False)
    can_delete = serializers.BooleanField(default=False)


class RolePermissionMatrixUpdateSerializer(serializers.Serializer):
    permissions = serializers.ListField(child=RolePermissionItemSerializer())

    def validate_permissions(self, items):
        page_ids = [item["page_id"] for item in items]
        existing_pages = set(PortalPage.objects.filter(id__in=page_ids).values_list("id", flat=True))
        invalid_ids = set(page_ids) - existing_pages
        if invalid_ids:
            raise serializers.ValidationError(f"Invalid PortalPage IDs: {list(invalid_ids)}")
        return items


class SuperAdminUserSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="id")
    employee_id = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    work_email = serializers.EmailField(source="email")
    designation = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    team_lead_id = serializers.SerializerMethodField()
    dynamic_role = serializers.SerializerMethodField()
    legacy_portal_role = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "user_id",
            "employee_id",
            "full_name",
            "work_email",
            "designation",
            "department",
            "department_id",
            "team_lead_id",
            "dynamic_role",
            "legacy_portal_role",
            "status",
            "is_active",
            "date_joined",
        ]

    def get_employee_id(self, obj):
        emp = getattr(obj, "employee", None)
        return emp.id if emp else None

    def get_full_name(self, obj):
        emp = getattr(obj, "employee", None)
        if emp and emp.name:
            return emp.name
        full = obj.get_full_name().strip()
        return full if full else obj.username

    def get_designation(self, obj):
        emp = getattr(obj, "employee", None)
        return emp.designation if emp else ""

    def get_department(self, obj):
        emp = getattr(obj, "employee", None)
        if emp:
            if emp.department_ref:
                return emp.department_ref.name
            return emp.department
        return ""

    def get_department_id(self, obj):
        emp = getattr(obj, "employee", None)
        if emp and emp.department_ref:
            return emp.department_ref.id
        return None

    def get_team_lead_id(self, obj):
        emp = getattr(obj, "employee", None)
        return emp.team_lead_id if emp else None

    def get_dynamic_role(self, obj):
        profile = getattr(obj, "portal_profile", None)
        drole = getattr(profile, "dynamic_role", None) if profile else None
        if drole:
            return {"id": drole.id, "code": drole.code, "name": drole.name}
        return None

    def get_legacy_portal_role(self, obj):
        return portal_role(obj)

    def get_status(self, obj):
        emp = getattr(obj, "employee", None)
        if emp:
            return emp.status
        return "Active" if obj.is_active else "Inactive"


class SuperAdminUserCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=120)
    work_email = serializers.EmailField()
    initial_password = serializers.CharField(write_only=True, min_length=8)
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True, default="Employee")
    department = serializers.CharField(max_length=50, required=False, allow_blank=True, default="Web Development")
    department_id = serializers.IntegerField(required=False, allow_null=True)
    dynamic_role_id = serializers.IntegerField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    location = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")

    def validate_work_email(self, value):
        email = str(value or "").strip().lower()
        if not email:
            raise serializers.ValidationError("Work email is required.")
        if (
            User.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).exists()
            or Employee.objects.filter(email__iexact=email).exists()
        ):
            raise serializers.ValidationError("A user account with this work email already exists.")
        return email

    def validate_dynamic_role_id(self, value):
        drole = DynamicRole.objects.filter(id=value).first()
        if not drole:
            raise serializers.ValidationError("Selected Dynamic Role does not exist.")
        return value

    def create(self, validated_data):
        email = validated_data["work_email"]
        password = validated_data["initial_password"]
        full_name = validated_data["full_name"]
        designation = validated_data.get("designation") or "Employee"
        phone = validated_data.get("phone", "")
        location = validated_data.get("location", "")
        drole = DynamicRole.objects.get(id=validated_data["dynamic_role_id"])

        dept_id = validated_data.get("department_id")
        dept_obj = None
        if dept_id:
            dept_obj = Department.objects.filter(id=dept_id).first()

        department_str = validated_data.get("department") or "Web Development"
        if dept_obj:
            department_str = dept_obj.name
        else:
            dept_obj = Department.objects.filter(name__iexact=department_str).first()

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=full_name.split()[0] if full_name else "",
            last_name=" ".join(full_name.split()[1:]) if len(full_name.split()) > 1 else "",
        )

        valid_legacy_roles = [choice[0] for choice in UserRole.ROLES]
        norm_code = normalize_portal_role(drole.code)
        legacy_role = norm_code if norm_code in valid_legacy_roles else "EMPLOYEE"

        UserRole.objects.create(user=user, role=legacy_role, dynamic_role=drole)

        count = Employee.objects.count() + 1
        emp_code = f"EMP-{count:04d}"
        while Employee.objects.filter(employee_code=emp_code).exists():
            count += 1
            emp_code = f"EMP-{count:04d}"

        Employee.objects.create(
            user=user,
            employee_code=emp_code,
            name=full_name,
            email=email,
            phone=phone,
            department=department_str,
            department_ref=dept_obj,
            designation=designation,
            joining_date=date.today(),
            status="Active",
            location=location,
        )

        return user


class SuperAdminUserUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=120, required=False)
    designation = serializers.CharField(max_length=100, required=False)
    department = serializers.CharField(max_length=50, required=False)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    dynamic_role_id = serializers.IntegerField(required=False)
    status = serializers.ChoiceField(choices=["Active", "On Leave", "Inactive"], required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_dynamic_role_id(self, value):
        if value is not None:
            if not DynamicRole.objects.filter(id=value).exists():
                raise serializers.ValidationError("Selected Dynamic Role does not exist.")
        return value


class SuperAdminPasswordResetSerializer(serializers.Serializer):
    password = serializers.CharField(min_length=8, write_only=True)
