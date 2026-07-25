from rest_framework import serializers

from portal.models import SalarySlip


class SalarySlipSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)

    class Meta:
        model = SalarySlip
        fields = "__all__"
