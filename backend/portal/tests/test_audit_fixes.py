from datetime import date
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from portal.models import AttendanceRecord, Client, Department, DynamicRole, Employee, LeaveRequest, UserRole, WorkAssignment
from portal.services.kpi_service import KPIService


class AuditFixesTestCase(APITestCase):
    def setUp(self):
        self.super_role, _ = DynamicRole.objects.get_or_create(
            code="SUPER_ADMIN",
            defaults={"name": "Super Admin", "is_superadmin_wildcard": True, "is_system_role": True}
        )
        self.team_lead_role, _ = DynamicRole.objects.get_or_create(
            code="TEAM_LEAD",
            defaults={"name": "Team Lead", "is_system_role": True}
        )
        self.emp_role, _ = DynamicRole.objects.get_or_create(
            code="EMPLOYEE",
            defaults={"name": "Employee", "is_system_role": True}
        )

        self.dept_dev, _ = Department.objects.get_or_create(name="Development", defaults={"display_order": 1})
        self.dept_design, _ = Department.objects.get_or_create(name="Design", defaults={"display_order": 2})
        self.client_obj, _ = Client.objects.get_or_create(name="Test Client")

        # 1. Super Admin User
        self.super_user = User.objects.create_superuser("super_admin", "super@flumenx.com", "pass123")
        UserRole.objects.create(user=self.super_user, role="SUPER_ADMIN", dynamic_role=self.super_role)

        # 2. Team Lead User & Employee
        self.tl_user = User.objects.create_user("team_lead", "tl@flumenx.com", "pass123")
        UserRole.objects.create(user=self.tl_user, role="TEAM_LEAD", dynamic_role=self.team_lead_role)
        self.tl_emp = Employee.objects.create(
            user=self.tl_user,
            employee_code="EMP001",
            name="Team Lead User",
            email="tl@flumenx.com",
            department="Development",
            department_ref=self.dept_dev,
            designation="Tech Lead",
            joining_date=date(2025, 1, 1),
            status="Active",
        )

        # 3. Dev Member User & Employee (under TL)
        self.dev_user = User.objects.create_user("dev_member", "dev@flumenx.com", "pass123")
        UserRole.objects.create(user=self.dev_user, role="EMPLOYEE", dynamic_role=self.emp_role)
        self.dev_emp = Employee.objects.create(
            user=self.dev_user,
            employee_code="EMP002",
            name="Dev Member",
            email="dev@flumenx.com",
            department="Development",
            department_ref=self.dept_dev,
            team_lead=self.tl_emp,
            designation="Developer",
            joining_date=date(2025, 1, 1),
            status="Active",
        )

        # 4. Design Member User & Employee (Different department)
        self.des_user = User.objects.create_user("des_member", "des@flumenx.com", "pass123")
        UserRole.objects.create(user=self.des_user, role="EMPLOYEE", dynamic_role=self.emp_role)
        self.des_emp = Employee.objects.create(
            user=self.des_user,
            employee_code="EMP003",
            name="Design Member",
            email="des@flumenx.com",
            department="Design",
            department_ref=self.dept_design,
            designation="Designer",
            joining_date=date(2025, 1, 1),
            status="Active",
        )

    def test_kpi_dashboard_query_count(self):
        """Verify KPIService.get_dashboard executes <= 10 database queries."""
        from django.test.utils import CaptureQueriesContext
        from django.db import connection
        with CaptureQueriesContext(connection) as context:
            data = KPIService.get_dashboard(month=8, year=2026)
            self.assertEqual(data["total_employees"], 3)
        self.assertLessEqual(len(context), 10)

    def test_super_admin_dashboard_metrics(self):
        """Verify SUPER_ADMIN receives administrative metrics on /api/dashboard/."""
        self.client.force_authenticate(user=self.super_user)
        res = self.client.get("/api/dashboard/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("total_employees", res.data)
        self.assertIn("active_employees", res.data)
        self.assertIn("pending_leaves", res.data)

    def test_super_admin_leave_creation(self):
        """Verify SUPER_ADMIN can create a leave request on behalf of an employee."""
        self.client.force_authenticate(user=self.super_user)
        payload = {
            "employee": self.dev_emp.id,
            "leave_type": "Sick",
            "start_date": "2026-09-01",
            "end_date": "2026-09-02",
            "reason": "Family function",
        }
        res = self.client.post("/api/leaves/", data=payload, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(LeaveRequest.objects.filter(employee=self.dev_emp).count(), 1)

    def test_team_lead_check_in(self):
        """Verify TEAM_LEAD user with an Employee profile can mark check-in."""
        self.client.force_authenticate(user=self.tl_user)
        res = self.client.post("/api/attendance/check-in/")
        self.assertIn(res.status_code, (201, 409))
        self.assertTrue(AttendanceRecord.objects.filter(employee=self.tl_emp).exists())

    def test_team_lead_task_reassignment_restriction(self):
        """Verify TEAM_LEAD cannot re-assign an existing task to an employee outside their team via PATCH."""
        self.client.force_authenticate(user=self.super_user)
        assignment = WorkAssignment.objects.create(
            title="Dev Task",
            client=self.client_obj,
            employee=self.dev_emp,
            assigned_by=self.super_user,
            assigned_date=date(2026, 8, 1),
            due_date=date(2026, 8, 20),
            status="In Progress",
        )

        self.client.force_authenticate(user=self.tl_user)
        # Attempt to re-assign task to Design Member (not in TL's team)
        res = self.client.patch(f"/api/work-assignments/{assignment.id}/", data={"employee": self.des_emp.id}, format="json")
        self.assertEqual(res.status_code, 403)
        assignment.refresh_from_db()
        self.assertEqual(assignment.employee_id, self.dev_emp.id)
