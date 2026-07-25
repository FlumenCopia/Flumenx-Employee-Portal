from rest_framework import serializers

from portal.models import AttendanceCorrection, AttendancePolicy, AttendanceRecord
from portal.permissions import portal_role


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
