from datetime import date
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from portal.models import Client, Employee, UserRole, WorkAssignment


class WorkReviewerWorkflowTests(TestCase):
    def setUp(self):
        self.client_api = APIClient()

        # Users & Roles
        self.admin = User.objects.create_superuser("admin_test", "admin@test.com", "pass123")
        UserRole.objects.create(user=self.admin, role="ADMIN")

        self.hr_user = User.objects.create_user("hr_test", "hr@test.com", "pass123")
        UserRole.objects.create(user=self.hr_user, role="HR")

        self.tl_user = User.objects.create_user("tl_test", "tl@test.com", "pass123")
        UserRole.objects.create(user=self.tl_user, role="TEAM_LEAD")

        self.ops_head = User.objects.create_user("ops_head_test", "opshead@test.com", "pass123")
        UserRole.objects.create(user=self.ops_head, role="OPERATIONS_HEAD")

        self.ops_user = User.objects.create_user("ops_user_test", "ops@test.com", "pass123")
        UserRole.objects.create(user=self.ops_user, role="OPERATIONS")

        self.reviewer_user = User.objects.create_user("reviewer_test", "reviewer@test.com", "pass123")
        UserRole.objects.create(user=self.reviewer_user, role="EMPLOYEE")
        self.reviewer_emp = Employee.objects.create(
            name="Reviewer User", employee_code="EMP901", email="rev901@test.com", department="Design", user=self.reviewer_user, status="Active", joining_date=date.today()
        )

        self.assigned_user = User.objects.create_user("assigned_test", "assigned@test.com", "pass123")
        UserRole.objects.create(user=self.assigned_user, role="EMPLOYEE")
        self.assigned_emp = Employee.objects.create(
            name="Assigned Employee", employee_code="EMP902", email="emp902@test.com", department="Design", user=self.assigned_user, status="Active", joining_date=date.today()
        )





        self.other_user = User.objects.create_user("other_test", "other@test.com", "pass123")
        UserRole.objects.create(user=self.other_user, role="EMPLOYEE")

        self.client_obj = Client.objects.create(name="Acme Corp")

    def test_authorized_creation_roles(self):
        roles = [self.admin, self.hr_user, self.tl_user, self.ops_head, self.ops_user]
        for idx, u in enumerate(roles):
            self.client_api.force_authenticate(user=u)
            res = self.client_api.post(
                "/api/work-assignments/",
                {
                    "employee": self.assigned_emp.id,
                    "client": self.client_obj.id,
                    "title": f"Task created by {u.username}",
                    "description": "Test task",
                    "priority": "Normal",
                    "assigned_date": str(date.today()),
                    "due_date": str(date.today()),
                    "status": "Pending",
                    "reviewer": self.reviewer_user.id,
                },
                format="json",
            )
            self.assertEqual(res.status_code, 201, f"Failed for user {u.username}: {res.data}")

    def test_unauthorized_employee_creation_rejected(self):
        self.client_api.force_authenticate(user=self.assigned_user)
        res = self.client_api.post(
            "/api/work-assignments/",
            {
                "employee": self.assigned_emp.id,
                "client": self.client_obj.id,
                "title": "Unauthorized task",
                "assigned_date": str(date.today()),
                "due_date": str(date.today()),
                "status": "Pending",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_reviewer_can_update_status(self):
        assignment = WorkAssignment.objects.create(
            employee=self.assigned_emp,
            client=self.client_obj,
            title="Design Mockup",
            assigned_date=date.today(),
            due_date=date.today(),
            status="In Review",
            assigned_by=self.admin,
            reviewer=self.reviewer_user,
            reviewer_name="Reviewer User",
        )

        self.client_api.force_authenticate(user=self.reviewer_user)
        res = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "Approved"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Approved")

    def test_unassigned_employee_cannot_approve_or_reject(self):
        assignment = WorkAssignment.objects.create(
            employee=self.assigned_emp,
            client=self.client_obj,
            title="Design Mockup",
            assigned_date=date.today(),
            due_date=date.today(),
            status="In Review",
            assigned_by=self.admin,
            reviewer=self.reviewer_user,
            reviewer_name="Reviewer User",
        )

        self.client_api.force_authenticate(user=self.assigned_user)
        res = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "Approved"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_assigned_employee_can_submit_for_review(self):
        assignment = WorkAssignment.objects.create(
            employee=self.assigned_emp,
            client=self.client_obj,
            title="Design Mockup",
            assigned_date=date.today(),
            due_date=date.today(),
            status="In Progress",
            assigned_by=self.admin,
            reviewer=self.reviewer_user,
            reviewer_name="Reviewer User",
        )

        self.client_api.force_authenticate(user=self.assigned_user)
        res = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "In Review"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "In Review")

    def test_unrelated_employee_cannot_access_or_update(self):
        assignment = WorkAssignment.objects.create(
            employee=self.assigned_emp,
            client=self.client_obj,
            title="Design Mockup",
            assigned_date=date.today(),
            due_date=date.today(),
            status="In Progress",
            assigned_by=self.admin,
            reviewer=self.reviewer_user,
        )

        self.client_api.force_authenticate(user=self.other_user)
        res = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "In Review"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
