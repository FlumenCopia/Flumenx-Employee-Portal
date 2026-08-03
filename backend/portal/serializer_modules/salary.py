from rest_framework import serializers

from portal.models import SalarySlip


class SalarySlipSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    download_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SalarySlip
        fields = [
            "id", "employee", "employee_name", "employee_code",
            "month", "year", "file", "gross_salary", "net_salary",
            "uploaded_at", "download_url",
        ]
        extra_kwargs = {
            "file": {"write_only": True, "required": False},
        }

    def validate_file(self, value):
        if not value:
            return value
        if not value.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Only PDF files are allowed.")
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("File size must be 5MB or less.")
        return value

    def get_download_url(self, obj):
        return f"/api/salary-slips/{obj.id}/download/"
