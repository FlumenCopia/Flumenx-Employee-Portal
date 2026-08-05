from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from portal.models import Employee, UserRole
from portal.permissions import portal_role
from .employees import EmployeeSerializer


class ProfileSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    portal_role = serializers.SerializerMethodField()
    employee = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "role", "portal_role", "employee"]

    def get_role(self, obj):
        portal_role = self.get_portal_role(obj)
        return portal_role.lower()

    def get_portal_role(self, obj):
        return portal_role(obj)

    def get_employee(self, obj):
        try:
            employee = getattr(obj, "employee", None)
            if employee:
                return EmployeeSerializer(employee, context=self.context).data
        except Exception:
            pass
        return None


class RegisterSerializer(serializers.Serializer):
    ROLE_PROFILE_DEFAULTS = {
        "EMPLOYEE": ("Operations", "Employee"),
    }

    full_name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    portal_role = serializers.CharField(write_only=True, required=False)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(username=value).exists() or Employee.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        email = validated_data["email"]
        role = "EMPLOYEE"
        department, designation = self.ROLE_PROFILE_DEFAULTS[role]
        user = User.objects.create_user(
            username=email, email=email, first_name=validated_data["full_name"],
            password=validated_data["password"], is_staff=False,
            is_superuser=False,
        )
        UserRole.objects.create(user=user, role=role)
        next_number = (Employee.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        Employee.objects.create(
            user=user, employee_code=f"FLX-{next_number:03d}", name=validated_data["full_name"],
            email=email, phone=validated_data.get("phone", ""), department=department,
            designation=designation,
            joining_date=timezone.localdate(), status="Active",
        )
        return user
