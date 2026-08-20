from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, ProtectedError, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from portal.models import Client, Employee, WorkAssignment, WorkDeliverable
from portal.permissions import IsWorkAssignmentUser, IsWorkClientUser, portal_role, WORK_CREATOR_ROLES
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
            (Q(team_lead=lead) | (Q(team_lead__isnull=True) & (dept_q | dept_ref_q))) & ~Q(id=lead.id)
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
    module_code = "TASKS"
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
        if params.get("review_status"):
            qs = qs.filter(review_status=params["review_status"])
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

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        user = request.user
        role = str(portal_role(user)).upper()
        if role not in WORK_CREATOR_ROLES and not user.is_superuser and not user.is_staff:
            raise PermissionDenied("Only management and authorized roles can create work assignments.")

        data = request.data
        tasks_data = data.get("tasks", [])
        if not isinstance(tasks_data, list) or len(tasks_data) == 0:
            return Response({"error": "At least one task row must be provided under 'tasks'."}, status=status.HTTP_400_BAD_REQUEST)

        client_val = data.get("client") or data.get("client_id")
        employee_val = data.get("employee") or data.get("employee_id")
        work_type = data.get("work_type") or data.get("department") or "web_development"
        priority = data.get("priority") or "Normal"

        if not client_val:
            return Response({"client": ["Client is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not employee_val:
            return Response({"employee": ["Assigned employee is required."]}, status=status.HTTP_400_BAD_REQUEST)

        client_obj = Client.objects.filter(id=client_val).first() if str(client_val).isdigit() else Client.objects.filter(name__iexact=str(client_val).strip()).first()
        if not client_obj:
            return Response({"client": [f"Invalid client ID or name '{client_val}'."]}, status=status.HTTP_400_BAD_REQUEST)

        emp_obj = Employee.objects.filter(id=employee_val).first() if str(employee_val).isdigit() else Employee.objects.filter(name__iexact=str(employee_val).strip()).first()
        if not emp_obj:
            return Response({"employee": [f"Invalid employee ID or name '{employee_val}'."]}, status=status.HTTP_400_BAD_REQUEST)

        if role == "TEAM_LEAD":
            allowed_qs = active_employee_options_for_user(user)
            if not allowed_qs.filter(id=emp_obj.id).exists():
                raise PermissionDenied("You can only assign tasks to members of your own team.")

        reviewer_user, reviewer_name = self.resolve_reviewer()

        created_assignments = []
        validation_errors = []

        with transaction.atomic():
            for idx, task_item in enumerate(tasks_data):
                title = (task_item.get("title") or "").strip()
                due_date = task_item.get("due_date")
                desc = (task_item.get("description") or data.get("description") or "").strip()

                if not title:
                    validation_errors.append({"row": idx + 1, "title": ["Task title is required."]})
                    continue

                if not due_date:
                    validation_errors.append({"row": idx + 1, "due_date": ["Due date is required."]})
                    continue

                assigned_date = task_item.get("assigned_date") or data.get("assigned_date") or timezone.localdate()

                assignment_data = {
                    "client": client_obj.id,
                    "employee": emp_obj.id,
                    "title": title,
                    "description": desc,
                    "work_type": work_type,
                    "priority": priority,
                    "assigned_date": assigned_date,
                    "due_date": due_date,
                    "status": "Assigned",
                    "assigned_quantity": 1,
                    "unit": "Task",
                }

                serializer = self.get_serializer(data=assignment_data)
                if not serializer.is_valid():
                    validation_errors.append({"row": idx + 1, "errors": serializer.errors})
                else:
                    assignment = serializer.save(assigned_by=user, reviewer=reviewer_user, reviewer_name=reviewer_name)
                    notify_work_assigned(assignment, user)
                    created_assignments.append(assignment)

            if validation_errors:
                transaction.set_rollback(True)
                return Response({
                    "error": "Validation failed for one or more tasks.",
                    "details": validation_errors
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(self.get_serializer(created_assignments, many=True).data, status=status.HTTP_201_CREATED)

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
        user = self.request.user
        role = str(portal_role(user)).upper()
        if role == "TEAM_LEAD" and "employee" in serializer.validated_data:
            assigned_emp = serializer.validated_data.get("employee")
            allowed_qs = active_employee_options_for_user(user)
            if assigned_emp and not allowed_qs.filter(id=assigned_emp.id).exists():
                raise PermissionDenied("You can only assign tasks to members of your own team.")

        old_assignment = self.get_object()
        old_status = old_assignment.status
        old_progress = old_assignment.progress
        assignment = serializer.save()
        recipient = assignment_employee_user(assignment)
        if assignment.status != old_status:
            title = f"Work status updated: {assignment.status}"
            message = f"Work {work_title(assignment)} status changed to {assignment.status}."
            create_notifications([recipient], title, message, category="work_status", exclude_user=user)
        elif assignment.progress != old_progress:
            title = f"Work progress updated: {assignment.progress}%"
            message = f"Work {work_title(assignment)} progress is now {assignment.progress}%."
            create_notifications([recipient], title, message, category="work_progress", exclude_user=user)

    def perform_destroy(self, instance):
        recipient = assignment_employee_user(instance)
        title = "Work assignment deleted"
        message = f"Work {work_title(instance)} was deleted."
        actor = self.request.user
        instance.delete()
        create_notifications([recipient], title, message, category="work_deleted", exclude_user=actor)

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        assignment = self.get_object()
        user = request.user
        role = str(portal_role(user)).upper()

        is_assigned_emp = assignment.employee and assignment.employee.user_id == user.id
        is_rev_user = assignment.reviewer_id and assignment.reviewer_id == user.id
        is_creator_mgmt = assignment.assigned_by_id and assignment.assigned_by_id == user.id and role in ("SUPER_ADMIN", "ADMIN", "HR", "TEAM_LEAD", "OPERATIONS_HEAD")
        is_mgmt = role in ("SUPER_ADMIN", "ADMIN", "HR", "OPERATIONS_HEAD")
        is_lead = role == "TEAM_LEAD" and assignment.employee and assignment.employee.team_lead_id and assignment.employee.team_lead.user_id == user.id

        can_review = (is_rev_user or is_creator_mgmt or is_mgmt or is_lead or user.is_superuser) and not (is_assigned_emp and not (is_mgmt or user.is_superuser))

        if not can_review:
            raise PermissionDenied("You do not have permission to review or quality-audit this work assignment.")

        rev_status = str(request.data.get("review_status", "")).upper()
        note = str(request.data.get("review_note", "")).strip()

        valid_review_statuses = ("PENDING_REVIEW", "OK", "CORRECTION_NEEDED")
        if rev_status not in valid_review_statuses:
            return Response({"detail": "Invalid review_status. Must be PENDING_REVIEW, OK, or CORRECTION_NEEDED."}, status=status.HTTP_400_BAD_REQUEST)

        if rev_status == "CORRECTION_NEEDED" and not note:
            return Response({"detail": "A reviewer note is required when marking Correction Needed."}, status=status.HTTP_400_BAD_REQUEST)

        assignment.review_status = rev_status
        assignment.review_note = note
        assignment.reviewed_by = user
        assignment.reviewed_at = timezone.now()
        assignment.save()

        # Notify assigned employee
        recipient = assignment_employee_user(assignment)
        if recipient and recipient != user:
            if rev_status == "CORRECTION_NEEDED":
                title = f"Correction requested for {work_title(assignment)}"
                msg_text = f"Reviewer Note: {note}" if note else f"Correction requested for {work_title(assignment)}."
                create_notifications([recipient], title, msg_text, category="work_review", exclude_user=user)
            elif rev_status == "OK":
                title = f"{work_title(assignment)} was reviewed and marked OK."
                msg_text = f"{work_title(assignment)} was reviewed by {user.first_name or user.username} and marked OK."
                create_notifications([recipient], title, msg_text, category="work_review", exclude_user=user)

        serializer = self.get_serializer(assignment)
        return Response(serializer.data, status=status.HTTP_200_OK)

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
            review_pending=Count("id", filter=Q(review_status="PENDING_REVIEW")),
            review_ok=Count("id", filter=Q(review_status="OK")),
            review_correction=Count("id", filter=Q(review_status="CORRECTION_NEEDED")),
        )

        q_design = Q(employee__department__iexact="Design") | Q(employee__department__icontains="graphic") | Q(employee__department__icontains="ui") | Q(employee__department__icontains="ux")
        q_marketing = Q(employee__department__iexact="Digital Marketing") | Q(employee__department__icontains="digital marketing") | Q(employee__department__icontains="marketing") | Q(employee__department__icontains="social media") | Q(employee__department__icontains="bde")
        q_web = Q(employee__department__iexact="Web Development") | Q(employee__department__icontains="web development") | Q(employee__department__icontains="web") | Q(employee__department__icontains="software")
        q_video = Q(employee__department__iexact="Video Editing") | Q(employee__department__icontains="video editing") | Q(employee__department__icontains="video") | Q(employee__department__icontains="animation")
        q_deliverable_fallback = Q(deliverables__work_type__in=["design", "video", "web", "it", "ads", "content", "marketing", "web_development", "video_editing", "digital_marketing"])

        relevant_q = q_design | q_marketing | q_web | q_video | (Q(employee__department__isnull=True) & q_deliverable_fallback)

        relevant_qs = client_qs.filter(relevant_q).distinct()
        dept_agg = relevant_qs.aggregate(
            tot_assigned=Sum("assigned_quantity"),
            tot_completed=Sum("completed_quantity"),
            design_a=Sum("assigned_quantity", filter=q_design),
            design_c=Sum("completed_quantity", filter=q_design),
            marketing_a=Sum("assigned_quantity", filter=q_marketing),
            marketing_c=Sum("completed_quantity", filter=q_marketing),
            web_a=Sum("assigned_quantity", filter=q_web),
            web_c=Sum("completed_quantity", filter=q_web),
            video_a=Sum("assigned_quantity", filter=q_video),
            video_c=Sum("completed_quantity", filter=q_video),
        )
        tot_assigned = dept_agg["tot_assigned"] or 0
        tot_completed = dept_agg["tot_completed"] or 0

        overall_pct = 0.0
        if tot_assigned > 0:
            raw_pct = (tot_completed / tot_assigned) * 100.0
            overall_pct = round(max(0.0, min(100.0, raw_pct)), 1)

        def format_cat(a_val, c_val):
            a_val = a_val or 0
            c_val = c_val or 0
            has_w = a_val > 0
            pct_val = round(max(0.0, min(100.0, (c_val / a_val) * 100.0)), 1) if has_w else 0.0
            return {"assigned": a_val, "completed": c_val, "pct": pct_val, "has_work": has_w}

        dept_summary = {
            "design": format_cat(dept_agg["design_a"], dept_agg["design_c"]),
            "marketing": format_cat(dept_agg["marketing_a"], dept_agg["marketing_c"]),
            "web": format_cat(dept_agg["web_a"], dept_agg["web_c"]),
            "video": format_cat(dept_agg["video_a"], dept_agg["video_c"]),
        }

        return Response({
            "total": counts["total"],
            "pending": counts["pending"],
            "in_progress": counts["in_progress"],
            "blocked": counts["blocked"],
            "completed": counts["completed"],
            "overdue": counts["overdue"],
            "review_pending": counts["review_pending"],
            "review_ok": counts["review_ok"],
            "review_correction": counts["review_correction"],
            "total_assigned_qty": tot_assigned,
            "total_completed_qty": tot_completed,
            "overall_progress": overall_pct,
            "dept_progress": dept_summary,
        })
