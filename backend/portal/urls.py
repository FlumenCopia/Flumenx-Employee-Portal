from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import AnnouncementViewSet, AttendanceCorrectionViewSet, AttendancePolicyViewSet, AttendanceRecordViewSet, AuditLogViewSet, ClientViewSet, EmployeeViewSet, LeaveViewSet, LoginView, MeetingViewSet, NotificationViewSet, SalarySlipViewSet, WorkAssignmentViewSet, WorkDeliverableViewSet, WorkEmployeeOptionsView, csrf, dashboard, logout, me, refresh, register

router = DefaultRouter()
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
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/register/", register, name="register"),
    path("auth/logout/", logout, name="logout"),
    path("auth/refresh/", refresh, name="refresh"),
    path("auth/csrf/", csrf, name="csrf"),
    path("auth/me/", me, name="me"),
    path("dashboard/", dashboard, name="dashboard"),
    path("work-employee-options/", WorkEmployeeOptionsView.as_view(), name="work-employee-options"),
    path("", include(router.urls)),
]
