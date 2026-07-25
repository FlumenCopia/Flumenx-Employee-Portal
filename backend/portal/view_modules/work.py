from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from portal.models import Client, Employee, WorkAssignment
from portal.permissions import IsWorkAssignmentUser, IsWorkClientUser, portal_role
from portal.serializers import ClientSerializer, WorkAssignmentSerializer
from portal.services.notifications import create_notifications


def active_users_with_roles(roles):
    return User.objects.filter(is_active=True, portal_profile__role__in=roles).select_related("portal_profile")


def assignment_employee_user(assignment):
    return assignment.employee.user if assignment.employee and assignment.employee.user_id else None


def work_title(assignment):
    return f"'{assignment.title}' for {assignment.client.name}"


def notify_work_assigned(assignment, actor):
    create_notifications(
        [assignment_employee_user(assignment)],
        "New work assigned",
        f"Work {work_title(assignment)} was assigned to {assignment.employee.name}.",
        category="work_assigned",
        exclude_user=actor,
    )


def notify_work_updated(assignment, actor):
    create_notifications(
        [assignment_employee_user(assignment)],
        "Work assignment updated",
        f"Work {work_title(assignment)} was updated.",
        category="work_updated",
        exclude_user=actor,
    )


def notify_work_completed(assignment, actor):
    create_notifications(
        [assignment.assigned_by, *active_users_with_roles(("ADMIN", "HR"))],
        "Work completed",
        f"{assignment.employee.name} completed work {work_title(assignment)}.",
        category="work_completed",
        exclude_user=actor,
    )


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsWorkClientUser]
    queryset = Client.objects.all()


class WorkEmployeeOptionsView(APIView):
    def get(self, request):
        role = portal_role(request.user)
        qs = Employee.objects.filter(status="Active").order_by("name")
        if role in ("ADMIN", "HR", "BDE"):
            pass
        elif role == "TEAM_LEAD":
            actor_employee = getattr(request.user, "employee", None)
            qs = qs.filter(team_lead=actor_employee) if actor_employee else qs.none()
        else:
            return Response({"detail": "You do not have permission to access work employee options."}, status=status.HTTP_403_FORBIDDEN)

        return Response([{"id": employee.id, "display_name": employee.name} for employee in qs])


class WorkAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = WorkAssignmentSerializer
    permission_classes = [IsWorkAssignmentUser]

    def get_queryset(self):
        qs = WorkAssignment.objects.select_related("employee", "client", "assigned_by")
        role = portal_role(self.request.user)
        if role in ("ADMIN", "HR", "BDE"):
            return self.apply_filters(qs)
        if role == "TEAM_LEAD":
            actor_employee = getattr(self.request.user, "employee", None)
            if not actor_employee:
                return qs.none()
            return self.apply_filters(qs.filter(employee__team_lead=actor_employee))
        employee = getattr(self.request.user, "employee", None)
        if not employee:
            return qs.none()
        return self.apply_filters(qs.filter(employee=employee))

    def apply_filters(self, qs):
        params = self.request.query_params
        if params.get("employee"):
            qs = qs.filter(employee_id=params["employee"])
        if params.get("client"):
            qs = qs.filter(client_id=params["client"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("priority"):
            qs = qs.filter(priority=params["priority"])
        if params.get("due_date"):
            qs = qs.filter(due_date=params["due_date"])
        if params.get("assigned_date"):
            qs = qs.filter(assigned_date=params["assigned_date"])
        overdue = params.get("is_overdue")
        if overdue is not None:
            if overdue.lower() in ("true", "1", "yes"):
                qs = qs.exclude(status="Completed").filter(due_date__lt=timezone.localdate())
            elif overdue.lower() in ("false", "0", "no"):
                qs = qs.filter(Q(status="Completed") | Q(due_date__gte=timezone.localdate()))
        return qs

    def perform_create(self, serializer):
        assignment = serializer.save(assigned_by=self.request.user)
        notify_work_assigned(assignment, self.request.user)

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        requested_changes = {
            field: value
            for field, value in serializer.validated_data.items()
            if getattr(serializer.instance, field) != value
        }
        assignment = serializer.save()
        if not requested_changes:
            return
        if old_status != "Completed" and assignment.status == "Completed":
            notify_work_completed(assignment, self.request.user)
            return
        notify_work_updated(assignment, self.request.user)

    def perform_destroy(self, instance):
        recipient = assignment_employee_user(instance)
        title = "Work assignment deleted"
        message = f"Work {work_title(instance)} was deleted."
        actor = self.request.user
        instance.delete()
        create_notifications([recipient], title, message, category="work_deleted", exclude_user=actor)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        today = timezone.localdate()
        return Response({
            "total": qs.count(),
            "pending": qs.filter(status="Pending").count(),
            "in_progress": qs.filter(status="In Progress").count(),
            "blocked": qs.filter(status="Blocked").count(),
            "completed": qs.filter(status="Completed").count(),
            "overdue": qs.exclude(status="Completed").filter(due_date__lt=today).count(),
        })
