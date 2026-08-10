from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter
from .views import (
    AnnouncementViewSet, AttendanceCorrectionViewSet, AttendancePolicyViewSet, AttendanceRecordViewSet,
    AuditLogViewSet, ClientViewSet, DepartmentViewSet, DynamicNavigationView, DynamicRoleViewSet, EmployeeViewSet, EmployeeKPIDetailView,
    KPIDashboardView, KPIExportCSVView, KPIRatingView, LeaveViewSet, LoginView, MeetingViewSet, MyKPIDetailView,
    NotificationViewSet, PasswordResetConfirmView, PasswordResetRequestView, PortalPageViewSet,
    PublicWorkProgressView, RolePermissionMatrixView, SalarySlipViewSet, ShareLinkListCreateView,
    ShareLinkRegenerateView, ShareLinkRevokeView, SuperAdminUserViewSet,
    WorkAssignmentViewSet, WorkDeliverableViewSet, WorkEmployeeOptionsView, WorkReviewerOptionsView,
    csrf, dashboard, logout, me, refresh, register
)


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
router.register("portal/departments", DepartmentViewSet, basename="portal-department")
router.register("portal/pages", PortalPageViewSet, basename="portal-page")
router.register("portal/roles", DynamicRoleViewSet, basename="dynamic-role")
router.register("portal/super-admin/users", SuperAdminUserViewSet, basename="super-admin-user")

urlpatterns = [
    re_path(r"^auth/login/?$", LoginView.as_view(), name="login"),
    re_path(r"^auth/register/?$", register, name="register"),
    re_path(r"^auth/logout/?$", logout, name="logout"),
    re_path(r"^auth/refresh/?$", refresh, name="refresh"),
    re_path(r"^auth/csrf/?$", csrf, name="csrf"),
    re_path(r"^auth/me/?$", me, name="me"),
    re_path(r"^auth/password-reset/?$", PasswordResetRequestView.as_view(), name="password_reset_request"),
    re_path(r"^auth/password-reset/confirm/?$", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),

    re_path(r"^dashboard/?$", dashboard, name="dashboard"),
    re_path(r"^work-employee-options/?$", WorkEmployeeOptionsView.as_view(), name="work-employee-options"),
    re_path(r"^work-reviewer-options/?$", WorkReviewerOptionsView.as_view(), name="work-reviewer-options"),

    re_path(r"^kpi/dashboard/?$", KPIDashboardView.as_view(), name="kpi-dashboard"),
    re_path(r"^kpi/my-kpi/?$", MyKPIDetailView.as_view(), name="kpi-my-detail"),
    re_path(r"^kpi/employee/(?P<employee_id>\d+)/?$", EmployeeKPIDetailView.as_view(), name="kpi-employee-detail"),
    re_path(r"^kpi/rating/?$", KPIRatingView.as_view(), name="kpi-rating"),
    re_path(r"^kpi/export-csv/?$", KPIExportCSVView.as_view(), name="kpi-export-csv"),
    re_path(r"^work-share-links/?$", ShareLinkListCreateView.as_view(), name="work-share-links-list-create"),
    re_path(r"^work-share-links/(?P<pk>\d+)/revoke/?$", ShareLinkRevokeView.as_view(), name="work-share-links-revoke"),
    re_path(r"^work-share-links/(?P<pk>\d+)/regenerate/?$", ShareLinkRegenerateView.as_view(), name="work-share-links-regenerate"),
    re_path(r"^public/work-progress/(?P<token>[A-Za-z0-9_-]+)/?$", PublicWorkProgressView.as_view(), name="public-work-progress"),

    re_path(r"^portal/roles/(?P<role_id>\d+)/permissions/?$", RolePermissionMatrixView.as_view(), name="role-permission-matrix"),
    re_path(r"^portal/navigation/me/?$", DynamicNavigationView.as_view(), name="dynamic-navigation-me"),

    path("", include(router.urls)),
]
