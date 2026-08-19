from datetime import date
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from portal.models import Client, Department, Employee, UserRole, WorkAssignment


class ReviewerCheckTests(APITestCase):
    def setUp(self):
        # Create department
        self.dept_design, _ = Department.objects.get_or_create(name="Design")

        # Create Users & Employees
        self.admin_user, _ = User.objects.get_or_create(username="admin", defaults={"email": "admin@example.com", "is_superuser": True, "is_staff": True})
        UserRole.objects.update_or_create(user=self.admin_user, defaults={"role": "SUPER_ADMIN"})

        self.reviewer_user, _ = User.objects.get_or_create(username="reviewer_tl", defaults={"email": "reviewer@example.com", "first_name": "TeamLead"})
        UserRole.objects.update_or_create(user=self.reviewer_user, defaults={"role": "TEAM_LEAD"})
        self.reviewer_emp, _ = Employee.objects.get_or_create(
            user=self.reviewer_user,
            defaults={
                "employee_code": "EMP-REV",
                "name": "TeamLead Reviewer",
                "email": "reviewer@example.com",
                "department": "Design",
                "joining_date": date.today()
            }
        )

        self.employee_user, _ = User.objects.get_or_create(username="employee_john", defaults={"email": "john@example.com", "first_name": "John"})
        UserRole.objects.update_or_create(user=self.employee_user, defaults={"role": "EMPLOYEE"})
        self.employee_emp, _ = Employee.objects.get_or_create(
            user=self.employee_user,
            defaults={
                "employee_code": "EMP-JOHN",
                "name": "John Developer",
                "email": "john@example.com",
                "department": "Design",
                "joining_date": date.today(),
                "team_lead": self.reviewer_emp
            }
        )

        self.other_user, _ = User.objects.get_or_create(username="employee_other", defaults={"email": "other@example.com"})
        UserRole.objects.update_or_create(user=self.other_user, defaults={"role": "EMPLOYEE"})
        self.other_emp, _ = Employee.objects.get_or_create(
            user=self.other_user,
            defaults={
                "employee_code": "EMP-OTHER",
                "name": "Other Developer",
                "email": "other@example.com",
                "department": "Design",
                "joining_date": date.today()
            }
        )

        self.client_obj, _ = Client.objects.get_or_create(name="Test Client Review")

        # Create sample task
        self.task = WorkAssignment.objects.create(
            employee=self.employee_emp,
            client=self.client_obj,
            title="Design Homepage Hero",
            description="Create hero mockup for mobile and desktop",
            assigned_date=date.today(),
            due_date=date.today(),
            status="In Review",
            progress=90,
            assigned_quantity=100,
            completed_quantity=90,
            unit="%",
            assigned_by=self.admin_user,
            reviewer=self.reviewer_user,
            reviewer_name="TeamLead Reviewer"
        )

    def test_1_new_task_defaults_to_pending_review(self):
        new_task = WorkAssignment.objects.create(
            employee=self.employee_emp,
            client=self.client_obj,
            title="Subtask Logo",
            assigned_date=date.today(),
            due_date=date.today(),
            status="Assigned"
        )
        self.assertEqual(new_task.review_status, "PENDING_REVIEW")
        self.assertEqual(new_task.review_note, "")
        self.assertIsNone(new_task.reviewed_by)
        self.assertIsNone(new_task.reviewed_at)

    def test_2_reviewer_can_mark_ok(self):
        self.client_stub = self.client
        self.client_stub = None
        self.client.force_authenticate(user=self.reviewer_user)

        response = self.client.post(
            f"/api/work-assignments/{self.task.id}/review/",
            {"review_status": "OK", "review_note": "Looks awesome!"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.task.refresh_from_db()
        self.assertEqual(self.task.review_status, "OK")
        self.assertEqual(self.task.review_note, "Looks awesome!")
        self.assertEqual(self.task.reviewed_by, self.reviewer_user)
        self.assertIsNotNone(self.task.reviewed_at)
        # Verify task status is untouched
        self.assertEqual(self.task.status, "In Review")

    def test_3_reviewer_can_request_correction(self):
        self.client.force_authenticate(user=self.reviewer_user)

        response = self.client.post(
            f"/api/work-assignments/{self.task.id}/review/",
            {"review_status": "CORRECTION_NEEDED", "review_note": "Please fix right padding on mobile."},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.task.refresh_from_db()
        self.assertEqual(self.task.review_status, "CORRECTION_NEEDED")
        self.assertEqual(self.task.review_note, "Please fix right padding on mobile.")
        self.assertEqual(self.task.reviewed_by, self.reviewer_user)
        self.assertIsNotNone(self.task.reviewed_at)
        # Verify task status is untouched
        self.assertEqual(self.task.status, "In Review")

    def test_4_correction_needed_requires_note(self):
        self.client.force_authenticate(user=self.reviewer_user)

        response = self.client.post(
            f"/api/work-assignments/{self.task.id}/review/",
            {"review_status": "CORRECTION_NEEDED", "review_note": "   "},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reviewer note is required", response.data.get("detail", ""))

    def test_5_reviewer_can_later_change_correction_needed_to_ok(self):
        # First mark correction needed
        self.task.review_status = "CORRECTION_NEEDED"
        self.task.review_note = "Fix alignment"
        self.task.reviewed_by = self.reviewer_user
        self.task.reviewed_at = timezone.now()
        self.task.save()

        # Now reviewer reviews again and marks OK
        self.client.force_authenticate(user=self.reviewer_user)
        response = self.client.post(
            f"/api/work-assignments/{self.task.id}/review/",
            {"review_status": "OK", "review_note": "Alignment fixed, good to go!"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.task.refresh_from_db()
        self.assertEqual(self.task.review_status, "OK")
        self.assertEqual(self.task.review_note, "Alignment fixed, good to go!")
        # Task status remains untouched
        self.assertEqual(self.task.status, "In Review")

    def test_6_assigned_employee_cannot_modify_reviewer_check(self):
        self.client.force_authenticate(user=self.employee_user)

        response = self.client.post(
            f"/api/work-assignments/{self.task.id}/review/",
            {"review_status": "OK", "review_note": "Self approving"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_7_employee_can_view_reviewer_result_and_note(self):
        self.task.review_status = "CORRECTION_NEEDED"
        self.task.review_note = "Fix spacing"
        self.task.reviewed_by = self.reviewer_user
        self.task.reviewed_at = timezone.now()
        self.task.save()

        self.client.force_authenticate(user=self.employee_user)
        response = self.client.get(f"/api/work-assignments/{self.task.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["review_status"], "CORRECTION_NEEDED")
        self.assertEqual(response.data["review_note"], "Fix spacing")
        self.assertEqual(response.data["reviewed_by_name"], "TeamLead")

    def test_8_admin_management_can_view_summary_review_counts(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/work-assignments/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("review_pending", response.data)
        self.assertIn("review_ok", response.data)
        self.assertIn("review_correction", response.data)

    def test_9_review_status_filter(self):
        self.task.review_status = "CORRECTION_NEEDED"
        self.task.save()

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/work-assignments/?review_status=CORRECTION_NEEDED")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], self.task.id)

        response_empty = self.client.get("/api/work-assignments/?review_status=OK")
        results_empty = response_empty.data.get("results", response_empty.data)
        self.assertEqual(len(results_empty), 0)

    def test_10_status_and_department_progress_unaffected(self):
        self.client.force_authenticate(user=self.reviewer_user)
        self.client.post(
            f"/api/work-assignments/{self.task.id}/review/",
            {"review_status": "CORRECTION_NEEDED", "review_note": "Fix padding"},
            format="json"
        )
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "In Review")

        response = self.client.get("/api/work-assignments/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("dept_progress", response.data)
        self.assertIn("overall_progress", response.data)
