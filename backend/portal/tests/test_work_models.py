from datetime import date

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from portal.models import Client, Employee, UserRole, WorkAssignment, WorkDeliverable


class WorkManagementModelTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin@example.com", password="Pass@1234")
        self.lead_user = User.objects.create_user("lead@example.com", password="Pass@1234")
        self.employee_user = User.objects.create_user("employee@example.com", password="Pass@1234")
        self.lead = self.create_employee(self.lead_user, "TL001", "Team Lead")
        self.employee = self.create_employee(self.employee_user, "EMP001", "Employee")
        self.client = Client.objects.create(name="Acme")

    def create_employee(self, user, code, name):
        return Employee.objects.create(
            user=user,
            employee_code=code,
            name=name,
            email=user.username,
            phone="9999999999",
            department="Web Development",
            designation="Developer",
            joining_date=date(2026, 1, 1),
            status="Active",
        )

    def assignment(self, **overrides):
        values = {
            "employee": self.employee,
            "client": self.client,
            "title": "Landing page build",
            "description": "Create the client landing page.",
            "priority": "Normal",
            "assigned_date": date(2026, 8, 1),
            "due_date": date(2026, 8, 5),
            "status": "Pending",
            "assigned_quantity": 10,
            "completed_quantity": 0,
            "unit": "tasks",
            "assigned_by": self.admin,
        }
        values.update(overrides)
        return WorkAssignment(**values)

    def test_team_lead_role_is_accepted(self):
        role = UserRole(user=self.lead_user, role="TEAM_LEAD")

        role.full_clean()
        role.save()

        self.assertEqual(self.lead_user.portal_profile.role, "TEAM_LEAD")

    def test_employee_team_lead_relationship(self):
        self.employee.team_lead = self.lead

        self.employee.full_clean()
        self.employee.save()

        self.assertEqual(self.employee.team_lead, self.lead)
        self.assertIn(self.employee, self.lead.team_members.all())

    def test_employee_cannot_be_own_team_lead(self):
        self.employee.team_lead = self.employee

        with self.assertRaises(ValidationError):
            self.employee.full_clean()

    def test_employee_save_rejects_own_team_lead_without_full_clean(self):
        self.employee.team_lead = self.employee

        with self.assertRaises(ValidationError):
            self.employee.save()

    def test_client_name_is_trimmed(self):
        client = Client.objects.create(name="  Globex  ")

        self.assertEqual(client.name, "Globex")

    def test_client_name_is_case_insensitive_unique(self):
        Client.objects.create(name="Globex")
        duplicate = Client(name=" globex ")

        with self.assertRaises(ValidationError):
            duplicate.full_clean()

    def test_client_create_rejects_case_insensitive_duplicate_without_full_clean(self):
        Client.objects.create(name="ABC")

        with self.assertRaises(ValidationError):
            Client.objects.create(name="abc")

    def test_valid_work_assignment_creation(self):
        assignment = self.assignment()

        assignment.full_clean()
        assignment.save()

        self.assertEqual(assignment.client, self.client)
        self.assertEqual(assignment.employee, self.employee)
        self.assertEqual(assignment.remaining_quantity, 10)

    def test_due_date_cannot_be_before_assigned_date(self):
        assignment = self.assignment(due_date=date(2026, 7, 31))

        with self.assertRaises(ValidationError):
            assignment.full_clean()

    def test_quantity_validation(self):
        zero_assigned = self.assignment(assigned_quantity=0)
        over_completed = self.assignment(assigned_quantity=10, completed_quantity=11)

        with self.assertRaises(ValidationError):
            zero_assigned.full_clean()
        with self.assertRaises(ValidationError):
            over_completed.full_clean()

    def test_unit_cannot_be_blank(self):
        assignment = self.assignment(unit="  ")

        with self.assertRaises(ValidationError):
            assignment.full_clean()

    def test_progress_and_status_auto_sync_mapping(self):
        # 0% -> Pending
        assignment = self.assignment(assigned_quantity=10, completed_quantity=0)
        assignment.full_clean()
        assignment.save()
        self.assertEqual(assignment.progress, 0)
        self.assertEqual(assignment.status, "Pending")

        # 1% to 49% -> In Progress
        assignment.completed_quantity = 4
        assignment.save()
        self.assertEqual(assignment.progress, 40)
        self.assertEqual(assignment.status, "In Progress")

        # 50% to 99% -> Ongoing (threshold 50%)
        assignment.completed_quantity = 5
        assignment.save()
        self.assertEqual(assignment.progress, 50)
        self.assertEqual(assignment.status, "Ongoing")

        # 50% to 99% -> Ongoing (90%)
        assignment.completed_quantity = 9
        assignment.save()
        self.assertEqual(assignment.progress, 90)
        self.assertEqual(assignment.status, "Ongoing")

        # 100% -> Completed
        assignment.completed_quantity = 10
        assignment.save()
        self.assertEqual(assignment.progress, 100)
        self.assertEqual(assignment.status, "Completed")

    def test_over_completion_rejection(self):
        assignment = self.assignment(assigned_quantity=10, completed_quantity=11)
        with self.assertRaises(ValidationError):
            assignment.full_clean()

    def test_blocked_is_manual_exception_until_fully_completed(self):
        assignment = self.assignment(status="Blocked", completed_quantity=3)
        assignment.full_clean()
        assignment.save()

        self.assertEqual(assignment.status, "Blocked")
        self.assertEqual(assignment.progress, 30)

        assignment.completed_quantity = 10
        assignment.save()
        self.assertEqual(assignment.status, "Completed")

    def test_deliverables_roll_up_parent_quantities_and_status(self):
        assignment = self.assignment(assigned_quantity=1, completed_quantity=0, unit="items")
        assignment.save()
        client_b = Client.objects.create(name="Beta")

        WorkDeliverable.objects.create(
            assignment=assignment,
            client=self.client,
            title="Onam Poster",
            brief="Festival creative",
            work_type="poster",
            due_date=date(2026, 8, 3),
        )
        WorkDeliverable.objects.create(
            assignment=assignment,
            client=client_b,
            title="Offer Poster",
            brief="Sale creative",
            work_type="poster",
            due_date=date(2026, 8, 4),
            status="Completed",
        )

        assignment.refresh_from_db()
        self.assertEqual(assignment.assigned_quantity, 2)
        self.assertEqual(assignment.completed_quantity, 1)
        self.assertEqual(assignment.remaining_quantity, 1)
        self.assertEqual(assignment.unit, "items")
        self.assertEqual(assignment.progress, 50)
        self.assertEqual(assignment.status, "In Progress")

    def test_deliverable_blocked_and_completed_update_parent(self):
        assignment = self.assignment(assigned_quantity=1, completed_quantity=0, unit="items")
        assignment.save()
        deliverable = WorkDeliverable.objects.create(
            assignment=assignment,
            client=self.client,
            title="Instagram Reel",
            brief="Short edit",
            work_type="video",
            due_date=date(2026, 8, 3),
        )

        deliverable.status = "Blocked"
        deliverable.save()
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Blocked")
        self.assertEqual(assignment.progress, 0)

        deliverable.status = "Completed"
        before = timezone.now()
        deliverable.save()
        deliverable.refresh_from_db()
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Completed")
        self.assertEqual(assignment.completed_quantity, 1)
        self.assertEqual(assignment.progress, 100)
        self.assertIsNotNone(deliverable.completed_at)
        self.assertIsNotNone(assignment.completed_at)
        self.assertGreaterEqual(deliverable.completed_at, before)

        deliverable.status = "In Progress"
        deliverable.save()
        deliverable.refresh_from_db()
        assignment.refresh_from_db()
        self.assertIsNone(deliverable.completed_at)
        self.assertIsNone(assignment.completed_at)
        self.assertEqual(assignment.status, "In Progress")
        self.assertEqual(assignment.progress, 0)

    def test_deliverable_parent_status_rollup_rules(self):
        assignment = self.assignment(assigned_quantity=1, completed_quantity=0, unit="items")
        assignment.save()
        first = WorkDeliverable.objects.create(
            assignment=assignment,
            client=self.client,
            title="Poster One",
            brief="First",
            work_type="poster",
            due_date=date(2026, 8, 3),
        )
        second = WorkDeliverable.objects.create(
            assignment=assignment,
            client=self.client,
            title="Poster Two",
            brief="Second",
            work_type="poster",
            due_date=date(2026, 8, 3),
        )
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Pending")

        first.status = "Blocked"
        first.save()
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Blocked")

        second.status = "In Progress"
        second.save()
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Blocked")

        second.status = "Completed"
        second.save()
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Blocked")

        second.status = "Pending"
        second.save()
        first.status = "Completed"
        first.save()
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "In Progress")

        second.status = "Completed"
        second.save()
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "Completed")

    def test_existing_assignment_without_deliverables_keeps_parent_quantity_workflow(self):
        assignment = self.assignment(assigned_quantity=5, completed_quantity=2)
        assignment.save()

        assignment.completed_quantity = 5
        assignment.save()

        self.assertFalse(assignment.has_deliverables())
        self.assertEqual(assignment.progress, 100)
        self.assertEqual(assignment.status, "Completed")

    def test_deliverable_requires_title_work_type_and_valid_due_date(self):
        assignment = self.assignment()
        assignment.save()
        invalid = WorkDeliverable(
            assignment=assignment,
            client=self.client,
            title=" ",
            brief="",
            work_type=" ",
            due_date=date(2026, 7, 31),
        )

        with self.assertRaises(ValidationError):
            invalid.full_clean()
