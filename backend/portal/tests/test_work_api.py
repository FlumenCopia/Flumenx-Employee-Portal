from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from portal.models import Client, Employee, UserRole, WorkAssignment


class WorkManagementAPITests(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        self.users = {}
        self.employees = {}
        for role in ("ADMIN", "HR", "BDE", "TEAM_LEAD", "EMPLOYEE"):
            user = User.objects.create_user(f"{role.lower()}@work.local", password="Pass@1234", is_superuser=role == "ADMIN")
            UserRole.objects.create(user=user, role=role)
            self.users[role] = user
            if role != "ADMIN":
                self.employees[role] = self.create_employee(user, f"{role[:2]}001", role.title(), "Web Development")

        self.other_lead_user = User.objects.create_user("other-lead@work.local", password="Pass@1234")
        UserRole.objects.create(user=self.other_lead_user, role="TEAM_LEAD")
        self.other_lead = self.create_employee(self.other_lead_user, "TL002", "Other Lead", "Design")
        self.team_member_user = User.objects.create_user("team-member@work.local", password="Pass@1234")
        UserRole.objects.create(user=self.team_member_user, role="EMPLOYEE")
        self.team_member = self.create_employee(
            self.team_member_user,
            "TM001",
            "Team Member",
            "Web Development",
            team_lead=self.employees["TEAM_LEAD"],
        )
        self.other_member_user = User.objects.create_user("other-member@work.local", password="Pass@1234")
        UserRole.objects.create(user=self.other_member_user, role="EMPLOYEE")
        self.other_member = self.create_employee(
            self.other_member_user,
            "OM001",
            "Other Member",
            "Design",
            team_lead=self.other_lead,
        )
        self.client = Client.objects.create(name="Acme")
        self.other_client = Client.objects.create(name="Globex")
        self.today = timezone.localdate()
        self.team_work = self.create_assignment(self.team_member, status="Pending", due_date=self.today + timedelta(days=2))
        self.other_work = self.create_assignment(self.other_member, status="In Progress", progress=40, due_date=self.today + timedelta(days=3))
        self.own_work = self.create_assignment(
            self.employees["EMPLOYEE"],
            status="Blocked",
            progress=20,
            assigned_date=self.today - timedelta(days=5),
            due_date=self.today - timedelta(days=1),
        )
        self.completed_work = self.create_assignment(
            self.team_member,
            status="Completed",
            progress=100,
            assigned_date=self.today - timedelta(days=5),
            due_date=self.today - timedelta(days=2),
            title="Done work",
        )

    def create_employee(self, user, code, name, department, team_lead=None):
        return Employee.objects.create(
            user=user,
            employee_code=code,
            name=name,
            email=user.username,
            phone="9999999999",
            department=department,
            designation=name,
            joining_date=date(2026, 1, 1),
            status="Active",
            team_lead=team_lead,
        )

    def create_assignment(self, employee, **overrides):
        values = {
            "employee": employee,
            "client": self.client,
            "title": "Work item",
            "description": "Initial work",
            "priority": "Normal",
            "assigned_date": self.today,
            "due_date": self.today + timedelta(days=5),
            "status": "Pending",
            "progress": 0,
            "assigned_by": self.users["ADMIN"],
        }
        values.update(overrides)
        return WorkAssignment.objects.create(**values)

    def authenticate(self, user):
        self.client_api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")

    def as_role(self, role):
        self.authenticate(self.users[role])

    def assignment_payload(self, employee=None, client=None, **overrides):
        values = {
            "employee": employee or self.team_member.id,
            "client": client or self.client.id,
            "title": "New work",
            "description": "Build a thing",
            "priority": "High",
            "assigned_date": self.today.isoformat(),
            "due_date": (self.today + timedelta(days=7)).isoformat(),
            "status": "Pending",
            "progress": 0,
            "assigned_by": self.users["HR"].id,
        }
        values.update(overrides)
        return values

    def ids_from_list(self, response):
        return [item["id"] for item in response.data["results"]]

    def ids_from_options(self, response):
        return [item["id"] for item in response.data]

    def test_client_role_access_and_write_restrictions(self):
        for role in ("ADMIN", "HR", "BDE", "TEAM_LEAD"):
            with self.subTest(role=role):
                self.as_role(role)
                self.assertEqual(self.client_api.get("/api/clients/").status_code, 200)
                self.assertEqual(self.client_api.get(f"/api/clients/{self.client.id}/").status_code, 200)

        self.as_role("EMPLOYEE")
        self.assertEqual(self.client_api.get("/api/clients/").status_code, 403)
        self.assertEqual(self.client_api.get(f"/api/clients/{self.client.id}/").status_code, 403)
        self.assertEqual(self.client_api.post("/api/clients/", {"name": "Employee Client"}, format="json").status_code, 403)
        self.assertEqual(self.client_api.patch(f"/api/clients/{self.client.id}/", {"name": "Employee Client"}, format="json").status_code, 403)
        self.assertEqual(self.client_api.delete(f"/api/clients/{self.client.id}/").status_code, 403)

        for role in ("ADMIN", "HR", "BDE"):
            with self.subTest(role=role):
                self.as_role(role)
                created = self.client_api.post("/api/clients/", {"name": f"{role} Client"}, format="json")
                self.assertEqual(created.status_code, 201)
                patched = self.client_api.patch(f"/api/clients/{created.data['id']}/", {"name": f"{role} Client Updated"}, format="json")
                self.assertEqual(patched.status_code, 200)
                deleted = self.client_api.delete(f"/api/clients/{created.data['id']}/")
                self.assertEqual(deleted.status_code, 204)

        self.as_role("TEAM_LEAD")
        self.assertEqual(self.client_api.post("/api/clients/", {"name": "Blocked"}, format="json").status_code, 403)
        self.assertEqual(self.client_api.patch(f"/api/clients/{self.client.id}/", {"name": "Blocked"}, format="json").status_code, 403)
        self.assertEqual(self.client_api.delete(f"/api/clients/{self.client.id}/").status_code, 403)

    def test_admin_hr_and_bde_have_full_assignment_access(self):
        for role in ("ADMIN", "HR", "BDE"):
            with self.subTest(role=role):
                self.as_role(role)
                expected_count = WorkAssignment.objects.count()
                response = self.client_api.get("/api/work-assignments/")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["count"], expected_count)
                created = self.client_api.post("/api/work-assignments/", self.assignment_payload(employee=self.other_member.id), format="json")
                self.assertEqual(created.status_code, 201, created.data)
                self.assertEqual(created.data["assigned_by"], self.users[role].id)

    def test_work_employee_options_for_admin_hr_and_bde(self):
        inactive = self.create_employee(
            User.objects.create_user("inactive-option@work.local", password="Pass@1234"),
            "IN001",
            "Inactive Option",
            "Web Development",
        )
        inactive.status = "Inactive"
        inactive.save()

        for role in ("ADMIN", "HR", "BDE"):
            with self.subTest(role=role):
                self.as_role(role)
                response = self.client_api.get("/api/work-employee-options/")
                self.assertEqual(response.status_code, 200)
                self.assertIn(self.team_member.id, self.ids_from_options(response))
                self.assertIn(self.other_member.id, self.ids_from_options(response))
                self.assertNotIn(inactive.id, self.ids_from_options(response))
                self.assertEqual(set(response.data[0]), {"id", "display_name"})

    def test_work_employee_options_for_team_lead_are_own_active_team_only(self):
        inactive_team_member = self.create_employee(
            User.objects.create_user("inactive-team@work.local", password="Pass@1234"),
            "ITM01",
            "Inactive Team",
            "Web Development",
            team_lead=self.employees["TEAM_LEAD"],
        )
        inactive_team_member.status = "Inactive"
        inactive_team_member.save()

        self.as_role("TEAM_LEAD")
        response = self.client_api.get("/api/work-employee-options/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(self.team_member.id, self.ids_from_options(response))
        self.assertNotIn(self.other_member.id, self.ids_from_options(response))
        self.assertNotIn(inactive_team_member.id, self.ids_from_options(response))

    def test_employee_cannot_access_work_employee_options(self):
        self.as_role("EMPLOYEE")
        response = self.client_api.get("/api/work-employee-options/")

        self.assertEqual(response.status_code, 403)

    def test_team_lead_access_is_scoped_to_own_team(self):
        self.as_role("TEAM_LEAD")
        response = self.client_api.get("/api/work-assignments/")

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self.ids_from_list(response), [self.team_work.id, self.completed_work.id])
        self.assertEqual(self.client_api.get(f"/api/work-assignments/{self.other_work.id}/").status_code, 404)
        self.assertEqual(self.client_api.patch(f"/api/work-assignments/{self.other_work.id}/", {"progress": 10}, format="json").status_code, 404)
        self.assertEqual(self.client_api.delete(f"/api/work-assignments/{self.other_work.id}/").status_code, 404)

    def test_team_lead_cannot_assign_outside_own_team_or_to_self(self):
        self.as_role("TEAM_LEAD")
        outside = self.client_api.post("/api/work-assignments/", self.assignment_payload(employee=self.other_member.id), format="json")
        self_assign = self.client_api.post("/api/work-assignments/", self.assignment_payload(employee=self.employees["TEAM_LEAD"].id), format="json")
        inside = self.client_api.post("/api/work-assignments/", self.assignment_payload(employee=self.team_member.id), format="json")

        self.assertEqual(outside.status_code, 403)
        self.assertEqual(self_assign.status_code, 403)
        self.assertEqual(inside.status_code, 201, inside.data)
        self.assertEqual(inside.data["assigned_by"], self.users["TEAM_LEAD"].id)

    def test_employee_sees_own_assignments_only_and_cannot_create_or_delete(self):
        self.as_role("EMPLOYEE")
        response = self.client_api.get("/api/work-assignments/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids_from_list(response), [self.own_work.id])
        self.assertEqual(self.client_api.get(f"/api/work-assignments/{self.team_work.id}/").status_code, 404)
        self.assertEqual(self.client_api.post("/api/work-assignments/", self.assignment_payload(), format="json").status_code, 403)
        self.assertEqual(self.client_api.delete(f"/api/work-assignments/{self.own_work.id}/").status_code, 403)

    def test_employee_protected_field_update_rejected_and_valid_status_progress_allowed(self):
        self.as_role("EMPLOYEE")
        protected_payloads = [
            {"employee": self.team_member.id},
            {"client": self.other_client.id},
            {"title": "Changed"},
            {"description": "Changed"},
            {"priority": "Urgent"},
            {"assigned_date": (self.today - timedelta(days=1)).isoformat()},
            {"due_date": (self.today + timedelta(days=10)).isoformat()},
            {"assigned_by": self.users["HR"].id},
        ]
        for payload in protected_payloads:
            with self.subTest(payload=payload):
                protected = self.client_api.patch(f"/api/work-assignments/{self.own_work.id}/", payload, format="json")
                self.assertEqual(protected.status_code, 403)

        valid = self.client_api.patch(
            f"/api/work-assignments/{self.own_work.id}/",
            {"status": "In Progress", "progress": 60},
            format="json",
        )

        self.assertEqual(valid.status_code, 200, valid.data)
        self.own_work.refresh_from_db()
        self.assertEqual(self.own_work.status, "In Progress")
        self.assertEqual(self.own_work.progress, 60)
        self.assertEqual(self.own_work.assigned_by, self.users["ADMIN"])

    def test_filters_and_summary_are_scoped(self):
        self.as_role("ADMIN")
        filtered = self.client_api.get(f"/api/work-assignments/?employee={self.team_member.id}&status=Pending&priority=Normal")
        overdue = self.client_api.get("/api/work-assignments/?is_overdue=true")
        not_overdue = self.client_api.get("/api/work-assignments/?is_overdue=false")
        summary = self.client_api.get("/api/work-assignments/summary/")

        self.assertEqual(filtered.status_code, 200)
        self.assertEqual(self.ids_from_list(filtered), [self.team_work.id])
        self.assertEqual(overdue.status_code, 200)
        self.assertEqual(self.ids_from_list(overdue), [self.own_work.id])
        self.assertEqual(not_overdue.status_code, 200)
        self.assertCountEqual(self.ids_from_list(not_overdue), [self.team_work.id, self.other_work.id, self.completed_work.id])
        self.assertEqual(summary.data["total"], 4)
        self.assertEqual(summary.data["pending"], 1)
        self.assertEqual(summary.data["in_progress"], 1)
        self.assertEqual(summary.data["blocked"], 1)
        self.assertEqual(summary.data["completed"], 1)
        self.assertEqual(summary.data["overdue"], 1)

        self.as_role("TEAM_LEAD")
        scoped_summary = self.client_api.get("/api/work-assignments/summary/")
        self.assertEqual(scoped_summary.data["total"], 2)
        self.assertEqual(scoped_summary.data["completed"], 1)
        self.assertEqual(scoped_summary.data["overdue"], 0)

    def test_partial_update_preserves_model_validation(self):
        self.as_role("ADMIN")
        invalid_completed = self.client_api.patch(
            f"/api/work-assignments/{self.team_work.id}/",
            {"status": "Completed"},
            format="json",
        )
        invalid_progress = self.client_api.patch(
            f"/api/work-assignments/{self.team_work.id}/",
            {"progress": 100},
            format="json",
        )

        self.assertEqual(invalid_completed.status_code, 400)
        self.assertEqual(invalid_progress.status_code, 400)

    def test_employee_partial_update_preserves_model_validation(self):
        self.as_role("EMPLOYEE")
        invalid_completed = self.client_api.patch(
            f"/api/work-assignments/{self.own_work.id}/",
            {"status": "Completed"},
            format="json",
        )
        invalid_progress = self.client_api.patch(
            f"/api/work-assignments/{self.own_work.id}/",
            {"progress": 100},
            format="json",
        )

        self.assertEqual(invalid_completed.status_code, 400)
        self.assertEqual(invalid_progress.status_code, 400)

    def test_manager_update_preserves_original_assigned_by(self):
        self.as_role("HR")
        response = self.client_api.patch(
            f"/api/work-assignments/{self.team_work.id}/",
            {"title": "Updated by HR"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.team_work.refresh_from_db()
        self.assertEqual(self.team_work.assigned_by, self.users["ADMIN"])
