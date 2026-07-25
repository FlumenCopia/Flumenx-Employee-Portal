from rest_framework import serializers

from portal.models import LeaveRequest


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
