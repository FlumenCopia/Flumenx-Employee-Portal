from django.contrib.auth.models import User
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from portal.models import LeaveRequest
from portal.permissions import IsAdminOrHR, portal_role
from portal.serializers import LeaveSerializer
from portal.services.notifications import create_notifications
from .helpers import log_action


def active_users_with_roles(roles):
    return User.objects.filter(is_active=True, portal_profile__role__in=roles).select_related("portal_profile")


def leave_window(leave):
    return f"{leave.start_date} to {leave.end_date}"


class LeaveViewSet(viewsets.ModelViewSet):
    module_code = "LEAVES"
    serializer_class = LeaveSerializer

    MANAGEMENT_ROLES = ("SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD")
    VIEW_ALL_ROLES = ("SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD", "ACCOUNTANT")

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related("employee", "employee__user")
        role = portal_role(self.request.user)
        if role in self.VIEW_ALL_ROLES:
            return qs
        return qs.filter(employee__user=self.request.user)

    @action(detail=False, methods=["get"], url_path="pending-count")
    def pending_count(self, request):
        return Response({"count": self.get_queryset().filter(status="Pending").count()})

    def perform_create(self, serializer):
        from portal.permissions import has_page_permission
        from rest_framework.exceptions import PermissionDenied
        if not has_page_permission(self.request.user, "LEAVES", "create"):
            raise PermissionDenied("You do not have permission to submit leave requests.")

        if portal_role(self.request.user) in ("SUPER_ADMIN", "ADMIN", "HR") and self.request.data.get("employee"):
            leave = serializer.save(employee_id=self.request.data["employee"])
        else:
            employee = getattr(self.request.user, "employee", None)
            if not employee:
                raise serializers.ValidationError({"detail": "Employee profile is required."})
            leave = serializer.save(employee=employee)
        create_notifications(
            active_users_with_roles(("ADMIN", "HR")),
            "Leave request submitted",
            f"{leave.employee.name} submitted {leave.leave_type.lower()} leave from {leave_window(leave)}.",
            category="leave_submitted",
            exclude_user=self.request.user,
        )

    @action(detail=True, methods=["post"])
    def decide(self, request, pk=None):
        from portal.permissions import has_page_permission
        from rest_framework.exceptions import PermissionDenied

        actor_role = portal_role(request.user)
        if actor_role not in self.MANAGEMENT_ROLES or not has_page_permission(request.user, "LEAVES", "edit"):
            raise PermissionDenied("You do not have permission to approve or reject leave requests.")

        leave = self.get_object()
        decision = request.data.get("status")
        if decision not in ("Approved", "Rejected"):
            return Response({"detail": "Status must be Approved or Rejected."}, status=status.HTTP_400_BAD_REQUEST)
        if leave.status == decision:
            return Response(self.get_serializer(leave).data)
        leave.status = decision
        leave.admin_note = request.data.get("admin_note", "")
        leave.save()
        notification_roles = ("HR",) if actor_role == "ADMIN" else ("ADMIN",)
        create_notifications(
            [leave.employee.user, *active_users_with_roles(notification_roles)],
            f"Leave {decision.lower()}",
            f"{leave.employee.name}'s {leave.leave_type.lower()} leave from {leave_window(leave)} was {decision.lower()}.",
            category=f"leave_{decision.lower()}",
            exclude_user=request.user,
        )
        log_action(request.user, f"Leave {decision}", "LeaveRequest", leave.id)
        return Response(self.get_serializer(leave).data)

    def perform_destroy(self, instance):
        from portal.permissions import has_page_permission
        from rest_framework.exceptions import PermissionDenied

        actor_role = portal_role(self.request.user)
        if actor_role not in self.MANAGEMENT_ROLES or not has_page_permission(self.request.user, "LEAVES", "delete"):
            raise PermissionDenied("You do not have permission to delete leave requests.")

        log_action(self.request.user, "Delete Leave", "LeaveRequest", instance.id)
        instance.delete()
