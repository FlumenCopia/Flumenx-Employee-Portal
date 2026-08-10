from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from portal.models import Department, DynamicRole, Employee, UserRole


class SuperAdminPhase5DepartmentTests(APITestCase):
    def setUp(self):
        call_command("seed_rbac")

        # Super Admin User
        self.super_user = User.objects.create_superuser(
            username="super_dept@flumenx.com", email="super_dept@flumenx.com", password="Password123!"
        )
        super_role = DynamicRole.objects.get(code="SUPER_ADMIN")
        UserRole.objects.create(user=self.super_user, role="SUPER_ADMIN", dynamic_role=super_role)

        # Admin User
        self.admin_user = User.objects.create_user(
            username="admin_dept@flumenx.com", email="admin_dept@flumenx.com", password="Password123!"
        )
        admin_role = DynamicRole.objects.get(code="ADMIN")
        UserRole.objects.create(user=self.admin_user, role="ADMIN", dynamic_role=admin_role)

        # Employee User
        self.emp_user = User.objects.create_user(
            username="emp_dept@flumenx.com", email="emp_dept@flumenx.com", password="Password123!"
        )
        emp_role = DynamicRole.objects.get(code="EMPLOYEE")
        UserRole.objects.create(user=self.emp_user, role="EMPLOYEE", dynamic_role=emp_role)

    # 1. SUPER ADMIN CAN CREATE DEPARTMENT
    def test_super_admin_create_department(self):
        self.client.force_authenticate(user=self.super_user)
        payload = {
            "name": "Artificial Intelligence",
            "code": "ARTIFICIAL_INTELLIGENCE",
            "description": "AI & Machine Learning Team",
            "display_order": 8,
            "is_active": True,
        }
        res = self.client.post("/api/portal/departments/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "Artificial Intelligence")
        self.assertEqual(res.data["code"], "ARTIFICIAL_INTELLIGENCE")

    # 2. NON-SUPER ADMIN RECEIVES 403 FORBIDDEN
    def test_non_super_admin_forbidden_management(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {"name": "Security Ops", "code": "SECURITY_OPS"}

        res_post = self.client.post("/api/portal/departments/", payload, format="json")
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

        dept = Department.objects.first()
        res_patch = self.client.patch(f"/api/portal/departments/{dept.id}/", {"name": "Changed"}, format="json")
        self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN)

        res_del = self.client.delete(f"/api/portal/departments/{dept.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_403_FORBIDDEN)

    # 3. DUPLICATE DEPARTMENT REJECTED
    def test_duplicate_department_rejected(self):
        self.client.force_authenticate(user=self.super_user)
        payload = {"name": "Web Development", "code": "WEB_DEVELOPMENT"}
        res = self.client.post("/api/portal/departments/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 4. INACTIVE DEPARTMENT EXCLUDED FROM NON-SUPER ADMIN LIST
    def test_inactive_department_filtering(self):
        self.client.force_authenticate(user=self.super_user)
        Department.objects.create(name="Legacy Unit", code="LEGACY_UNIT", is_active=False)

        # Super Admin sees all departments including inactive
        res_super = self.client.get("/api/portal/departments/")
        self.assertEqual(res_super.status_code, status.HTTP_200_OK)
        results_super = res_super.data.get("results", res_super.data) if isinstance(res_super.data, dict) else res_super.data
        all_codes = [d["code"] for d in results_super]
        self.assertIn("LEGACY_UNIT", all_codes)

        # Non-Super Admin sees active departments only
        self.client.force_authenticate(user=self.emp_user)
        res_emp = self.client.get("/api/portal/departments/")
        self.assertEqual(res_emp.status_code, status.HTTP_200_OK)
        results_emp = res_emp.data.get("results", res_emp.data) if isinstance(res_emp.data, dict) else res_emp.data
        emp_codes = [d["code"] for d in results_emp]
        self.assertNotIn("LEGACY_UNIT", emp_codes)

    # 5. CANNOT DELETE DEPARTMENT ASSIGNED TO EMPLOYEES
    def test_cannot_delete_assigned_department(self):
        self.client.force_authenticate(user=self.super_user)
        dept = Department.objects.get(code="WEB_DEVELOPMENT")

        # Create an employee in this department
        emp = Employee.objects.create(
            employee_code="EMP-TEST-DEPT",
            name="Test Dept Emp",
            email="deptemp@flumenx.com",
            phone="123",
            department="Web Development",
            department_ref=dept,
            designation="Developer",
            joining_date="2026-01-01",
        )

        res_del = self.client.delete(f"/api/portal/departments/{dept.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigned to employees", res_del.data["detail"].lower())

    # 6. SEED LINKS LEGACY EMPLOYEES AND PRESERVES STRING
    def test_seed_links_legacy_employees(self):
        legacy_emp = Employee.objects.create(
            employee_code="EMP-LEGACY-001",
            name="Legacy Emp",
            email="legacyemp@flumenx.com",
            phone="123",
            department="Video Editing",
            department_ref=None,
            designation="Video Editor",
            joining_date="2025-01-01",
        )
        call_command("seed_rbac")
        legacy_emp.refresh_from_db()
        self.assertEqual(legacy_emp.department, "Video Editing")
        self.assertIsNotNone(legacy_emp.department_ref)
        self.assertEqual(legacy_emp.department_ref.code, "VIDEO_EDITING")

    # 7. ADD USER WITH DEPARTMENT_ID SYNCHRONIZES STRINGS AND REF
    def test_add_user_with_department_id(self):
        self.client.force_authenticate(user=self.super_user)
        dept = Department.objects.get(code="DESIGN")
        drole = DynamicRole.objects.get(code="EMPLOYEE")

        payload = {
            "full_name": "Designer User",
            "work_email": "designer@flumenx.com",
            "initial_password": "Password123!",
            "designation": "UI Designer",
            "department_id": dept.id,
            "dynamic_role_id": drole.id,
        }

        res = self.client.post("/api/portal/super-admin/users/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        created_user = User.objects.get(email="designer@flumenx.com")
        emp = created_user.employee
        self.assertEqual(emp.department_ref, dept)
        self.assertEqual(emp.department, "Design")
