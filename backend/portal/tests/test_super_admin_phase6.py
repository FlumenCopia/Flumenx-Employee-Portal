from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from portal.models import Client, Department, DynamicRole, Employee, WorkAssignment, UserRole


class SuperAdminPhase6TaskFormTests(APITestCase):
    def setUp(self):
        call_command("seed_rbac")

        # 1. Super Admin User
        self.super_user = User.objects.create_superuser(
            username="super_task@flumenx.com", email="super_task@flumenx.com", password="Password123!"
        )
        super_role = DynamicRole.objects.get(code="SUPER_ADMIN")
        UserRole.objects.create(user=self.super_user, role="SUPER_ADMIN", dynamic_role=super_role)

        # 2. Reviewer / Admin User
        self.reviewer_user = User.objects.create_user(
            username="reviewer_task@flumenx.com", email="reviewer_task@flumenx.com", password="Password123!", first_name="Admin Reviewer"
        )
        admin_role = DynamicRole.objects.get(code="ADMIN")
        UserRole.objects.create(user=self.reviewer_user, role="ADMIN", dynamic_role=admin_role)

        # 3. Employee & Department
        self.dept_design = Department.objects.get(code="DESIGN")
        self.emp_user = User.objects.create_user(
            username="designer_task@flumenx.com", email="designer_task@flumenx.com", password="Password123!"
        )
        emp_role = DynamicRole.objects.get(code="EMPLOYEE")
        UserRole.objects.create(user=self.emp_user, role="EMPLOYEE", dynamic_role=emp_role)

        self.employee = Employee.objects.create(
            user=self.emp_user,
            employee_code="EMP-DES-01",
            name="Design Specialist",
            email="designer_task@flumenx.com",
            phone="1234567890",
            department="Design",
            department_ref=self.dept_design,
            designation="Graphic Designer",
            joining_date="2026-01-01",
        )

        self.client_default, _ = Client.objects.get_or_create(name="General")

    # 1. SIMPLIFIED TASK CREATE SUCCEEDS WITH ALL REQUIRED FIELDS
    def test_simplified_task_create_success(self):
        self.client.force_authenticate(user=self.super_user)
        payload = {
            "title": "Launch Poster Design Series",
            "description": "Produce 5 countdown posters for brand campaign. [PHASE: ph2] [EST_HOURS: 8]",
            "priority": "High",
            "employee": self.employee.id,
            "reviewer": self.reviewer_user.id,
            "assigned_date": "2026-08-10",
            "due_date": "2026-08-25",
            "assigned_quantity": 5,
            "unit": "tasks",
        }
        res = self.client.post("/api/work-assignments/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["title"], "Launch Poster Design Series")
        self.assertEqual(res.data["employee"], self.employee.id)
        self.assertEqual(res.data["reviewer"], self.reviewer_user.id)
        self.assertEqual(res.data["assigned_quantity"], 5)
        self.assertEqual(res.data["status"], "Pending")

    # 2. TITLE REQUIRED VALIDATION
    def test_title_required(self):
        self.client.force_authenticate(user=self.super_user)
        payload = {
            "title": "   ",
            "employee": self.employee.id,
            "assigned_date": "2026-08-10",
            "due_date": "2026-08-25",
        }
        res = self.client.post("/api/work-assignments/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # 3. COUNTS TOWARD MAPS TO ASSIGNED_QUANTITY
    def test_counts_toward_maps_to_assigned_quantity(self):
        self.client.force_authenticate(user=self.super_user)
        payload = {
            "title": "Web Landing Page Polish",
            "employee": self.employee.id,
            "assigned_date": "2026-08-10",
            "due_date": "2026-08-30",
            "assigned_quantity": 3,
        }
        res = self.client.post("/api/work-assignments/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        wa = WorkAssignment.objects.get(id=res.data["id"])
        self.assertEqual(wa.assigned_quantity, 3)

    # 4. HIDDEN LEGACY FIELDS PRESERVED ON EDIT
    def test_hidden_legacy_fields_preserved_on_edit(self):
        self.client.force_authenticate(user=self.super_user)
        wa = WorkAssignment.objects.create(
            employee=self.employee,
            client=self.client_default,
            title="Initial Work Title",
            description="Initial Brief [PHASE: ph1] [EST_HOURS: 4]",
            priority="Normal",
            assigned_date="2026-08-01",
            due_date="2026-08-15",
            status="Pending",
            assigned_quantity=10,
            completed_quantity=0,
            unit="items",
            reviewer=self.reviewer_user,
        )

        patch_payload = {
            "title": "Updated Work Title",
            "description": "Updated Brief [PHASE: ph2] [EST_HOURS: 6]",
            "priority": "Urgent",
            "due_date": "2026-08-20",
        }
        res = self.client.patch(f"/api/work-assignments/{wa.id}/", patch_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        wa.refresh_from_db()
        self.assertEqual(wa.title, "Updated Work Title")
        self.assertEqual(wa.priority, "Urgent")
        # Legacy fields preserved intact!
        self.assertEqual(wa.client, self.client_default)
        self.assertEqual(wa.assigned_date.strftime("%Y-%m-%d"), "2026-08-01")
        self.assertEqual(wa.completed_quantity, 0)
        self.assertEqual(wa.assigned_quantity, 10)
        self.assertEqual(wa.unit, "items")

    # 5. REVIEWER WORKFLOW REMAINS WORKING
    def test_reviewer_workflow_after_simplified_create(self):
        self.client.force_authenticate(user=self.super_user)
        payload = {
            "title": "Reviewer Test Task",
            "employee": self.employee.id,
            "reviewer": self.reviewer_user.id,
            "assigned_date": "2026-08-10",
            "due_date": "2026-08-30",
            "assigned_quantity": 1,
        }
        res_create = self.client.post("/api/work-assignments/", payload, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        wa_id = res_create.data["id"]

        # Employee submits for review
        self.client.force_authenticate(user=self.emp_user)
        res_review = self.client.patch(f"/api/work-assignments/{wa_id}/", {"status": "In Review"}, format="json")
        self.assertEqual(res_review.status_code, status.HTTP_200_OK)

        # Reviewer approves
        self.client.force_authenticate(user=self.reviewer_user)
        res_approve = self.client.patch(f"/api/work-assignments/{wa_id}/", {"status": "Approved"}, format="json")
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)

        # Reviewer publishes
        res_publish = self.client.patch(f"/api/work-assignments/{wa_id}/", {"status": "Published"}, format="json")
        self.assertEqual(res_publish.status_code, status.HTTP_200_OK)

        wa = WorkAssignment.objects.get(id=wa_id)
        self.assertEqual(wa.status, "Published")
