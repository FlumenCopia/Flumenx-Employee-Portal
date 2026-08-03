from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from portal.models import Client, Employee, UserRole, WorkAssignment, WorkDeliverable


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
        self.other_work = self.create_assignment(self.other_member, completed_quantity=40, due_date=self.today + timedelta(days=3))
        self.own_work = self.create_assignment(
            self.employees["EMPLOYEE"],
            status="Blocked",
            completed_quantity=20,
            assigned_date=self.today - timedelta(days=5),
            due_date=self.today - timedelta(days=1),
        )
        self.completed_work = self.create_assignment(
            self.team_member,
            completed_quantity=100,
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
            "assigned_quantity": 100,
            "completed_quantity": 0,
            "unit": "%",
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
            "assigned_quantity": 10,
            "completed_quantity": 0,
            "unit": "tasks",
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
                self.assertEqual(set(response.data[0]), {"id", "display_name", "department"})

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
            {"progress": 60},
            {"completed_at": timezone.now().isoformat()},
        ]
        for payload in protected_payloads:
            with self.subTest(payload=payload):
                protected = self.client_api.patch(f"/api/work-assignments/{self.own_work.id}/", payload, format="json")
                self.assertEqual(protected.status_code, 403)

        valid = self.client_api.patch(
            f"/api/work-assignments/{self.own_work.id}/",
            {"completed_quantity": 60},
            format="json",
        )

        self.assertEqual(valid.status_code, 200, valid.data)
        self.own_work.refresh_from_db()
        self.assertEqual(self.own_work.status, "Ongoing")
        self.assertEqual(self.own_work.progress, 60)
        self.assertEqual(self.own_work.completed_quantity, 60)
        self.assertEqual(self.own_work.remaining_quantity, 40)
        self.assertEqual(self.own_work.assigned_by, self.users["ADMIN"])

        blocked = self.client_api.patch(
            f"/api/work-assignments/{self.own_work.id}/",
            {"status": "Blocked"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 200, blocked.data)
        self.own_work.refresh_from_db()
        self.assertEqual(self.own_work.status, "Blocked")

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

    def test_quantity_update_preserves_model_validation(self):
        self.as_role("ADMIN")
        invalid_completed_quantity = self.client_api.patch(
            f"/api/work-assignments/{self.team_work.id}/",
            {"completed_quantity": 101},
            format="json",
        )
        invalid_assigned_quantity = self.client_api.patch(
            f"/api/work-assignments/{self.team_work.id}/",
            {"assigned_quantity": 0},
            format="json",
        )

        self.assertEqual(invalid_completed_quantity.status_code, 400)
        self.assertEqual(invalid_assigned_quantity.status_code, 400)

    def test_employee_quantity_update_preserves_model_validation(self):
        self.as_role("EMPLOYEE")
        invalid_completed_quantity = self.client_api.patch(
            f"/api/work-assignments/{self.own_work.id}/",
            {"completed_quantity": 101},
            format="json",
        )
        manual_completed_status = self.client_api.patch(
            f"/api/work-assignments/{self.own_work.id}/",
            {"status": "Completed"},
            format="json",
        )

        self.assertEqual(invalid_completed_quantity.status_code, 400)
        self.assertEqual(manual_completed_status.status_code, 403)

    def test_response_includes_quantity_fields_and_progress_is_read_only(self):
        self.as_role("ADMIN")
        response = self.client_api.post(
            "/api/work-assignments/",
            self.assignment_payload(assigned_quantity=20, completed_quantity=5, progress=99),
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["assigned_quantity"], 20)
        self.assertEqual(response.data["completed_quantity"], 5)
        self.assertEqual(response.data["remaining_quantity"], 15)
        self.assertEqual(response.data["unit"], "tasks")
        self.assertEqual(response.data["progress"], 25)
        self.assertIsNone(response.data["completed_at"])

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

    def deliverable_payload(self, assignment=None, client=None, **overrides):
        values = {
            "assignment": assignment or self.team_work.id,
            "client": client or self.client.id,
            "title": "Onam Poster",
            "brief": "Create a festival poster.",
            "work_type": "poster",
            "due_date": (self.today + timedelta(days=2)).isoformat(),
            "status": "Pending",
        }
        values.update(overrides)
        return values

    def create_deliverable(self, assignment=None, **overrides):
        values = {
            "assignment": assignment or self.own_work,
            "client": self.client,
            "title": "Instagram Reel",
            "brief": "Edit a short reel.",
            "work_type": "video",
            "due_date": self.today + timedelta(days=2),
            "status": "Pending",
        }
        values.update(overrides)
        return WorkDeliverable.objects.create(**values)

    def test_assignment_response_includes_deliverables_and_parent_rollup(self):
        first = self.create_deliverable(assignment=self.team_work, title="Poster One", status="Completed")
        second = self.create_deliverable(assignment=self.team_work, title="Poster Two")

        self.as_role("ADMIN")
        response = self.client_api.get(f"/api/work-assignments/{self.team_work.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["assigned_quantity"], 2)
        self.assertEqual(response.data["completed_quantity"], 1)
        self.assertEqual(response.data["progress"], 50)
        self.assertEqual(len(response.data["deliverables"]), 2)
        self.assertCountEqual([item["id"] for item in response.data["deliverables"]], [first.id, second.id])

    def test_management_can_create_update_and_delete_deliverables(self):
        self.as_role("ADMIN")
        created = self.client_api.post("/api/work-deliverables/", self.deliverable_payload(), format="json")
        self.assertEqual(created.status_code, 201, created.data)

        patched = self.client_api.patch(
            f"/api/work-deliverables/{created.data['id']}/",
            {"status": "Completed", "title": "Updated poster"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.team_work.refresh_from_db()
        self.assertEqual(self.team_work.status, "Completed")
        self.assertEqual(self.team_work.progress, 100)

        deleted = self.client_api.delete(f"/api/work-deliverables/{created.data['id']}/")
        self.assertEqual(deleted.status_code, 204)

    def test_employee_updates_own_deliverable_only_and_parent_refreshes(self):
        deliverable = self.create_deliverable(assignment=self.own_work)

        self.as_role("EMPLOYEE")
        response = self.client_api.patch(
            f"/api/work-deliverables/{deliverable.id}/",
            {"status": "Completed"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        deliverable.refresh_from_db()
        self.own_work.refresh_from_db()
        self.assertEqual(deliverable.status, "Completed")
        self.assertIsNotNone(deliverable.completed_at)
        self.assertEqual(self.own_work.status, "Completed")
        self.assertEqual(self.own_work.progress, 100)

    def test_employee_can_block_deliverable_but_cannot_change_protected_fields(self):
        deliverable = self.create_deliverable(assignment=self.own_work)

        self.as_role("EMPLOYEE")
        blocked = self.client_api.patch(f"/api/work-deliverables/{deliverable.id}/", {"status": "Blocked"}, format="json")
        protected = self.client_api.patch(f"/api/work-deliverables/{deliverable.id}/", {"title": "Changed"}, format="json")

        self.assertEqual(blocked.status_code, 200, blocked.data)
        self.assertEqual(protected.status_code, 403)
        deliverable.refresh_from_db()
        self.own_work.refresh_from_db()
        self.assertEqual(deliverable.status, "Blocked")
        self.assertEqual(self.own_work.status, "Blocked")

    def test_employee_blocked_deliverable_is_reflected_in_assignment_api(self):
        blocked = self.create_deliverable(assignment=self.own_work)
        completed = self.create_deliverable(
            assignment=self.own_work,
            title="Completed Item",
            status="Completed",
        )

        self.as_role("EMPLOYEE")
        response = self.client_api.patch(f"/api/work-deliverables/{blocked.id}/", {"status": "Blocked"}, format="json")
        assignment_response = self.client_api.get(f"/api/work-assignments/{self.own_work.id}/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(assignment_response.status_code, 200)
        self.assertEqual(assignment_response.data["status"], "Blocked")
        self.assertEqual(assignment_response.data["completed_quantity"], 1)
        self.assertEqual(assignment_response.data["remaining_quantity"], 1)
        completed.refresh_from_db()
        self.assertEqual(completed.status, "Completed")

    def test_employee_can_use_full_deliverable_status_workflow(self):
        deliverable = self.create_deliverable(assignment=self.own_work)

        self.as_role("EMPLOYEE")
        in_progress = self.client_api.patch(f"/api/work-deliverables/{deliverable.id}/", {"status": "In Progress"}, format="json")
        completed = self.client_api.patch(f"/api/work-deliverables/{deliverable.id}/", {"status": "Completed"}, format="json")
        pending = self.client_api.patch(f"/api/work-deliverables/{deliverable.id}/", {"status": "Pending"}, format="json")

        self.assertEqual(in_progress.status_code, 200, in_progress.data)
        self.assertEqual(completed.status_code, 200, completed.data)
        self.assertEqual(pending.status_code, 200, pending.data)
        deliverable.refresh_from_db()
        self.own_work.refresh_from_db()
        self.assertEqual(deliverable.status, "Pending")
        self.assertIsNone(deliverable.completed_at)
        self.assertEqual(self.own_work.status, "Pending")
        self.assertEqual(self.own_work.completed_quantity, 0)
        self.assertEqual(self.own_work.progress, 0)

    def test_employee_parent_update_is_rejected_when_assignment_has_deliverables(self):
        self.create_deliverable(assignment=self.own_work)

        self.as_role("EMPLOYEE")
        response = self.client_api.patch(
            f"/api/work-assignments/{self.own_work.id}/",
            {"completed_quantity": 1},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_deliverable_permissions_follow_assignment_scope(self):
        team_deliverable = self.create_deliverable(assignment=self.team_work)
        other_deliverable = self.create_deliverable(assignment=self.other_work)

        self.as_role("TEAM_LEAD")
        response = self.client_api.get("/api/work-deliverables/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(team_deliverable.id, self.ids_from_list(response))
        self.assertNotIn(other_deliverable.id, self.ids_from_list(response))
        self.assertEqual(self.client_api.get(f"/api/work-deliverables/{other_deliverable.id}/").status_code, 404)
        self.assertEqual(
            self.client_api.post(
                "/api/work-deliverables/",
                self.deliverable_payload(assignment=self.other_work.id),
                format="json",
            ).status_code,
            403,
        )

    def test_deliverable_filters_are_scoped(self):
        own = self.create_deliverable(assignment=self.own_work, status="Blocked", due_date=self.today - timedelta(days=1))
        self.create_deliverable(assignment=self.team_work, status="Pending")

        self.as_role("EMPLOYEE")
        response = self.client_api.get("/api/work-deliverables/?is_overdue=true&status=Blocked")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids_from_list(response), [own.id])

    def test_employee_work_quantity_update_auto_syncs_status_and_progress(self):
        assignment = self.create_assignment(self.employees["EMPLOYEE"], assigned_quantity=10, completed_quantity=0)

        self.as_role("EMPLOYEE")

        resp = self.client_api.get(f"/api/work-assignments/{assignment.id}/")
        self.assertEqual(resp.data["progress"], 0)
        self.assertEqual(resp.data["status"], "Pending")

        patch_resp = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"completed_quantity": 4},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.data["progress"], 40)
        self.assertEqual(patch_resp.data["status"], "In Progress")

        patch_resp2 = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"completed_quantity": 5},
            format="json",
        )
        self.assertEqual(patch_resp2.status_code, 200)
        self.assertEqual(patch_resp2.data["progress"], 50)
        self.assertEqual(patch_resp2.data["status"], "Ongoing")

        patch_resp3 = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"completed_quantity": 10},
            format="json",
        )
        self.assertEqual(patch_resp3.status_code, 200)
        self.assertEqual(patch_resp3.data["progress"], 100)
        self.assertEqual(patch_resp3.data["status"], "Completed")

        over_resp = self.client_api.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"completed_quantity": 11},
            format="json",
        )
        self.assertEqual(over_resp.status_code, 400)
