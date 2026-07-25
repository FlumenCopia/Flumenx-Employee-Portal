from datetime import date

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase

from portal.models import Client, Employee, UserRole, WorkAssignment


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
            "progress": 0,
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

    def test_due_date_cannot_be_before_assigned_date(self):
        assignment = self.assignment(due_date=date(2026, 7, 31))

        with self.assertRaises(ValidationError):
            assignment.full_clean()

    def test_progress_must_be_between_zero_and_one_hundred(self):
        low = self.assignment(progress=-1)
        high = self.assignment(progress=101)

        with self.assertRaises(ValidationError):
            low.full_clean()
        with self.assertRaises(ValidationError):
            high.full_clean()

    def test_completed_work_must_have_full_progress(self):
        assignment = self.assignment(status="Completed", progress=80)

        with self.assertRaises(ValidationError):
            assignment.full_clean()

    def test_non_completed_work_cannot_have_full_progress(self):
        assignment = self.assignment(status="In Progress", progress=100)

        with self.assertRaises(ValidationError):
            assignment.full_clean()
