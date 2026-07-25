from rest_framework import serializers

from portal.models import DEPARTMENT_CHOICES, Meeting


class MeetingSerializer(serializers.ModelSerializer):
    department = serializers.ChoiceField(
        choices=[("All Employees", "All Employees"), *DEPARTMENT_CHOICES],
        required=False,
    )

    class Meta:
        model = Meeting
        fields = "__all__"
        read_only_fields = ["created_by"]
