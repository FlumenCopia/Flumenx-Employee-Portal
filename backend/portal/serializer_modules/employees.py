import logging
import traceback

from django.conf import settings
from django.contrib.auth.models import User
from portal.services.email_service import send_onboarding_email
from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import serializers


from portal.models import Employee, UserRole
from portal.permissions import portal_role


logger = logging.getLogger(__name__)


class EmployeeSerializer(serializers.ModelSerializer):
    PORTAL_ROLE_CHOICES = (
        ("ADMIN", "Admin"),
        ("HR", "HR"),
        ("ACCOUNTANT", "Accountant"),
        ("BDE", "BDE"),
        ("TEAM_LEAD", "Team Lead"),
        ("EMPLOYEE", "Employee"),
        ("OPERATIONS", "Operations"),
        ("OPERATIONS_HEAD", "Operations Head"),
    )
    HR_ASSIGNABLE_ROLES = {"ACCOUNTANT", "BDE", "EMPLOYEE", "TEAM_LEAD"}
    ADMIN_ASSIGNABLE_ROLES = {"HR", "ACCOUNTANT", "BDE", "EMPLOYEE", "TEAM_LEAD", "OPERATIONS", "OPERATIONS_HEAD"}
    HR_PROTECTED_ROLES = {"ADMIN", "HR"}


    portal_role = serializers.ChoiceField(choices=PORTAL_ROLE_CHOICES, required=False)
    dynamic_role_id = serializers.IntegerField(required=False, allow_null=True)
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

    class Meta:
        model = Employee
        fields = [
            "id", "employee_code", "name", "email", "phone", "department", "designation",
            "joining_date", "status", "avatar", "location", "user", "portal_role", "dynamic_role_id", "password",
        ]
        read_only_fields = ["user"]

    def get_fields(self):
        fields = super().get_fields()
        fields["portal_role"].choices = {value: label for value, label in self.PORTAL_ROLE_CHOICES}
        return fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        profile = getattr(instance.user, "portal_profile", None) if instance.user else None
        data["portal_role"] = profile.role if profile else "EMPLOYEE"
        drole = getattr(profile, "dynamic_role", None) if profile else None
        data["dynamic_role"] = {"id": drole.id, "code": drole.code, "name": drole.name} if drole else None
        return data

    def resolve_dynamic_role(self, dynamic_role_id, role_str):
        from portal.models import DynamicRole
        from portal.permissions import normalize_portal_role
        drole = None
        if dynamic_role_id:
            drole = DynamicRole.objects.filter(id=dynamic_role_id).first()
        if not drole and role_str:
            norm_code = normalize_portal_role(role_str)
            drole = DynamicRole.objects.filter(code__iexact=norm_code).first()
        valid_legacy_roles = [choice[0] for choice in UserRole.ROLES]
        norm_code = normalize_portal_role(drole.code) if drole else normalize_portal_role(role_str or "EMPLOYEE")
        legacy_role = norm_code if norm_code in valid_legacy_roles else "EMPLOYEE"
        return drole, legacy_role

    def validate_email(self, value):
        return value.strip().lower()

    def current_portal_role(self):
        if not self.instance or not self.instance.user:
            return None
        profile = getattr(self.instance.user, "portal_profile", None)
        return profile.role if profile else "EMPLOYEE"

    def validate_portal_role_assignment(self, requested_role):
        request = self.context.get("request")
        if not request:
            return

        actor_role = portal_role(request.user)
        target_current_role = self.current_portal_role()

        if actor_role == "HR" and target_current_role in self.HR_PROTECTED_ROLES:
            raise serializers.ValidationError({
                "detail": "HR cannot modify administrator or HR employee records."
            })

        if requested_role is None:
            return

        if actor_role == "HR" and requested_role not in self.HR_ASSIGNABLE_ROLES:
            raise serializers.ValidationError({
                "portal_role": "HR can assign only Accountant, BDE, Team Lead, or Employee roles."
            })

        if actor_role == "ADMIN" and requested_role not in self.ADMIN_ASSIGNABLE_ROLES:
            raise serializers.ValidationError({
                "portal_role": "This portal role cannot be assigned through employee onboarding."
            })

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        email = attrs.get("email", getattr(instance, "email", None))
        employee_code = attrs.get("employee_code", getattr(instance, "employee_code", None))
        requested_role = attrs.get("portal_role")

        if not instance and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Temporary password is required."})
        if not instance and not attrs.get("department"):
            raise serializers.ValidationError({"department": "Department is required."})

        self.validate_portal_role_assignment(requested_role if requested_role else None)

        if email:
            employee_qs = Employee.objects.filter(email__iexact=email)
            if instance:
                employee_qs = employee_qs.exclude(pk=instance.pk)
            if employee_qs.exists():
                raise serializers.ValidationError({"email": "An employee record with this email already exists."})

            if not instance and User.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).exists():
                raise serializers.ValidationError({"email": "A user account with this email address already exists."})

        if employee_code:
            code_qs = Employee.objects.filter(employee_code=employee_code)
            if instance:
                code_qs = code_qs.exclude(pk=instance.pk)
            if code_qs.exists():
                raise serializers.ValidationError({"employee_code": "An employee with this ID already exists."})

        return attrs

    def create(self, validated_data):
        role = validated_data.pop("portal_role", "EMPLOYEE")
        dynamic_role_id = validated_data.pop("dynamic_role_id", None)
        password = validated_data.pop("password")
        email = validated_data["email"].strip().lower()
        try:
            with transaction.atomic():
                user = User.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).first()

                if not user:
                    user = User.objects.create_user(username=email, email=email, first_name=validated_data["name"], password=password)
                else:
                    raise serializers.ValidationError({"email": "A user account with this email address already exists."})
                drole, legacy_role = self.resolve_dynamic_role(dynamic_role_id, role)
                UserRole.objects.update_or_create(user=user, defaults={"role": legacy_role, "dynamic_role": drole})
                validated_data["user"] = user
                employee = super().create(validated_data)
                self.send_welcome_email(employee, password)
                return employee
        except serializers.ValidationError:
            raise
        except Exception as e:
            raise serializers.ValidationError({"detail": f"Employee record could not be saved: {str(e)}"})

    def send_welcome_email(self, employee, temporary_password):
        send_onboarding_email(employee.name, employee.email, temporary_password)


    def update(self, instance, validated_data):
        role = validated_data.pop("portal_role", None)
        dynamic_role_id = validated_data.pop("dynamic_role_id", None)
        validated_data.pop("password", None)
        try:
            with transaction.atomic():
                new_email = validated_data.get("email")
                employee = super().update(instance, validated_data)
                if new_email and employee.user:
                    employee.user.username = new_email
                    employee.user.email = new_email
                    employee.user.first_name = employee.name
                    employee.user.save(update_fields=["username", "email", "first_name"])
                if (role or dynamic_role_id) and employee.user:
                    drole, legacy_role = self.resolve_dynamic_role(dynamic_role_id, role)
                    profile, _ = UserRole.objects.update_or_create(user=employee.user, defaults={"role": legacy_role, "dynamic_role": drole})
                    employee.user.portal_profile = profile
                return employee
        except IntegrityError:
            raise serializers.ValidationError({"detail": "Employee could not be saved because related data is not unique."})
