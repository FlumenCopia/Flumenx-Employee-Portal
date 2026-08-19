from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied


from portal.models import Client, Employee, WorkAssignment, WorkDeliverable
from portal.permissions import WORK_CREATOR_ROLES, portal_role


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
    employee_department = serializers.CharField(source="employee.department", read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    reviewer = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False, allow_null=True)
    reviewer_details = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    remaining_quantity = serializers.IntegerField(read_only=True)
    deliverables = serializers.SerializerMethodField()

    class Meta:
        model = WorkAssignment
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_department",
            "client",
            "client_name",
            "title",
            "description",
            "priority",
            "assigned_date",
            "due_date",
            "status",
            "progress",
            "assigned_quantity",
            "completed_quantity",
            "remaining_quantity",
            "unit",
            "completed_at",
            "assigned_by",
            "reviewer",
            "reviewer_name",
            "reviewer_details",
            "assigned_by_name",
            "review_status",
            "review_note",
            "reviewed_by",
            "reviewed_at",
            "reviewed_by_name",
            "is_overdue",
            "deliverables",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["progress", "remaining_quantity", "completed_at", "reviewed_by", "reviewed_at", "created_at", "updated_at"]
        extra_kwargs = {"client": {"required": False, "allow_null": True}}

    @staticmethod
    def default_client():
        client, _ = Client.objects.get_or_create(name="General")
        return client

    def get_reviewer_details(self, obj):
        if obj.reviewer:
            name = obj.reviewer.first_name.strip() if obj.reviewer.first_name else obj.reviewer.username
            return {"id": obj.reviewer.id, "name": name, "username": obj.reviewer.username}
        if obj.reviewer_name:
            return {"id": None, "name": obj.reviewer_name, "username": ""}
        return None

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by:
            return "Admin"
        u = obj.assigned_by
        return u.first_name.strip() if u.first_name and u.first_name.strip() else u.username or "Admin"

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return ""
        u = obj.reviewed_by
        return u.first_name.strip() if u.first_name and u.first_name.strip() else u.username

    def get_is_overdue(self, obj):
        return obj.status != "Completed" and obj.due_date < timezone.localdate()

    def actor_role(self):
        request = self.context.get("request")
        return str(portal_role(request.user)).upper() if request and request.user else "EMPLOYEE"

    def is_reviewer_or_manager(self, instance=None):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        role = str(portal_role(request.user)).upper()
        if role in WORK_CREATOR_ROLES:
            return True
        if instance:
            if instance.reviewer_id and instance.reviewer_id == request.user.id:
                return True
            if instance.assigned_by_id and instance.assigned_by_id == request.user.id:
                return True
        return False

    def validate_employee_scope(self, employee):
        request = self.context.get("request")
        if not request or not employee:
            return
        if self.is_reviewer_or_manager(self.instance):
            return
        role = str(portal_role(request.user)).upper()
        if role in WORK_CREATOR_ROLES:
            return
        if not self.instance:
            raise PermissionDenied("Only management and Team Leads can create work assignments.")
        if getattr(request.user, "employee", None) != employee:
            raise PermissionDenied("Execution roles can access only their own assignments.")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        requested_status = attrs.get("status")
        valid_statuses = ("Backlog", "Assigned", "Pending", "In Progress", "Ongoing", "Blocked", "In Review", "Changes Requested", "Rejected", "Approved", "Completed", "Published")

        if requested_status and requested_status not in valid_statuses:
            raise serializers.ValidationError({"status": f"Invalid status value '{requested_status}'."})

        if self.instance and requested_status and requested_status != self.instance.status:
            is_rev = self.is_reviewer_or_manager(self.instance)
            if not is_rev:
                if requested_status in ("Approved", "Changes Requested", "Rejected", "Completed", "Published"):
                    raise PermissionDenied("Only the assigned Reviewer or Management can approve, reject, request changes, complete, or publish work.")
                if requested_status not in ("Backlog", "Assigned", "Pending", "In Progress", "Ongoing", "Blocked", "In Review"):
                    raise PermissionDenied("Assigned employee can only move work to In Review or update progress.")
                if requested_status == "In Review" and self.instance.status in ("Approved", "Completed", "Published", "Rejected"):
                    raise PermissionDenied(f"Assigned employee cannot submit work for review when current status is '{self.instance.status}'.")

        if self.instance and not self.is_reviewer_or_manager(self.instance):
            role = self.actor_role()
            if role not in WORK_CREATOR_ROLES:
                allowed = {"status", "completed_quantity"}
                protected = set(getattr(self, "initial_data", {}) or {}) - allowed
                if protected:
                    raise PermissionDenied("Execution roles can update only work status and progress.")

        if self.instance and "completed_quantity" in attrs and "status" not in attrs and self.instance.status == "Blocked":
            attrs["status"] = "In Progress"

        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        self.validate_employee_scope(employee)




        values = {
            "employee": employee,
            "client": attrs.get("client", getattr(self.instance, "client", None)) or self.default_client(),
            "title": attrs.get("title", getattr(self.instance, "title", "")),
            "description": attrs.get("description", getattr(self.instance, "description", "")),
            "priority": attrs.get("priority", getattr(self.instance, "priority", "Normal")),
            "assigned_date": attrs.get("assigned_date", getattr(self.instance, "assigned_date", None)),
            "due_date": attrs.get("due_date", getattr(self.instance, "due_date", None)),
            "status": attrs.get("status", getattr(self.instance, "status", "Assigned")),
            "assigned_quantity": attrs.get("assigned_quantity", getattr(self.instance, "assigned_quantity", 100)),
            "completed_quantity": attrs.get("completed_quantity", getattr(self.instance, "completed_quantity", 0)),
            "unit": attrs.get("unit", getattr(self.instance, "unit", "%")),
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

    def create(self, validated_data):
        if not validated_data.get("client"):
            validated_data["client"] = self.default_client()
        return super().create(validated_data)

    def get_deliverables(self, obj):
        return WorkDeliverableSerializer(obj.deliverables.all(), many=True, context=self.context).data


class WorkDeliverableSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)
    employee_name = serializers.CharField(source="assignment.employee.name", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = WorkDeliverable
        fields = [
            "id",
            "assignment",
            "assignment_title",
            "employee_name",
            "client",
            "client_name",
            "title",
            "brief",
            "work_type",
            "due_date",
            "status",
            "completed_at",
            "is_overdue",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["completed_at", "created_at", "updated_at"]

    def actor_role(self):
        request = self.context.get("request")
        return portal_role(request.user) if request else "EMPLOYEE"

    def validate_assignment_scope(self, assignment):
        request = self.context.get("request")
        if not request or not assignment:
            return
        role = portal_role(request.user)
        if role in WORK_CREATOR_ROLES:
            return
        if role == "TEAM_LEAD":
            actor_employee = getattr(request.user, "employee", None)
            if not actor_employee or assignment.employee.team_lead_id != actor_employee.id:
                raise PermissionDenied("Team Lead can manage deliverables only for their own team members.")
            return
        if getattr(request.user, "employee", None) != assignment.employee:
            raise PermissionDenied("Execution roles can access only their own deliverables.")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        role = self.actor_role()

        if self.instance and role not in WORK_CREATOR_ROLES:
            allowed = {"status"}
            protected = set(getattr(self, "initial_data", {}) or {}) - allowed
            if protected:
                raise PermissionDenied("Execution roles can update only deliverable status.")
            requested_status = attrs.get("status")
            if requested_status not in ("Backlog", "Assigned", "Pending", "In Progress", "Ongoing", "Blocked", "In Review", "Approved", "Completed", "Published"):
                raise PermissionDenied("Execution roles can update only valid deliverable statuses.")
        elif not self.instance and role not in WORK_CREATOR_ROLES:
            raise PermissionDenied("Execution roles cannot create deliverables.")

        assignment = attrs.get("assignment", getattr(self.instance, "assignment", None))
        self.validate_assignment_scope(assignment)

        values = {
            "assignment": assignment,
            "client": attrs.get("client", getattr(self.instance, "client", None)),
            "title": attrs.get("title", getattr(self.instance, "title", "")),
            "brief": attrs.get("brief", getattr(self.instance, "brief", "")),
            "work_type": attrs.get("work_type", getattr(self.instance, "work_type", "")),
            "due_date": attrs.get("due_date", getattr(self.instance, "due_date", None)),
            "status": attrs.get("status", getattr(self.instance, "status", "Assigned")),
        }
        deliverable = WorkDeliverable(**values)
        if self.instance:
            deliverable.pk = self.instance.pk
            deliverable.completed_at = self.instance.completed_at
        try:
            deliverable.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        return attrs
