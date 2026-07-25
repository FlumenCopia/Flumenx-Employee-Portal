from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from portal.models import Client, Employee, LeaveRequest, Meeting, Notification, UserRole, WorkAssignment
from portal.services.notifications import create_notifications, create_notifications_for_roles


class NotificationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("employee@example.com", password="Pass@1234")
        self.other = User.objects.create_user("other@example.com", password="Pass@1234")
        UserRole.objects.create(user=self.user, role="EMPLOYEE")
        UserRole.objects.create(user=self.other, role="HR")

    def authenticate(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")

    def test_list_shows_only_authenticated_users_notifications(self):
        own = Notification.objects.create(user=self.user, title="Own", message="Visible")
        Notification.objects.create(user=self.other, title="Other", message="Hidden")

        self.authenticate(self.user)
        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], own.id)

    def test_unread_count_uses_only_authenticated_user(self):
        Notification.objects.create(user=self.user, title="Unread", message="Visible")
        Notification.objects.create(user=self.user, title="Read", message="Ignored", is_read=True)
        Notification.objects.create(user=self.other, title="Other", message="Ignored")

        self.authenticate(self.user)
        response = self.client.get("/api/notifications/unread-count/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"count": 1})

    def test_mark_one_as_read_affects_only_owner_notification(self):
        own = Notification.objects.create(user=self.user, title="Own", message="Visible")
        other = Notification.objects.create(user=self.other, title="Other", message="Hidden")

        self.authenticate(self.user)
        response = self.client.post(f"/api/notifications/{own.id}/read/")

        self.assertEqual(response.status_code, 200)
        own.refresh_from_db()
        other.refresh_from_db()
        self.assertTrue(own.is_read)
        self.assertFalse(other.is_read)

    def test_user_cannot_mark_another_users_notification_as_read(self):
        other = Notification.objects.create(user=self.other, title="Other", message="Hidden")

        self.authenticate(self.user)
        response = self.client.post(f"/api/notifications/{other.id}/read/")

        self.assertEqual(response.status_code, 404)
        other.refresh_from_db()
        self.assertFalse(other.is_read)

    def test_repeated_mark_as_read_is_safe(self):
        notification = Notification.objects.create(user=self.user, title="Own", message="Visible")

        self.authenticate(self.user)
        first = self.client.post(f"/api/notifications/{notification.id}/read/")
        second = self.client.post(f"/api/notifications/{notification.id}/read/")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)

    def test_mark_all_as_read_affects_only_authenticated_user(self):
        Notification.objects.create(user=self.user, title="One", message="Visible")
        Notification.objects.create(user=self.user, title="Two", message="Visible")
        Notification.objects.create(user=self.user, title="Read", message="Ignored", is_read=True)
        other = Notification.objects.create(user=self.other, title="Other", message="Hidden")

        self.authenticate(self.user)
        response = self.client.post("/api/notifications/mark-all-read/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"updated": 2})
        self.assertFalse(Notification.objects.filter(user=self.user, is_read=False).exists())
        other.refresh_from_db()
        self.assertFalse(other.is_read)


class NotificationHelperTests(TestCase):
    def setUp(self):
        self.actor = User.objects.create_user("actor@example.com", password="Pass@1234")
        self.employee = User.objects.create_user("employee@example.com", password="Pass@1234")
        self.bde = User.objects.create_user("bde@example.com", password="Pass@1234")
        self.inactive_bde = User.objects.create_user("inactive-bde@example.com", password="Pass@1234", is_active=False)
        UserRole.objects.create(user=self.actor, role="HR")
        UserRole.objects.create(user=self.employee, role="EMPLOYEE")
        UserRole.objects.create(user=self.bde, role="BDE")
        UserRole.objects.create(user=self.inactive_bde, role="BDE")

    def test_helper_avoids_duplicate_recipients_and_can_exclude_actor(self):
        created = create_notifications(
            [self.actor, self.employee, self.employee, None],
            "Title",
            "Message",
            category="Test",
            exclude_user=self.actor,
        )

        self.assertEqual(len(created), 1)
        self.assertEqual(Notification.objects.count(), 1)
        notification = Notification.objects.get()
        self.assertEqual(notification.user, self.employee)
        self.assertEqual(notification.category, "Test")

    def test_role_helper_uses_current_roles_including_bde(self):
        created = create_notifications_for_roles(
            ["BDE", "EMPLOYEE"],
            "Role notice",
            "Message",
            exclude_user=self.actor,
        )

        self.assertEqual(len(created), 2)
        self.assertCountEqual(
            Notification.objects.values_list("user__username", flat=True),
            ["employee@example.com", "bde@example.com"],
        )


class LeaveNotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = self.create_user_with_role("admin@example.com", "ADMIN")
        self.inactive_admin = self.create_user_with_role("inactive-admin@example.com", "ADMIN", is_active=False)
        self.hr = self.create_user_with_role("hr@example.com", "HR")
        self.inactive_hr = self.create_user_with_role("inactive-hr@example.com", "HR", is_active=False)
        self.employee_user = self.create_user_with_role("employee@example.com", "EMPLOYEE")
        self.other_employee_user = self.create_user_with_role("other-employee@example.com", "EMPLOYEE")
        self.employee = self.create_employee(self.employee_user, "FLX001", "Employee One")
        self.other_employee = self.create_employee(self.other_employee_user, "FLX002", "Employee Two")
        self.hr_employee = self.create_employee(self.hr, "FLX003", "HR User")

    def create_user_with_role(self, username, role, is_active=True):
        user = User.objects.create_user(username, password="Pass@1234", is_active=is_active)
        UserRole.objects.create(user=user, role=role)
        return user

    def create_employee(self, user, code, name):
        return Employee.objects.create(
            user=user,
            employee_code=code,
            name=name,
            email=user.username,
            phone="9999999999",
            department="HR" if "hr" in user.username else "Web Development",
            designation="Team Member",
            joining_date=date(2026, 1, 1),
            status="Active",
        )

    def authenticate(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")

    def leave_payload(self):
        return {
            "leave_type": "Annual",
            "start_date": "2026-08-01",
            "end_date": "2026-08-02",
            "reason": "Personal work",
        }

    def create_leave(self, employee=None):
        return LeaveRequest.objects.create(
            employee=employee or self.employee,
            leave_type="Annual",
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 2),
            reason="Personal work",
        )

    def notification_usernames(self):
        return list(Notification.objects.order_by("user__username").values_list("user__username", flat=True))

    def test_employee_leave_submission_notifies_active_admin_and_hr_only(self):
        self.authenticate(self.employee_user)
        response = self.client.post("/api/leaves/", self.leave_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertCountEqual(self.notification_usernames(), ["admin@example.com", "hr@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.inactive_admin).exists())
        self.assertFalse(Notification.objects.filter(user=self.inactive_hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.employee_user).exists())
        self.assertFalse(Notification.objects.filter(user=self.other_employee_user).exists())
        self.assertTrue(Notification.objects.filter(category="leave_submitted").exists())

    def test_admin_approval_notifies_employee_and_active_hr_users(self):
        leave = self.create_leave()

        self.authenticate(self.admin)
        response = self.client.post(f"/api/leaves/{leave.id}/decide/", {"status": "Approved"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self.notification_usernames(), ["employee@example.com", "hr@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.admin).exists())
        self.assertFalse(Notification.objects.filter(user=self.inactive_hr).exists())
        self.assertEqual(Notification.objects.filter(user=self.employee_user).count(), 1)
        self.assertTrue(Notification.objects.filter(category="leave_approved").exists())

    def test_repeated_identical_leave_decision_is_idempotent(self):
        leave = self.create_leave()

        self.authenticate(self.admin)
        first = self.client.post(f"/api/leaves/{leave.id}/decide/", {"status": "Approved"}, format="json")
        notification_count = Notification.objects.count()
        second = self.client.post(f"/api/leaves/{leave.id}/decide/", {"status": "Approved"}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(notification_count, 2)
        self.assertEqual(Notification.objects.count(), notification_count)
        leave.refresh_from_db()
        self.assertEqual(leave.status, "Approved")

    def test_admin_rejection_notifies_employee_and_active_hr_users(self):
        leave = self.create_leave()

        self.authenticate(self.admin)
        response = self.client.post(f"/api/leaves/{leave.id}/decide/", {"status": "Rejected"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self.notification_usernames(), ["employee@example.com", "hr@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.admin).exists())
        self.assertEqual(Notification.objects.filter(user=self.employee_user).count(), 1)
        self.assertTrue(Notification.objects.filter(category="leave_rejected").exists())

    def test_hr_approval_notifies_employee_and_active_admin_users(self):
        leave = self.create_leave()

        self.authenticate(self.hr)
        response = self.client.post(f"/api/leaves/{leave.id}/decide/", {"status": "Approved"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self.notification_usernames(), ["admin@example.com", "employee@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.inactive_admin).exists())
        self.assertEqual(Notification.objects.filter(user=self.employee_user).count(), 1)

    def test_hr_rejection_notifies_employee_and_active_admin_users(self):
        leave = self.create_leave()

        self.authenticate(self.hr)
        response = self.client.post(f"/api/leaves/{leave.id}/decide/", {"status": "Rejected"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self.notification_usernames(), ["admin@example.com", "employee@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.hr).exists())
        self.assertEqual(Notification.objects.filter(user=self.employee_user).count(), 1)

    def test_leave_decision_does_not_create_duplicate_notification_rows(self):
        leave = self.create_leave(employee=self.hr_employee)
        extra_hr = self.create_user_with_role("extra-hr@example.com", "HR")

        self.authenticate(self.admin)
        response = self.client.post(f"/api/leaves/{leave.id}/decide/", {"status": "Approved"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self.notification_usernames(), ["extra-hr@example.com", "hr@example.com"])
        self.assertEqual(Notification.objects.filter(user=self.hr).count(), 1)
        self.assertEqual(Notification.objects.filter(user=extra_hr).count(), 1)

    def test_non_admin_or_hr_cannot_decide_leave(self):
        leave = self.create_leave()

        self.authenticate(self.employee_user)
        response = self.client.post(f"/api/leaves/{leave.id}/decide/", {"status": "Approved"}, format="json")

        self.assertEqual(response.status_code, 403)
        leave.refresh_from_db()
        self.assertEqual(leave.status, "Pending")
        self.assertEqual(Notification.objects.count(), 0)


class MeetingNotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = self.create_user_with_role("admin@example.com", "ADMIN")
        self.inactive_admin = self.create_user_with_role("inactive-admin@example.com", "ADMIN", is_active=False)
        self.hr = self.create_user_with_role("hr@example.com", "HR")
        self.inactive_hr = self.create_user_with_role("inactive-hr@example.com", "HR", is_active=False)
        self.employee_user = self.create_user_with_role("employee@example.com", "EMPLOYEE")
        self.other_employee_user = self.create_user_with_role("other-employee@example.com", "EMPLOYEE")
        self.inactive_employee_user = self.create_user_with_role("inactive-employee@example.com", "EMPLOYEE", is_active=False)
        self.web_employee = self.create_employee(self.employee_user, "MFLX001", "Web Employee", "Web Development")
        self.design_employee = self.create_employee(self.other_employee_user, "MFLX002", "Design Employee", "Design")
        self.inactive_employee = self.create_employee(
            self.inactive_employee_user,
            "MFLX003",
            "Inactive Employee",
            "Web Development",
        )
        self.hr_employee = self.create_employee(self.hr, "MFLX004", "HR User", "HR")

    def create_user_with_role(self, username, role, is_active=True):
        user = User.objects.create_user(username, password="Pass@1234", is_active=is_active)
        UserRole.objects.create(user=user, role=role)
        return user

    def create_employee(self, user, code, name, department, status="Active"):
        return Employee.objects.create(
            user=user,
            employee_code=code,
            name=name,
            email=user.username,
            phone="9999999999",
            department=department,
            designation="Team Member",
            joining_date=date(2026, 1, 1),
            status=status,
        )

    def authenticate(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")

    def meeting_payload(self, department="Web Development"):
        return {
            "title": "Planning Sync",
            "date": "2026-08-05",
            "time": "10:30",
            "department": department,
            "description": "Weekly planning",
            "location": "Board Room",
        }

    def create_meeting(self, department="Web Development"):
        return Meeting.objects.create(
            title="Planning Sync",
            date=date(2026, 8, 5),
            time="10:30",
            department=department,
            description="Weekly planning",
            location="Board Room",
            created_by=self.admin,
        )

    def notification_usernames(self):
        return list(Notification.objects.order_by("user__username").values_list("user__username", flat=True))

    def test_admin_create_notifies_invited_users_and_active_hr_only(self):
        self.authenticate(self.admin)
        response = self.client.post("/api/meetings/", self.meeting_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertCountEqual(self.notification_usernames(), ["employee@example.com", "hr@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.inactive_hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.other_employee_user).exists())
        self.assertFalse(Notification.objects.filter(user=self.inactive_employee_user).exists())
        self.assertTrue(Notification.objects.filter(category="meeting_created").exists())

    def test_meeting_excludes_inactive_employee_status_even_when_user_is_active(self):
        inactive_status_user = self.create_user_with_role("inactive-status@example.com", "EMPLOYEE")
        self.create_employee(
            inactive_status_user,
            "MFLX005",
            "Inactive Status Employee",
            "Web Development",
            status="Inactive",
        )

        self.authenticate(self.admin)
        response = self.client.post("/api/meetings/", self.meeting_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertFalse(Notification.objects.filter(user=inactive_status_user).exists())
        self.assertCountEqual(self.notification_usernames(), ["employee@example.com", "hr@example.com"])

    def test_all_employees_meeting_notifies_active_employee_records_across_departments(self):
        self.hr_employee.status = "Inactive"
        self.hr_employee.save(update_fields=["status"])

        self.authenticate(self.hr)
        response = self.client.post("/api/meetings/", self.meeting_payload(department="All Employees"), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertCountEqual(
            self.notification_usernames(),
            ["admin@example.com", "employee@example.com", "other-employee@example.com"],
        )
        self.assertFalse(Notification.objects.filter(user=self.hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.inactive_employee_user).exists())

    def test_hr_create_notifies_invited_users_and_active_admin_only(self):
        self.authenticate(self.hr)
        response = self.client.post("/api/meetings/", self.meeting_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertCountEqual(self.notification_usernames(), ["admin@example.com", "employee@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.inactive_admin).exists())
        self.assertFalse(Notification.objects.filter(user=self.other_employee_user).exists())

    def test_meeting_notifications_collapse_duplicate_recipients_and_exclude_actor(self):
        extra_hr = self.create_user_with_role("extra-hr@example.com", "HR")
        self.create_employee(extra_hr, "MFLX005", "Extra HR", "HR")

        self.authenticate(self.admin)
        response = self.client.post("/api/meetings/", self.meeting_payload(department="HR"), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertCountEqual(self.notification_usernames(), ["extra-hr@example.com", "hr@example.com"])
        self.assertEqual(Notification.objects.filter(user=self.hr).count(), 1)
        self.assertEqual(Notification.objects.filter(user=extra_hr).count(), 1)

    def test_meeting_update_notifies_final_intended_recipients_once(self):
        meeting = self.create_meeting()

        self.authenticate(self.admin)
        response = self.client.patch(
            f"/api/meetings/{meeting.id}/",
            {"title": "Updated Sync", "department": "Design"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self.notification_usernames(), ["hr@example.com", "other-employee@example.com"])
        self.assertTrue(Notification.objects.filter(category="meeting_updated").exists())

    def test_meeting_delete_notifies_intended_recipients_once(self):
        meeting = self.create_meeting()

        self.authenticate(self.admin)
        response = self.client.delete(f"/api/meetings/{meeting.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertCountEqual(self.notification_usernames(), ["employee@example.com", "hr@example.com"])
        self.assertTrue(Notification.objects.filter(category="meeting_cancelled").exists())
        self.assertFalse(Meeting.objects.filter(id=meeting.id).exists())

    def test_non_admin_or_hr_cannot_mutate_meetings(self):
        meeting = self.create_meeting()

        self.authenticate(self.employee_user)
        create_response = self.client.post("/api/meetings/", self.meeting_payload(), format="json")
        update_response = self.client.patch(f"/api/meetings/{meeting.id}/", {"title": "Nope"}, format="json")
        delete_response = self.client.delete(f"/api/meetings/{meeting.id}/")

        self.assertEqual(create_response.status_code, 403)
        self.assertEqual(update_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.assertTrue(Meeting.objects.filter(id=meeting.id).exists())
        self.assertEqual(Notification.objects.count(), 0)


class EmployeeManagementNotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = self.create_user_with_role("emp-admin@example.com", "ADMIN")
        self.inactive_admin = self.create_user_with_role("emp-inactive-admin@example.com", "ADMIN", is_active=False)
        self.hr = self.create_user_with_role("emp-hr@example.com", "HR")
        self.inactive_hr = self.create_user_with_role("emp-inactive-hr@example.com", "HR", is_active=False)
        self.employee_user = self.create_user_with_role("managed-employee@example.com", "EMPLOYEE")
        self.other_employee_user = self.create_user_with_role("managed-other@example.com", "EMPLOYEE")
        self.employee = self.create_employee(self.employee_user, "EFLX001", "Managed Employee")
        self.other_employee = self.create_employee(self.other_employee_user, "EFLX002", "Other Employee")

    def create_user_with_role(self, username, role, is_active=True):
        user = User.objects.create_user(username, password="Pass@1234", is_active=is_active)
        UserRole.objects.create(user=user, role=role)
        return user

    def create_employee(self, user, code, name, status="Active", department="Web Development"):
        return Employee.objects.create(
            user=user,
            employee_code=code,
            name=name,
            email=user.username,
            phone="9999999999",
            department=department,
            designation="Team Member",
            joining_date=date(2026, 1, 1),
            status=status,
        )

    def authenticate(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")

    def employee_payload(self, code="EFLX100", email="new-employee@example.com", role="EMPLOYEE", status="Active"):
        return {
            "employee_code": code,
            "name": "New Employee",
            "email": email,
            "phone": "9999999999",
            "department": "Web Development",
            "designation": "Developer",
            "joining_date": "2026-08-01",
            "status": status,
            "avatar": "",
            "location": "",
            "portal_role": role,
            "password": "Pass@1234",
        }

    def update_payload(self, employee, **overrides):
        data = {
            "employee_code": employee.employee_code,
            "name": employee.name,
            "email": employee.email,
            "phone": employee.phone,
            "department": employee.department,
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "avatar": employee.avatar,
            "location": employee.location,
            "portal_role": getattr(employee.user.portal_profile, "role", "EMPLOYEE"),
        }
        data.update(overrides)
        return data

    def notification_usernames(self):
        return list(Notification.objects.order_by("user__username").values_list("user__username", flat=True))

    def test_admin_create_notifies_concerned_employee_and_active_hr_only(self):
        self.authenticate(self.admin)
        response = self.client.post(
            "/api/employees/",
            self.employee_payload(code="EFLX101", email="created-by-admin@example.com"),
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertCountEqual(self.notification_usernames(), ["created-by-admin@example.com", "emp-hr@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.inactive_hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.other_employee_user).exists())
        self.assertTrue(Notification.objects.filter(category="employee_created").exists())

    def test_hr_create_notifies_concerned_employee_and_active_admin_only(self):
        self.authenticate(self.hr)
        response = self.client.post(
            "/api/employees/",
            self.employee_payload(code="EFLX102", email="created-by-hr@example.com"),
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertCountEqual(self.notification_usernames(), ["created-by-hr@example.com", "emp-admin@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.inactive_admin).exists())
        self.assertFalse(Notification.objects.filter(user=self.other_employee_user).exists())

    def test_admin_update_notifies_concerned_employee_and_active_hr_only(self):
        self.authenticate(self.admin)
        response = self.client.patch(
            f"/api/employees/{self.employee.id}/",
            {"designation": "Senior Developer"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self.notification_usernames(), ["emp-hr@example.com", "managed-employee@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.admin).exists())
        self.assertFalse(Notification.objects.filter(user=self.inactive_hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.other_employee_user).exists())
        self.assertTrue(Notification.objects.filter(category="employee_updated").exists())

    def test_hr_update_notifies_concerned_employee_and_active_admin_only(self):
        self.authenticate(self.hr)
        response = self.client.patch(
            f"/api/employees/{self.employee.id}/",
            {"designation": "Senior Developer"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self.notification_usernames(), ["emp-admin@example.com", "managed-employee@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.inactive_admin).exists())
        self.assertFalse(Notification.objects.filter(user=self.other_employee_user).exists())

    def test_employee_management_notifications_collapse_duplicate_recipients(self):
        payload = self.employee_payload(code="EFLX103", email="new-hr@example.com", role="HR")
        payload["department"] = "HR"

        self.authenticate(self.admin)
        response = self.client.post(
            "/api/employees/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertCountEqual(self.notification_usernames(), ["emp-hr@example.com", "new-hr@example.com"])
        self.assertEqual(Notification.objects.filter(user__username="new-hr@example.com").count(), 1)

    def test_employee_deactivation_uses_deactivated_category(self):
        self.authenticate(self.admin)
        response = self.client.patch(
            f"/api/employees/{self.employee.id}/",
            {"status": "Inactive"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.filter(category="employee_deactivated").exists())
        self.assertCountEqual(self.notification_usernames(), ["emp-hr@example.com", "managed-employee@example.com"])

    def test_employee_activation_uses_activated_category(self):
        inactive_employee_user = self.create_user_with_role("inactive-managed@example.com", "EMPLOYEE")
        inactive_employee = self.create_employee(
            inactive_employee_user,
            "EFLX003",
            "Inactive Managed",
            status="Inactive",
        )

        self.authenticate(self.admin)
        response = self.client.patch(
            f"/api/employees/{inactive_employee.id}/",
            {"status": "Active"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.filter(category="employee_activated").exists())
        self.assertCountEqual(self.notification_usernames(), ["emp-hr@example.com", "inactive-managed@example.com"])

    def test_no_op_employee_update_does_not_create_notification(self):
        self.authenticate(self.admin)
        response = self.client.put(
            f"/api/employees/{self.employee.id}/",
            self.update_payload(self.employee),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Notification.objects.count(), 0)

    def test_non_admin_or_hr_cannot_mutate_employee_records(self):
        self.authenticate(self.employee_user)
        create_response = self.client.post(
            "/api/employees/",
            self.employee_payload(code="EFLX104", email="denied@example.com"),
            format="json",
        )
        update_response = self.client.patch(
            f"/api/employees/{self.employee.id}/",
            {"designation": "Denied"},
            format="json",
        )

        self.assertEqual(create_response.status_code, 403)
        self.assertEqual(update_response.status_code, 403)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.designation, "Team Member")
        self.assertEqual(Notification.objects.count(), 0)


class WorkNotificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = self.create_user_with_role("work-admin@example.com", "ADMIN")
        self.hr = self.create_user_with_role("work-hr@example.com", "HR")
        self.inactive_hr = self.create_user_with_role("work-inactive-hr@example.com", "HR", is_active=False)
        self.employee_user = self.create_user_with_role("work-employee@example.com", "EMPLOYEE")
        self.other_employee_user = self.create_user_with_role("work-other@example.com", "EMPLOYEE")
        self.employee = self.create_employee(self.employee_user, "WFLX001", "Work Employee")
        self.other_employee = self.create_employee(self.other_employee_user, "WFLX002", "Other Employee")
        self.client_record = Client.objects.create(name="Acme")
        self.today = date(2026, 8, 1)

    def create_user_with_role(self, username, role, is_active=True):
        user = User.objects.create_user(username, password="Pass@1234", is_active=is_active)
        UserRole.objects.create(user=user, role=role)
        return user

    def create_employee(self, user, code, name):
        return Employee.objects.create(
            user=user,
            employee_code=code,
            name=name,
            email=user.username,
            phone="9999999999",
            department="Web Development",
            designation="Team Member",
            joining_date=date(2026, 1, 1),
            status="Active",
        )

    def authenticate(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")

    def assignment_payload(self, **overrides):
        data = {
            "employee": self.employee.id,
            "client": self.client_record.id,
            "title": "Client build",
            "description": "Build client assets",
            "priority": "Normal",
            "assigned_date": self.today.isoformat(),
            "due_date": (self.today + timedelta(days=5)).isoformat(),
            "status": "Pending",
            "progress": 0,
        }
        data.update(overrides)
        return data

    def create_assignment(self, **overrides):
        values = {
            "employee": self.employee,
            "client": self.client_record,
            "title": "Client build",
            "description": "Build client assets",
            "priority": "Normal",
            "assigned_date": self.today,
            "due_date": self.today + timedelta(days=5),
            "status": "Pending",
            "progress": 0,
            "assigned_by": self.admin,
        }
        values.update(overrides)
        return WorkAssignment.objects.create(**values)

    def notification_usernames(self):
        return list(Notification.objects.order_by("user__username").values_list("user__username", flat=True))

    def test_work_create_notifies_assigned_employee_only(self):
        self.authenticate(self.admin)
        response = self.client.post("/api/work-assignments/", self.assignment_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertCountEqual(self.notification_usernames(), ["work-employee@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.admin).exists())
        self.assertFalse(Notification.objects.filter(user=self.other_employee_user).exists())
        self.assertTrue(Notification.objects.filter(category="work_assigned").exists())

    def test_work_update_notifies_assigned_employee_and_noop_does_not_duplicate(self):
        assignment = self.create_assignment()

        self.authenticate(self.admin)
        response = self.client.patch(f"/api/work-assignments/{assignment.id}/", {"title": "Updated client build"}, format="json")
        notification_count = Notification.objects.count()
        noop = self.client.patch(f"/api/work-assignments/{assignment.id}/", {"title": "Updated client build"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(noop.status_code, 200)
        self.assertEqual(notification_count, 1)
        self.assertEqual(Notification.objects.count(), notification_count)
        self.assertCountEqual(self.notification_usernames(), ["work-employee@example.com"])
        self.assertTrue(Notification.objects.filter(category="work_updated").exists())

    def test_employee_completion_notifies_assigned_by_and_active_hr(self):
        assignment = self.create_assignment()

        self.authenticate(self.employee_user)
        response = self.client.patch(
            f"/api/work-assignments/{assignment.id}/",
            {"status": "Completed", "progress": 100},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertCountEqual(self.notification_usernames(), ["work-admin@example.com", "work-hr@example.com"])
        self.assertFalse(Notification.objects.filter(user=self.inactive_hr).exists())
        self.assertFalse(Notification.objects.filter(user=self.employee_user).exists())
        self.assertTrue(Notification.objects.filter(category="work_completed").exists())

    def test_work_delete_notifies_assigned_employee_after_delete(self):
        assignment = self.create_assignment()

        self.authenticate(self.admin)
        response = self.client.delete(f"/api/work-assignments/{assignment.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(WorkAssignment.objects.filter(id=assignment.id).exists())
        self.assertCountEqual(self.notification_usernames(), ["work-employee@example.com"])
        self.assertTrue(Notification.objects.filter(category="work_deleted").exists())
