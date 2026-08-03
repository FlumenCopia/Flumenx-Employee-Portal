from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter
from .views import AnnouncementViewSet, AttendanceCorrectionViewSet, AttendancePolicyViewSet, AttendanceRecordViewSet, AuditLogViewSet, ClientViewSet, EmployeeViewSet, LeaveViewSet, LoginView, MeetingViewSet, NotificationViewSet, SalarySlipViewSet, WorkAssignmentViewSet, WorkDeliverableViewSet, WorkEmployeeOptionsView, csrf, dashboard, logout, me, refresh, register

class OptionalSlashRouter(DefaultRouter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trailing_slash = r"/?$"

router = OptionalSlashRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("clients", ClientViewSet, basename="client")
router.register("work-assignments", WorkAssignmentViewSet, basename="work-assignment")
router.register("work-deliverables", WorkDeliverableViewSet, basename="work-deliverable")
router.register("leaves", LeaveViewSet, basename="leave")
router.register("salary-slips", SalarySlipViewSet, basename="salary-slip")
router.register("meetings", MeetingViewSet, basename="meeting")
router.register("announcements", AnnouncementViewSet, basename="announcement")
router.register("attendance", AttendanceRecordViewSet, basename="attendance")
router.register("attendance-policy", AttendancePolicyViewSet, basename="attendance-policy")
router.register("attendance-corrections", AttendanceCorrectionViewSet, basename="attendance-correction")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")

urlpatterns = [
    re_path(r"^auth/login/?$", LoginView.as_view(), name="login"),
    re_path(r"^auth/register/?$", register, name="register"),
    re_path(r"^auth/logout/?$", logout, name="logout"),
    re_path(r"^auth/refresh/?$", refresh, name="refresh"),
    re_path(r"^auth/csrf/?$", csrf, name="csrf"),
    re_path(r"^auth/me/?$", me, name="me"),
    re_path(r"^dashboard/?$", dashboard, name="dashboard"),
    re_path(r"^work-employee-options/?$", WorkEmployeeOptionsView.as_view(), name="work-employee-options"),
    path("", include(router.urls)),
]
