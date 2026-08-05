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

    def test_approved_to_published_succeeds_and_persists(self):
        assignment = WorkAssignment.objects.create(
            employee=self.assigned_emp,
            client=self.client_obj,
            title="Design Banner",
            assigned_date=date.today(),
            due_date=date.today(),
            status="In Review",
            assigned_by=self.admin,
            reviewer=self.reviewer_user,
            reviewer_name="Reviewer User",
        )

        self.client_api.force_authenticate(user=self.reviewer_user)
        # 1. In Review -> Approved
        res_app = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "Approved"},
            format="json",
        )
        self.assertEqual(res_app.status_code, 200)
        self.assertEqual(res_app.data["status"], "Approved")
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Approved")

        # 2. Approved -> Published
        res_pub = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "Published"},
            format="json",
        )
        self.assertEqual(res_pub.status_code, 200)
        self.assertEqual(res_pub.data["status"], "Published")
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Published")

    def test_reviewer_can_reject_and_request_changes(self):
        assignment = WorkAssignment.objects.create(
            employee=self.assigned_emp,
            client=self.client_obj,
            title="Video Reel",
            assigned_date=date.today(),
            due_date=date.today(),
            status="In Review",
            assigned_by=self.admin,
            reviewer=self.reviewer_user,
        )

        self.client_api.force_authenticate(user=self.reviewer_user)
        res_changes = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "Changes Requested"},
            format="json",
        )
        self.assertEqual(res_changes.status_code, 200)
        self.assertEqual(res_changes.data["status"], "Changes Requested")

        res_rej = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "Rejected"},
            format="json",
        )
        self.assertEqual(res_rej.status_code, 200)
        self.assertEqual(res_rej.data["status"], "Rejected")

    def test_assigned_employee_cannot_delete_or_edit_protected_fields(self):
        assignment = WorkAssignment.objects.create(
            employee=self.assigned_emp,
            client=self.client_obj,
            title="Initial Title",
            assigned_date=date.today(),
            due_date=date.today(),
            status="In Progress",
            assigned_by=self.admin,
            reviewer=self.reviewer_user,
        )

        self.client_api.force_authenticate(user=self.assigned_user)
        # Cannot edit title
        patch_res = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"title": "Modified Title"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, 403)

        # Cannot delete
        del_res = self.client_api.delete(f"/api/work-assignments/{assignment.id}/")
        self.assertEqual(del_res.status_code, 403)

    def test_invalid_status_returns_400(self):
        assignment = WorkAssignment.objects.create(
            employee=self.assigned_emp,
            client=self.client_obj,
            title="Task Title",
            assigned_date=date.today(),
            due_date=date.today(),
            status="In Progress",
            assigned_by=self.admin,
            reviewer=self.reviewer_user,
        )

        self.client_api.force_authenticate(user=self.admin)
        res = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "NonExistentStatus"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_employee_cannot_move_approved_completed_published_or_rejected_to_in_review(self):
        for terminal_status in ("Approved", "Completed", "Published", "Rejected"):
            assignment = WorkAssignment.objects.create(
                employee=self.assigned_emp,
                client=self.client_obj,
                title=f"Task in {terminal_status}",
                assigned_date=date.today(),
                due_date=date.today(),
                status=terminal_status,
                assigned_by=self.admin,
                reviewer=self.reviewer_user,
            )
            self.client_api.force_authenticate(user=self.assigned_user)
            res = self.client_api.patch(
                f"/api/work-assignments/{assignment.id}/",
                {"status": "In Review"},
                format="json",
            )
            self.assertEqual(res.status_code, 403, f"Assigned employee should be blocked from moving '{terminal_status}' to 'In Review'.")
