from datetime import date
from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from portal.models import Department, DynamicRole, Employee, LeaveRequest, PortalPage, RolePermission, UserRole


class LeaveWorkflowTestCase(APITestCase):
    def setUp(self):
        # 1. Super Admin
        self.super_user = User.objects.create_superuser("super_boss", "boss@flumenx.com", "pass123")
        super_role, _ = DynamicRole.objects.get_or_create(code="SUPER_ADMIN", defaults={"name": "Super Admin", "is_superadmin_wildcard": True})
        UserRole.objects.create(user=self.super_user, role="SUPER_ADMIN", dynamic_role=super_role)

        # 2. HR Management User
        self.hr_user = User.objects.create_user("hr_manager", "hr@flumenx.com", "pass123")
        self.hr_role, _ = DynamicRole.objects.get_or_create(code="HR", defaults={"name": "Human Resources"})
        UserRole.objects.create(user=self.hr_user, role="HR", dynamic_role=self.hr_role)

        # 3. Employee A & Employee B
        self.emp_a_user = User.objects.create_user("employee_a", "empa@flumenx.com", "pass123")
        self.emp_b_user = User.objects.create_user("employee_b", "empb@flumenx.com", "pass123")

        self.emp_role, _ = DynamicRole.objects.get_or_create(code="EMPLOYEE", defaults={"name": "Employee"})
        UserRole.objects.create(user=self.emp_a_user, role="EMPLOYEE", dynamic_role=self.emp_role)
        UserRole.objects.create(user=self.emp_b_user, role="EMPLOYEE", dynamic_role=self.emp_role)

        self.dept, _ = Department.objects.get_or_create(name="Development", defaults={"code": "DEV", "display_order": 1})

        self.emp_a = Employee.objects.create(
            user=self.emp_a_user, employee_code="EMP-A", name="Employee A",
            email="empa@flumenx.com", phone="111", department="Development",
            department_ref=self.dept, designation="Developer", joining_date=date.today()
        )
        self.emp_b = Employee.objects.create(
            user=self.emp_b_user, employee_code="EMP-B", name="Employee B",
            email="empb@flumenx.com", phone="222", department="Development",
            department_ref=self.dept, designation="Developer", joining_date=date.today()
        )

        self.page_leaves, _ = PortalPage.objects.get_or_create(
            module_code="LEAVES",
            defaults={"title": "Leave Requests", "route_path": "/leaves", "sidebar_order": 3, "is_active": True}
        )

        # Enable LEAVES view and create for Employee role
        RolePermission.objects.update_or_create(
            role=self.emp_role, page=self.page_leaves,
            defaults={"can_view": True, "can_create": True, "can_edit": False, "can_delete": False}
        )

        # Enable LEAVES view and edit for HR role
        RolePermission.objects.update_or_create(
            role=self.hr_role, page=self.page_leaves,
            defaults={"can_view": True, "can_create": True, "can_edit": True, "can_delete": True}
        )

    def test_employee_data_scoping_isolation(self):
        """Verify Employee A cannot receive Employee B's leave requests on GET /api/leaves/."""
        leave_a = LeaveRequest.objects.create(
            employee=self.emp_a, leave_type="Annual", start_date="2026-09-01", end_date="2026-09-05", reason="Vacation A"
        )
        leave_b = LeaveRequest.objects.create(
            employee=self.emp_b, leave_type="Sick", start_date="2026-09-10", end_date="2026-09-12", reason="Sick B"
        )

        # Employee A requests leaves list
        self.client.force_authenticate(user=self.emp_a_user)
        res_a = self.client.get("/api/leaves/")
        self.assertEqual(res_a.status_code, 200)

        # Results must contain ONLY leave_a
        ids_a = [item["id"] for item in res_a.data["results"]]
        self.assertIn(leave_a.id, ids_a)
        self.assertNotIn(leave_b.id, ids_a)

    def test_management_data_scoping(self):
        """Verify HR management user sees all leave requests across the company."""
        leave_a = LeaveRequest.objects.create(
            employee=self.emp_a, leave_type="Annual", start_date="2026-09-01", end_date="2026-09-05", reason="Vacation A"
        )
        leave_b = LeaveRequest.objects.create(
            employee=self.emp_b, leave_type="Sick", start_date="2026-09-10", end_date="2026-09-12", reason="Sick B"
        )

        self.client.force_authenticate(user=self.hr_user)
        res_hr = self.client.get("/api/leaves/")
        self.assertEqual(res_hr.status_code, 200)

        ids_hr = [item["id"] for item in res_hr.data["results"]]
        self.assertIn(leave_a.id, ids_hr)
        self.assertIn(leave_b.id, ids_hr)

    def test_action_permissions_create_and_decide(self):
        """Verify can_create and can_edit enforcement across API endpoints."""
        leave_b = LeaveRequest.objects.create(
            employee=self.emp_b, leave_type="Sick", start_date="2026-09-10", end_date="2026-09-12", reason="Sick B"
        )

        # 1. Employee A attempts to decide (approve) Employee B's leave -> 403 Forbidden
        self.client.force_authenticate(user=self.emp_a_user)
        res_decide_emp = self.client.post(f"/api/leaves/{leave_b.id}/decide/", data={"status": "Approved"}, format="json")
        self.assertEqual(res_decide_emp.status_code, 403)

        # 2. Disable can_create for Employee role -> POST /api/leaves/ returns 403
        perm = RolePermission.objects.get(role=self.emp_role, page=self.page_leaves)
        perm.can_create = False
        perm.save()

        payload = {"leave_type": "Personal", "start_date": "2026-10-01", "end_date": "2026-10-02", "reason": "Personal work"}
        res_post_denied = self.client.post("/api/leaves/", data=payload, format="json")
        self.assertEqual(res_post_denied.status_code, 403)

        # 3. HR approves leave_b when can_edit=True -> 200 OK
        self.client.force_authenticate(user=self.hr_user)
        res_decide_hr = self.client.post(f"/api/leaves/{leave_b.id}/decide/", data={"status": "Approved", "admin_note": "Approved by HR"}, format="json")
        self.assertEqual(res_decide_hr.status_code, 200)

        leave_b.refresh_from_db()
        self.assertEqual(leave_b.status, "Approved")
        self.assertEqual(leave_b.admin_note, "Approved by HR")
