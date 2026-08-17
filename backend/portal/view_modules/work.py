from django.contrib.auth.models import User
from django.db import IntegrityError
from django.db.models import Count, Q, ProtectedError, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
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


def active_employee_options_for_user(user):
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication is required.")
    qs = Employee.objects.filter(status="Active").order_by("name")
    if user.is_superuser or user.is_staff:
        return qs
    role = str(portal_role(user)).upper()
    if role in ("SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD"):
        return qs
    if role == "TEAM_LEAD":
        lead = getattr(user, "employee", None)
        if not lead:
            return qs.none()
        dept_q = Q(department=lead.department) if lead.department else Q()
        dept_ref_q = Q(department_ref=lead.department_ref) if lead.department_ref else Q()
        return qs.filter(
            Q(team_lead=lead) |
            Q(id=lead.id) |
            (Q(team_lead__isnull=True) & (dept_q | dept_ref_q))
        ).distinct().order_by("name")
    emp = getattr(user, "employee", None)
    if emp:
        return qs.filter(id=emp.id)
    return qs.none()


def scoped_work_assignments_for_user(qs, user):
    if not user or not user.is_authenticated:
        return qs.none()
    if user.is_superuser or user.is_staff:
        return qs
    role = str(portal_role(user)).upper()
    if role in ("SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD"):
        return qs
    if role == "TEAM_LEAD":
        lead = getattr(user, "employee", None)
        if not lead:
            return qs.none()
        dept_q = Q(department=lead.department) if lead.department else Q()
        dept_ref_q = Q(department_ref=lead.department_ref) if lead.department_ref else Q()
        team_members = Employee.objects.filter(
            Q(team_lead=lead) |
            Q(id=lead.id) |
            (Q(team_lead__isnull=True) & (dept_q | dept_ref_q))
        )
        return qs.filter(
            Q(employee__in=team_members) |
            Q(reviewer=user) |
            Q(assigned_by=user)
        ).distinct()
    employee = getattr(user, "employee", None)
    if employee:
        return qs.filter(Q(employee=employee) | Q(reviewer=user)).distinct()
    return qs.filter(Q(reviewer=user)).distinct()


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
        qs = active_employee_options_for_user(request.user)
        return Response([{"id": employee.id, "display_name": employee.name, "department": employee.department} for employee in qs])


class WorkReviewerOptionsView(APIView):
    def get(self, request):
        users = User.objects.filter(is_active=True).select_related("employee").order_by("first_name", "username")
        options = []
        for u in users:
            name = u.first_name.strip() if u.first_name and u.first_name.strip() else u.username
            emp = getattr(u, "employee", None)
            if emp:
                name = emp.name
            options.append({"id": u.id, "display_name": name, "username": u.username})
        return Response(options)


