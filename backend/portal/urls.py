from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import AnnouncementViewSet, AttendanceCorrectionViewSet, AttendancePolicyViewSet, AttendanceRecordViewSet, AuditLogViewSet, EmployeeViewSet, LeaveViewSet, LoginView, MeetingViewSet, NotificationViewSet, SalarySlipViewSet, dashboard, logout, me, register

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
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
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/me/", me, name="me"),
    path("dashboard/", dashboard, name="dashboard"),
    path("", include(router.urls)),
]
