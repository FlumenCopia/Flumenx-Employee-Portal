from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import viewsets

from portal.models import Employee
from portal.permissions import IsAdminOrHR, portal_role
from portal.serializers import EmployeeSerializer
from portal.services.notifications import create_notifications


EMPLOYEE_NOTIFICATION_FIELDS = {
    "employee_code",
    "name",
    "email",
    "phone",
    "department",
    "designation",
    "joining_date",
    "status",
    "avatar",
    "location",
    "portal_role",
}


def active_users_with_roles(roles):
    return User.objects.filter(is_active=True, portal_profile__role__in=roles).select_related("portal_profile")


def employee_management_recipients(actor):
    actor_role = portal_role(actor)
    if actor_role == "ADMIN":
        return active_users_with_roles(("HR",))
    if actor_role == "HR":
        return active_users_with_roles(("ADMIN",))
    return User.objects.none()


def employee_recipients(employee, actor):
    recipients = []
    if employee.user_id:
        recipients.append(employee.user)
    recipients.extend(employee_management_recipients(actor))
    return recipients


def notify_employee_change(employee, actor, title, category, action):
    create_notifications(
        employee_recipients(employee, actor),
        title,
        f"Employee {employee.name} ({employee.employee_code}) was {action}.",
        category=category,
        exclude_user=actor,
    )


def requested_employee_changes(serializer):
    instance = serializer.instance
    changes = {}
    for field, value in serializer.validated_data.items():
        if field == "portal_role" or field not in EMPLOYEE_NOTIFICATION_FIELDS:
            continue
        if getattr(instance, field) != value:
            changes[field] = value

    requested_role = serializer.validated_data.get("portal_role")
    if requested_role:
        current_role = getattr(getattr(instance.user, "portal_profile", None), "role", "EMPLOYEE") if instance.user else None
        if requested_role != current_role:
            changes["portal_role"] = requested_role
    return changes


class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminOrHR]

    def get_queryset(self):
        qs = Employee.objects.select_related("user", "user__portal_profile", "team_lead")
        search = self.request.query_params.get("search")
        department = self.request.query_params.get("department")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(employee_code__icontains=search) | Q(email__icontains=search))
        if department:
            qs = qs.filter(department=department)
        return qs

    def perform_create(self, serializer):
        employee = serializer.save()
        notify_employee_change(
            employee,
            self.request.user,
            "Employee profile created",
            "employee_created",
            "created",
        )

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        changes = requested_employee_changes(serializer)
        employee = serializer.save()
        if not changes:
            return

        if "status" in changes and old_status != "Active" and employee.status == "Active":
            title = "Employee activated"
            category = "employee_activated"
            action = "activated"
        elif "status" in changes and employee.status == "Inactive":
            title = "Employee deactivated"
            category = "employee_deactivated"
            action = "deactivated"
        else:
            title = "Employee profile updated"
            category = "employee_updated"
            action = "updated"

        notify_employee_change(employee, self.request.user, title, category, action)