class WorkDeliverableViewSet(viewsets.ModelViewSet):
    serializer_class = WorkDeliverableSerializer
    permission_classes = [IsWorkAssignmentUser]

    def get_queryset(self):
        qs = WorkDeliverable.objects.select_related("assignment", "assignment__employee", "assignment__assigned_by", "client")
        assignments = scoped_work_assignments_for_user(WorkAssignment.objects.all(), self.request.user)
        qs = qs.filter(assignment__in=assignments)
        return self.apply_filters(qs)


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
        qs = WorkAssignment.objects.select_related("employee", "client", "assigned_by", "reviewer", "reviewer__employee").prefetch_related("deliverables__client").order_by("-id")
        qs = scoped_work_assignments_for_user(qs, self.request.user)
        return self.apply_filters(qs)

    def apply_filters(self, qs):
        params = getattr(self.request, "query_params", None)
        if params is None:
            params = getattr(self.request, "GET", {})
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

    def resolve_reviewer(self):
        reviewer_val = self.request.data.get("reviewer") or self.request.data.get("reviewer_id") or self.request.data.get("reviewer_name")
        if reviewer_val:
            s_val = str(reviewer_val).strip()
            if s_val.isdigit():
                user_by_id = User.objects.filter(id=int(s_val), is_active=True).first()
                if user_by_id:
                    name = user_by_id.first_name if user_by_id.first_name else user_by_id.username
                    emp = getattr(user_by_id, "employee", None)
                    if emp:
                        name = emp.name
                    return user_by_id, name
                emp_by_id = Employee.objects.filter(id=int(s_val)).select_related("user").first()
                if emp_by_id and emp_by_id.user:
                    return emp_by_id.user, emp_by_id.name
            emp = Employee.objects.filter(Q(name__iexact=s_val) | Q(user__username__iexact=s_val)).select_related("user").first()
            if emp and emp.user:
                return emp.user, emp.name
            user_match = User.objects.filter(Q(username__iexact=s_val) | Q(first_name__iexact=s_val)).first()
            if user_match:
                name = user_match.first_name if user_match.first_name else user_match.username
                return user_match, name
            return None, s_val

        emp = getattr(self.request.user, "employee", None)
        name = emp.name if emp else (self.request.user.first_name or self.request.user.username or "Admin")
        return self.request.user, name

    def perform_create(self, serializer):
        user = self.request.user
        role = str(portal_role(user)).upper()
        if role == "TEAM_LEAD":
            assigned_emp = serializer.validated_data.get("employee")
            allowed_qs = active_employee_options_for_user(user)
            if assigned_emp and not allowed_qs.filter(id=assigned_emp.id).exists():
                raise PermissionDenied("You can only assign tasks to members of your own team.")
        reviewer_user, reviewer_name = self.resolve_reviewer()
        assignment = serializer.save(assigned_by=user, reviewer=reviewer_user, reviewer_name=reviewer_name)
        notify_work_assigned(assignment, user)

    def perform_update(self, serializer):
        instance = serializer.instance
        reviewer_val = self.request.data.get("reviewer") or self.request.data.get("reviewer_id") or self.request.data.get("reviewer_name")
        kwargs = {}
        if reviewer_val:
            reviewer_user, reviewer_name = self.resolve_reviewer()
            if reviewer_user:
                kwargs["reviewer"] = reviewer_user
            if reviewer_name:
                kwargs["reviewer_name"] = reviewer_name

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
        assignment = serializer.save(**kwargs)
        if old_values["status"] != assignment.status:
            assignment.deliverables.all().update(status=assignment.status)
            if assignment.has_deliverables():
                assignment.sync_from_deliverables(save=True)
            else:
                assignment.sync_quantity_state()
                assignment.save()
        changed = any(getattr(assignment, field) != value for field, value in old_values.items())
        if not changed:
            return
        if old_values["status"] != "Completed" and assignment.status in ("Completed", "Approved", "Published"):
            notify_work_completed(assignment, self.request.user)
            return
        notify_work_updated(assignment, self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)
        try:
            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (ProtectedError, IntegrityError):
            return Response(
                {"detail": "Cannot delete work assignment because related items exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def perform_destroy(self, instance):
        recipient = assignment_employee_user(instance)
        title = "Work assignment deleted"
        message = f"Work {work_title(instance)} was deleted."
        actor = self.request.user
        instance.delete()
        create_notifications([recipient], title, message, category="work_deleted", exclude_user=actor)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        base_qs = scoped_work_assignments_for_user(
            WorkAssignment.objects.select_related("employee", "client", "assigned_by").prefetch_related("deliverables"),
            request.user
        )

        client_param = request.query_params.get("client") if hasattr(request, "query_params") else request.GET.get("client")
        if client_param:
            client_qs = base_qs.filter(client_id=client_param)
        else:
            client_qs = base_qs

        view_qs = self.apply_filters(base_qs)
        today = timezone.localdate()
        counts = view_qs.aggregate(
            total=Count("id"),
            pending=Count("id", filter=Q(status__in=["Assigned", "Pending"])),
            in_progress=Count("id", filter=Q(status__in=["In Progress", "Ongoing", "Blocked"])),
            blocked=Count("id", filter=Q(status="Blocked")),
            completed=Count("id", filter=Q(status__in=["Completed", "Approved", "Published"])),
            overdue=Count("id", filter=Q(due_date__lt=today) & ~Q(status__in=["Completed", "Approved", "Published"])),
        )

        q_design = Q(employee__department__iexact="Design") | Q(employee__department__icontains="graphic") | Q(employee__department__icontains="ui") | Q(employee__department__icontains="ux")
        q_marketing = Q(employee__department__iexact="Digital Marketing") | Q(employee__department__icontains="digital marketing") | Q(employee__department__icontains="marketing") | Q(employee__department__icontains="social media") | Q(employee__department__icontains="bde")
        q_web = Q(employee__department__iexact="Web Development") | Q(employee__department__icontains="web development") | Q(employee__department__icontains="web") | Q(employee__department__icontains="software")
        q_video = Q(employee__department__iexact="Video Editing") | Q(employee__department__icontains="video editing") | Q(employee__department__icontains="video") | Q(employee__department__icontains="animation")
        q_deliverable_fallback = Q(deliverables__work_type__in=["design", "video", "web", "it", "ads", "content", "marketing", "web_development", "video_editing", "digital_marketing"])

        relevant_q = q_design | q_marketing | q_web | q_video | (Q(employee__department__isnull=True) & q_deliverable_fallback)

        relevant_qs = client_qs.filter(relevant_q).distinct()
        qty_agg = relevant_qs.aggregate(
            tot_assigned=Sum("assigned_quantity"),
            tot_completed=Sum("completed_quantity"),
        )
        tot_assigned = qty_agg["tot_assigned"] or 0
        tot_completed = qty_agg["tot_completed"] or 0

        overall_pct = 0.0
        if tot_assigned > 0:
            raw_pct = (tot_completed / tot_assigned) * 100.0
            overall_pct = round(max(0.0, min(100.0, raw_pct)), 1)

        def calc_category(q_sub):
            c_qs = relevant_qs.filter(q_sub).distinct()
            c_agg = c_qs.aggregate(a=Sum("assigned_quantity"), c=Sum("completed_quantity"))
            a_val = c_agg["a"] or 0
            c_val = c_agg["c"] or 0
            has_w = a_val > 0
            pct_val = round(max(0.0, min(100.0, (c_val / a_val) * 100.0)), 1) if has_w else 0.0
            return {"assigned": a_val, "completed": c_val, "pct": pct_val, "has_work": has_w}

        dept_summary = {
            "design": calc_category(q_design),
            "marketing": calc_category(q_marketing),
            "web": calc_category(q_web),
            "video": calc_category(q_video),
        }

        return Response({
            "total": counts["total"],
            "pending": counts["pending"],
            "in_progress": counts["in_progress"],
            "blocked": counts["blocked"],
            "completed": counts["completed"],
            "overdue": counts["overdue"],
            "total_assigned_qty": tot_assigned,
            "total_completed_qty": tot_completed,
            "overall_progress": overall_pct,
            "dept_progress": dept_summary,
        })
