from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import viewsets

from portal.models import Employee, Meeting
from portal.permissions import IsAdminOrHRWriteReadOnly, portal_role
from portal.serializers import MeetingSerializer
from portal.services.notifications import create_notifications


def active_users_with_roles(roles):
    return User.objects.filter(is_active=True, portal_profile__role__in=roles).select_related("portal_profile")


def intended_meeting_users(meeting):
    employees = Employee.objects.filter(user__is_active=True, status="Active").select_related("user")
    if meeting.department and meeting.department != "All Employees":
        employees = employees.filter(department=meeting.department)
    return [employee.user for employee in employees if employee.user_id]


def meeting_management_recipients(actor):
    actor_role = portal_role(actor)
    if actor_role == "ADMIN":
        return active_users_with_roles(("HR",))
    if actor_role == "HR":
        return active_users_with_roles(("ADMIN",))
    return User.objects.none()


def meeting_time(meeting):
    return meeting.time.strftime("%H:%M") if hasattr(meeting.time, "strftime") else str(meeting.time)[:5]


def notify_meeting_recipients(meeting, actor, title, category, action):
    create_notifications(
        [*intended_meeting_users(meeting), *meeting_management_recipients(actor)],
        title,
        f"Meeting '{meeting.title}' on {meeting.date} at {meeting_time(meeting)} was {action}.",
        category=category,
        exclude_user=actor,
    )


class MeetingViewSet(viewsets.ModelViewSet):
    serializer_class = MeetingSerializer
    permission_classes = [IsAdminOrHRWriteReadOnly]

    def get_queryset(self):
        qs = Meeting.objects.all()
        if portal_role(self.request.user) in ("ADMIN", "HR"):
            return qs
        department = getattr(getattr(self.request.user, "employee", None), "department", "")
        return qs.filter(Q(department="All Employees") | Q(department=department))

    def perform_create(self, serializer):
        meeting = serializer.save(created_by=self.request.user)
        notify_meeting_recipients(
            meeting,
            self.request.user,
            "Meeting scheduled",
            "meeting_created",
            "scheduled",
        )

    def perform_update(self, serializer):
        meeting = serializer.save()
        notify_meeting_recipients(
            meeting,
            self.request.user,
            "Meeting updated",
            "meeting_updated",
            "updated",
        )

    def perform_destroy(self, instance):
        meeting = instance
        actor = self.request.user
        recipients = [*intended_meeting_users(meeting), *meeting_management_recipients(actor)]
        title = meeting.title
        date = meeting.date
        time = meeting_time(meeting)
        meeting.delete()
        create_notifications(
            recipients,
            "Meeting cancelled",
            f"Meeting '{title}' on {date} at {time} was cancelled.",
            category="meeting_cancelled",
            exclude_user=actor,
        )
