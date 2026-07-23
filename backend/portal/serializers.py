from django.contrib.auth.models import User
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from .models import Announcement, AttendanceCorrection, AttendancePolicy, AttendanceRecord, AuditLog, Employee, LeaveRequest, Meeting, Notification, SalarySlip, UserRole
from .permissions import portal_role

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = "__all__"
        read_only_fields = ["user"]

    def create(self, validated_data):
        password = self.context["request"].data.get("password", "Flumenx@123")
        email = validated_data["email"]
        user = User.objects.create_user(username=email, email=email, first_name=validated_data["name"], password=password)
        UserRole.objects.create(user=user, role="EMPLOYEE")
        validated_data["user"] = user
        return super().create(validated_data)

class LeaveSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    days = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = "__all__"
        read_only_fields = ["employee"]

    def get_days(self, obj):
        return (obj.end_date - obj.start_date).days + 1

class SalarySlipSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)

    class Meta:
        model = SalarySlip
        fields = "__all__"

class MeetingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meeting
        fields = "__all__"
        read_only_fields = ["created_by"]

class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = "__all__"
        read_only_fields = ["created_by", "date"]

class AttendancePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendancePolicy
        fields = "__all__"
        read_only_fields = ["id", "updated_at"]

class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    department = serializers.CharField(source="employee.department", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = "__all__"
        read_only_fields = [
            "check_in_status", "attendance_status", "is_late", "late_minutes",
            "is_early_exit", "early_exit_minutes", "working_hours",
        ]

class AttendanceCorrectionSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    attendance_date = serializers.DateField(source="attendance_record.attendance_date", read_only=True)

    class Meta:
        model = AttendanceCorrection
        fields = "__all__"
        read_only_fields = ["employee", "status", "admin_note", "reviewed_by", "reviewed_at"]

    def validate_attendance_record(self, record):
        request = self.context.get("request")
        if request and portal_role(request.user) not in ("ADMIN", "HR") and record.employee.user_id != request.user.id:
            raise serializers.ValidationError("You can only correct your own attendance.")
        return record

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ["user"]

class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = AuditLog
        fields = "__all__"

class ProfileSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    portal_role = serializers.SerializerMethodField()
    employee = EmployeeSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "role", "portal_role", "employee"]

    def get_role(self, obj):
        portal_role = self.get_portal_role(obj)
        return portal_role.lower()

    def get_portal_role(self, obj):
        profile = getattr(obj, "portal_profile", None)
        if profile:
            return profile.role
        return "ADMIN" if obj.is_superuser else "EMPLOYEE"

class RegisterSerializer(serializers.Serializer):
    ROLE_CHOICES = ("ADMIN", "HR", "ACCOUNTANT", "BDO", "EMPLOYEE")
    ROLE_PROFILE_DEFAULTS = {
        "ADMIN": ("Operations", "Administrator"),
        "HR": ("HR", "Human Resources"),
        "ACCOUNTANT": ("Finance", "Accountant"),
        "BDO": ("Sales", "Business Development"),
        "EMPLOYEE": ("Operations", "Employee"),
    }

    full_name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)
    portal_role = serializers.ChoiceField(choices=ROLE_CHOICES)
    phone = serializers.CharField(max_length=20)

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
        role = validated_data["portal_role"]
        department, designation = self.ROLE_PROFILE_DEFAULTS[role]
        user = User.objects.create_user(
            username=email, email=email, first_name=validated_data["full_name"],
            password=validated_data["password"], is_staff=role in ("ADMIN", "HR"),
            is_superuser=role == "ADMIN",
        )
        UserRole.objects.create(user=user, role=role)
        next_number = (Employee.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        Employee.objects.create(
            user=user, employee_code=f"FLX-{next_number:03d}", name=validated_data["full_name"],
            email=email, phone=validated_data["phone"], department=department,
            designation=designation,
            joining_date=timezone.localdate(), status="Active",
        )
        return user

