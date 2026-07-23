from datetime import date, time
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from .models import AttendanceCorrection, AttendancePolicy, AttendanceRecord, Employee, UserRole

class AttendancePolicyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("employee@flumenx.local", password="Employee@123")
        UserRole.objects.create(user=self.user, role="EMPLOYEE")
        self.employee = Employee.objects.create(
            user=self.user, employee_code="FLX-T01", name="Test Employee",
            email="employee@flumenx.local", phone="9999999999", department="Engineering",
            designation="Engineer", joining_date=date.today(),
        )
        AttendancePolicy.current()

    def record(self, check_in, check_out=time(18, 30)):
        record = AttendanceRecord(employee=self.employee, attendance_date=date.today(), check_in_time=check_in, check_out_time=check_out)
        record.calculate()
        return record

    def test_grace_boundary(self):
        self.assertEqual(self.record(time(9, 35)).check_in_status, "Grace Period")
        self.assertFalse(self.record(time(9, 35)).is_late)

    def test_late_after_grace(self):
        record = self.record(time(9, 36))
        self.assertEqual(record.check_in_status, "Late")
        self.assertEqual(record.late_minutes, 1)

    def test_early_exit_boundary(self):
        self.assertFalse(self.record(time(9, 30), time(18, 30)).is_early_exit)
        self.assertEqual(self.record(time(9, 30), time(17, 45)).early_exit_minutes, 45)

    def test_location_and_qr_are_server_validated(self):
        client = APIClient()
        token = client.post("/api/auth/login/", {"username": self.user.username, "password": "Employee@123", "portal_role": "EMPLOYEE"}, format="json").data["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        rejected = client.post("/api/attendance/check-in/", {
            "qr_reference": "BAD-CODE", "latitude": 12.971599, "longitude": 77.594566,
        }, format="json")
        self.assertEqual(rejected.status_code, 400)
        accepted = client.post("/api/attendance/check-in/", {
            "qr_reference": "FLUMENX-HQ-DEMO", "latitude": 12.971599, "longitude": 77.594566,
        }, format="json")
        self.assertEqual(accepted.status_code, 201)
        self.assertTrue(accepted.data["location_verified"])

    def test_login_rejects_wrong_selected_role(self):
        client = APIClient()
        response = client.post("/api/auth/login/", {
            "username": self.user.username,
            "password": "Employee@123",
            "portal_role": "ADMIN",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_login_returns_persisted_portal_role(self):
        client = APIClient()
        response = client.post("/api/auth/login/", {
            "username": self.user.username,
            "password": "Employee@123",
            "portal_role": "EMPLOYEE",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["portal_role"], "EMPLOYEE")
        self.assertEqual(response.data["user"]["role"], "employee")

    def test_public_registration_creates_selected_role(self):
        client = APIClient()
        response = client.post("/api/auth/register/", {
            "full_name": "New Accountant",
            "email": "new.accountant@flumenx.local",
            "phone": "9999999998",
            "portal_role": "ACCOUNTANT",
            "password": "StrongPass@123",
            "confirm_password": "StrongPass@123",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"]["portal_role"], "ACCOUNTANT")

    def test_registration_rejects_password_mismatch(self):
        client = APIClient()
        response = client.post("/api/auth/register/", {
            "full_name": "New Employee",
            "email": "mismatch@flumenx.local",
            "phone": "9999999997",
            "portal_role": "EMPLOYEE",
            "password": "StrongPass@123",
            "confirm_password": "DifferentPass@123",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_logout_blacklists_refresh_token(self):
        client = APIClient()
        login = client.post("/api/auth/login/", {
            "username": self.user.username,
            "password": "Employee@123",
            "portal_role": "EMPLOYEE",
        }, format="json")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        logout = client.post("/api/auth/logout/", {"refresh": login.data["refresh"]}, format="json")
        self.assertEqual(logout.status_code, 204)
        refresh = client.post("/api/auth/refresh/", {"refresh": login.data["refresh"]}, format="json")
        self.assertEqual(refresh.status_code, 401)

class RoleAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.accounts = {}
        for index, role in enumerate(("ADMIN", "HR", "ACCOUNTANT", "BDO", "EMPLOYEE"), start=1):
            email = f"{role.lower()}@roles.local"
            user = User.objects.create_user(email, password="RolePass@123", is_superuser=role == "ADMIN")
            UserRole.objects.create(user=user, role=role)
            if role != "ADMIN":
                Employee.objects.create(
                    user=user, employee_code=f"ROLE-{index}", name=role.title(), email=email,
                    phone=f"900000000{index}", department="HR" if role == "HR" else "Finance" if role == "ACCOUNTANT" else "Sales",
                    designation=role.title(), joining_date=date.today(),
                )
            self.accounts[role] = user

    def token_for(self, role):
        response = self.client.post("/api/auth/login/", {
            "username": self.accounts[role].username,
            "password": "RolePass@123",
            "portal_role": role,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        return response.data["access"]

    def get_as(self, role, path):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(role)}")
        return self.client.get(path)

    def test_all_five_roles_authenticate(self):
        for role in self.accounts:
            self.token_for(role)

    def test_cross_role_api_permissions(self):
        self.assertEqual(self.get_as("ADMIN", "/api/audit-logs/").status_code, 200)
        self.assertEqual(self.get_as("HR", "/api/employees/").status_code, 200)
        self.assertEqual(self.get_as("HR", "/api/audit-logs/").status_code, 403)
        self.assertEqual(self.get_as("ACCOUNTANT", "/api/employees/").status_code, 403)
        self.assertEqual(self.get_as("ACCOUNTANT", "/api/salary-slips/").status_code, 200)
        self.assertEqual(self.get_as("BDO", "/api/employees/").status_code, 403)
        self.assertEqual(self.get_as("EMPLOYEE", "/api/employees/").status_code, 403)

    def test_attendance_correction_uses_portal_role_not_staff_flag(self):
        employee_record = AttendanceRecord.objects.create(
            employee=self.accounts["EMPLOYEE"].employee,
            attendance_date=date.today(),
            check_in_time=time(9, 45),
            check_out_time=time(18, 30),
        )
        bdo_record = AttendanceRecord.objects.create(
            employee=self.accounts["BDO"].employee,
            attendance_date=date.today(),
            check_in_time=time(9, 30),
            check_out_time=time(18, 30),
        )
        self.accounts["BDO"].is_staff = True
        self.accounts["BDO"].save(update_fields=["is_staff"])

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('BDO')}")
        forbidden = self.client.post("/api/attendance-corrections/", {
            "attendance_record": employee_record.id,
            "requested_check_in": "09:35:00",
            "reason": "Trying another user's record",
        }, format="json")
        self.assertEqual(forbidden.status_code, 400)
        self.assertEqual(AttendanceCorrection.objects.count(), 0)

        own_record = self.client.post("/api/attendance-corrections/", {
            "attendance_record": bdo_record.id,
            "requested_check_in": "09:25:00",
            "reason": "Correct my own check-in",
        }, format="json")
        self.assertEqual(own_record.status_code, 201)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('HR')}")
        hr_record = self.client.post("/api/attendance-corrections/", {
            "attendance_record": employee_record.id,
            "requested_check_in": "09:35:00",
            "reason": "HR correction",
        }, format="json")
        self.assertEqual(hr_record.status_code, 201)
