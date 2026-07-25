from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from portal.models import Client, Employee, WorkAssignment
from portal.permissions import portal_role


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = "__all__"

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Client name is required.")
        qs = Client.objects.filter(name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Client name must be unique.")
        return name


class WorkAssignmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.name", read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    assigned_by_name = serializers.CharField(source="assigned_by.first_name", read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = WorkAssignment
        fields = [
            "id",
            "employee",
            "employee_name",
            "client",
            "client_name",
            "title",
            "description",
            "priority",
            "assigned_date",
            "due_date",
            "status",
            "progress",
            "assigned_by",
            "assigned_by_name",
            "is_overdue",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["assigned_by", "created_at", "updated_at"]

    def get_is_overdue(self, obj):
        return obj.status != "Completed" and obj.due_date < timezone.localdate()

    def actor_role(self):
        request = self.context.get("request")
        return portal_role(request.user) if request else "EMPLOYEE"

    def validate_employee_scope(self, employee):
        request = self.context.get("request")
        if not request or not employee:
            return
        role = portal_role(request.user)
        if role in ("ADMIN", "HR", "BDE"):
            return
        if role == "TEAM_LEAD":
            actor_employee = getattr(request.user, "employee", None)
            if not actor_employee or employee.team_lead_id != actor_employee.id:
                raise PermissionDenied("Team Lead can assign work only to their own team members.")
            return
        if role == "EMPLOYEE" and getattr(request.user, "employee", None) != employee:
            raise PermissionDenied("Employees can access only their own assignments.")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        role = self.actor_role()

        if self.instance and role == "EMPLOYEE":
            allowed = {"status", "progress"}
            protected = set(getattr(self, "initial_data", {}) or {}) - allowed
            if protected:
                raise PermissionDenied("Employees can update only status and progress.")

        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        self.validate_employee_scope(employee)

        values = {
            "employee": employee,
            "client": attrs.get("client", getattr(self.instance, "client", None)),
            "title": attrs.get("title", getattr(self.instance, "title", "")),
            "description": attrs.get("description", getattr(self.instance, "description", "")),
            "priority": attrs.get("priority", getattr(self.instance, "priority", "Normal")),
            "assigned_date": attrs.get("assigned_date", getattr(self.instance, "assigned_date", None)),
            "due_date": attrs.get("due_date", getattr(self.instance, "due_date", None)),
            "status": attrs.get("status", getattr(self.instance, "status", "Pending")),
            "progress": attrs.get("progress", getattr(self.instance, "progress", 0)),
            "assigned_by": attrs.get("assigned_by", getattr(self.instance, "assigned_by", None)),
        }
        assignment = WorkAssignment(**values)
        if self.instance:
            assignment.pk = self.instance.pk
        try:
            assignment.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        return attrs
