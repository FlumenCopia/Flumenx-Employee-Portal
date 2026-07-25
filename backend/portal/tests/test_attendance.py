from datetime import date, datetime, time
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from portal.models import AttendancePolicy, AttendanceRecord, Employee, UserRole


class AttendancePolicyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("employee-login", email="employee@flumenx.local", password="Employee@123")
        UserRole.objects.create(user=self.user, role="EMPLOYEE")
        self.employee = Employee.objects.create(
            user=self.user, employee_code="FLX-T01", name="Test Employee",
            email="employee@flumenx.local", phone="9999999999", department="Web Development",
            designation="Engineer", joining_date=date.today(),
        )
        AttendancePolicy.current()

    def record(self, check_in, check_out=time(18, 30)):
        record = AttendanceRecord(employee=self.employee, attendance_date=date.today(), check_in_time=check_in, check_out_time=check_out)
        record.calculate()
        return record

    def test_grace_boundary(self):
        self.assertEqual(self.record(time(9, 29)).check_in_status, "On Time")
        self.assertEqual(self.record(time(9, 29)).attendance_status, "Present")
        self.assertEqual(self.record(time(9, 30)).check_in_status, "Grace Period")
        self.assertEqual(self.record(time(9, 30)).attendance_status, "Present")
        self.assertEqual(self.record(time(9, 35)).check_in_status, "Grace Period")
        self.assertFalse(self.record(time(9, 35)).is_late)
        self.assertEqual(self.record(time(9, 35)).attendance_status, "Present")

    def test_late_after_grace(self):
        record = self.record(time(9, 36))
        self.assertEqual(record.check_in_status, "Late")
        self.assertTrue(record.is_late)
        self.assertEqual(record.late_minutes, 1)
        self.assertEqual(record.attendance_status, "Half Day")

    def test_late_half_day_still_calculates_checkout_hours(self):
        record = self.record(time(9, 36), time(18, 30))
        self.assertEqual(record.attendance_status, "Half Day")
        self.assertEqual(float(record.working_hours), 8.9)

    def test_early_exit_boundary(self):
        self.assertFalse(self.record(time(9, 30), time(18, 30)).is_early_exit)
        self.assertEqual(self.record(time(9, 30), time(17, 45)).early_exit_minutes, 45)

    def test_check_in_records_office_entry_without_location_or_qr(self):
        client = APIClient()
        token = str(RefreshToken.for_user(self.user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        accepted = client.post("/api/attendance/check-in/", {}, format="json")
        self.assertEqual(accepted.status_code, 201)
        self.assertFalse(accepted.data["location_verified"])
        self.assertEqual(accepted.data["source"], "Manual")

    def test_check_out_works_for_half_day_record(self):
        client = APIClient()
        token = str(RefreshToken.for_user(self.user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        record = AttendanceRecord.objects.create(
            employee=self.employee,
            attendance_date=date.today(),
            check_in_time=time(9, 36),
        )
        self.assertEqual(record.attendance_status, "Half Day")
        with patch("portal.view_modules.attendance.localtime", return_value=datetime(2026, 1, 1, 18, 30)):
            response = client.post("/api/attendance/check-out/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["attendance_status"], "Half Day")
        self.assertEqual(float(response.data["working_hours"]), 8.9)

    def login(self, email="employee@flumenx.local", password="Employee@123", **extra):
        client = APIClient()
        client.get("/api/auth/csrf/")
        csrf_token = client.cookies["csrftoken"].value
        payload = {"email": email, "password": password, **extra}
        return client.post("/api/auth/login/", payload, format="json", HTTP_X_CSRFTOKEN=csrf_token)

    def test_login_ignores_submitted_portal_role(self):
        response = self.login(portal_role="ADMIN")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["portal_role"], "EMPLOYEE")
        self.user.portal_profile.refresh_from_db()
        self.assertEqual(self.user.portal_profile.role, "EMPLOYEE")

    def test_login_returns_persisted_portal_role(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["portal_role"], "EMPLOYEE")
        self.assertEqual(response.data["user"]["role"], "employee")
        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)
        self.assertIn(settings.JWT_REFRESH_COOKIE_NAME, response.cookies)
        self.assertTrue(response.cookies[settings.JWT_ACCESS_COOKIE_NAME]["httponly"])
        self.assertTrue(response.cookies[settings.JWT_REFRESH_COOKIE_NAME]["httponly"])

    def test_login_succeeds_using_email_when_username_is_different(self):
        self.assertEqual(self.user.username, "employee-login")
        response = self.login(email="employee@flumenx.local")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["username"], "employee-login")
        self.assertEqual(response.data["user"]["email"], "employee@flumenx.local")

    def test_login_email_lookup_is_case_insensitive(self):
        response = self.login(email="EMPLOYEE@FLUMENX.LOCAL")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["portal_role"], "EMPLOYEE")

    def test_login_trims_email_whitespace(self):
        response = self.login(email="  employee@flumenx.local  ")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["portal_role"], "EMPLOYEE")

    def test_login_rejects_wrong_password(self):
        response = self.login(password="WrongPass@123")
        self.assertEqual(response.status_code, 401)

    def test_login_rejects_unknown_email_with_generic_response(self):
        wrong_password = self.login(password="WrongPass@123")
        unknown_email = self.login(email="unknown@flumenx.local")
        self.assertEqual(unknown_email.status_code, 401)
        self.assertEqual(unknown_email.data, wrong_password.data)

    def test_login_rejects_inactive_user(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        response = self.login()
        self.assertEqual(response.status_code, 401)

    def test_login_rejects_duplicate_email_without_selecting_first_match(self):
        duplicate = User.objects.create_user("duplicate-login", email="employee@flumenx.local", password="Employee@123")
        UserRole.objects.create(user=duplicate, role="ADMIN")
        response = self.login()
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)
        self.assertNotIn(settings.JWT_REFRESH_COOKIE_NAME, response.cookies)

    def test_public_registration_is_disabled_and_creates_no_records(self):
        client = APIClient()
        client.get("/api/auth/csrf/")
        csrf_token = client.cookies["csrftoken"].value
        user_count = User.objects.count()
        role_count = UserRole.objects.count()
        employee_count = Employee.objects.count()
        response = client.post("/api/auth/register/", {
            "full_name": "New Employee",
            "email": "new.employee@flumenx.local",
            "portal_role": "ADMIN",
            "password": "StrongPass@123",
            "confirm_password": "StrongPass@123",
        }, format="json", HTTP_X_CSRFTOKEN=csrf_token)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["detail"], "Public registration is disabled.")
        self.assertEqual(User.objects.count(), user_count)
        self.assertEqual(UserRole.objects.count(), role_count)
        self.assertEqual(Employee.objects.count(), employee_count)

    def test_logout_blacklists_refresh_token(self):
        client = APIClient()
        client.get("/api/auth/csrf/")
        login = client.post("/api/auth/login/", {
            "email": self.user.email,
            "password": "Employee@123",
        }, format="json", HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value)
        csrf_token = client.cookies["csrftoken"].value
        self.assertIn(settings.JWT_REFRESH_COOKIE_NAME, login.cookies)
        logout = client.post("/api/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=csrf_token)
        self.assertEqual(logout.status_code, 204)
        refresh = client.post("/api/auth/refresh/", {}, format="json", HTTP_X_CSRFTOKEN=csrf_token)
        self.assertEqual(refresh.status_code, 401)

    def test_refresh_uses_cookie_and_rotates_without_json_token(self):
        client = APIClient()
        client.get("/api/auth/csrf/")
        login = client.post("/api/auth/login/", {
            "email": self.user.email,
            "password": "Employee@123",
        }, format="json", HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value)
        csrf_token = client.cookies["csrftoken"].value
        response = client.post("/api/auth/refresh/", {}, format="json", HTTP_X_CSRFTOKEN=csrf_token)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(response.content)
        self.assertIn(settings.JWT_ACCESS_COOKIE_NAME, response.cookies)
        self.assertIn(settings.JWT_REFRESH_COOKIE_NAME, response.cookies)
        self.assertNotIn("access", login.data)

    def test_cookie_authenticated_unsafe_request_requires_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.get("/api/auth/csrf/")
        login = client.post("/api/auth/login/", {
            "email": self.user.email,
            "password": "Employee@123",
        }, format="json", HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value)
        self.assertEqual(login.status_code, 200)
        missing = client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(missing.status_code, 403)
        csrf_token = client.cookies["csrftoken"].value
        accepted = client.post("/api/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=csrf_token)
        self.assertEqual(accepted.status_code, 204)
