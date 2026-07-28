from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from portal.models import Client, Employee, WorkAssignment, WorkDeliverable
from portal.permissions import IsWorkAssignmentUser, IsWorkClientUser, portal_role
from portal.serializers import ClientSerializer, WorkAssignmentSerializer, WorkDeliverableSerializer
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

        return Response([{"id": employee.id, "display_name": employee.name, "department": employee.department} for employee in qs])


class WorkDeliverableViewSet(viewsets.ModelViewSet):
    serializer_class = WorkDeliverableSerializer
    permission_classes = [IsWorkAssignmentUser]

    def get_queryset(self):
        qs = WorkDeliverable.objects.select_related("assignment", "assignment__employee", "assignment__assigned_by", "client")
        role = portal_role(self.request.user)
        if role in ("ADMIN", "HR", "BDE"):
            return self.apply_filters(qs)
        if role == "TEAM_LEAD":
            actor_employee = getattr(self.request.user, "employee", None)
            if not actor_employee:
                return qs.none()
            return self.apply_filters(qs.filter(assignment__employee__team_lead=actor_employee))
        employee = getattr(self.request.user, "employee", None)
        if not employee:
            return qs.none()
        return self.apply_filters(qs.filter(assignment__employee=employee))

    def apply_filters(self, qs):
        params = self.request.query_params
        if params.get("assignment"):
            qs = qs.filter(assignment_id=params["assignment"])
        if params.get("employee"):
            qs = qs.filter(assignment__employee_id=params["employee"])
        if params.get("client"):
            qs = qs.filter(client_id=params["client"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("work_type"):
            qs = qs.filter(work_type__iexact=params["work_type"])
        if params.get("due_date"):
            qs = qs.filter(due_date=params["due_date"])
        overdue = params.get("is_overdue")
        if overdue is not None:
            if overdue.lower() in ("true", "1", "yes"):
                qs = qs.exclude(status="Completed").filter(due_date__lt=timezone.localdate())
            elif overdue.lower() in ("false", "0", "no"):
                qs = qs.filter(Q(status="Completed") | Q(due_date__gte=timezone.localdate()))
        return qs

    def perform_create(self, serializer):
        deliverable = serializer.save()
        notify_work_updated(deliverable.assignment, self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        assignment = instance.assignment
        old_assignment_status = assignment.status
        old_values = {
            "client_id": instance.client_id,
            "title": instance.title,
            "brief": instance.brief,
            "work_type": instance.work_type,
            "due_date": instance.due_date,
            "status": instance.status,
            "completed_at": instance.completed_at,
        }
        deliverable = serializer.save()
        changed = any(getattr(deliverable, field) != value for field, value in old_values.items())
        if not changed:
            return
        deliverable.assignment.refresh_from_db()
        if old_assignment_status != "Completed" and deliverable.assignment.status == "Completed":
            notify_work_completed(deliverable.assignment, self.request.user)
            return
        notify_work_updated(deliverable.assignment, self.request.user)

    def perform_destroy(self, instance):
        assignment = instance.assignment
        actor = self.request.user
        instance.delete()
        notify_work_updated(assignment, actor)


class WorkAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = WorkAssignmentSerializer
    permission_classes = [IsWorkAssignmentUser]

    def get_queryset(self):
        qs = WorkAssignment.objects.select_related("employee", "client", "assigned_by").prefetch_related("deliverables__client")
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
        instance = serializer.instance
        old_values = {
            "employee_id": instance.employee_id,
            "client_id": instance.client_id,
            "title": instance.title,
            "description": instance.description,
            "priority": instance.priority,
            "assigned_date": instance.assigned_date,
            "due_date": instance.due_date,
            "status": instance.status,
            "progress": instance.progress,
            "assigned_quantity": instance.assigned_quantity,
            "completed_quantity": instance.completed_quantity,
            "unit": instance.unit,
            "completed_at": instance.completed_at,
        }
        assignment = serializer.save()
        changed = any(getattr(assignment, field) != value for field, value in old_values.items())
        if not changed:
            return
        if old_values["status"] != "Completed" and assignment.status == "Completed":
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
        counts = qs.aggregate(
            total=Count("id"),
            pending=Count("id", filter=Q(status="Pending")),
            in_progress=Count("id", filter=Q(status="In Progress")),
            blocked=Count("id", filter=Q(status="Blocked")),
            completed=Count("id", filter=Q(status="Completed")),
            overdue=Count("id", filter=Q(due_date__lt=today) & ~Q(status="Completed")),
        )
        return Response({
            "total": counts["total"],
            "pending": counts["pending"],
            "in_progress": counts["in_progress"],
            "blocked": counts["blocked"],
            "completed": counts["completed"],
            "overdue": counts["overdue"],
        })
