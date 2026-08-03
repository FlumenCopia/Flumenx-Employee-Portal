from datetime import date
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from portal.models import AttendancePolicy, Employee, SalarySlip, UserRole


class AppFixesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        AttendancePolicy.current()
        self.accounts = {}
        for index, role in enumerate(("ADMIN", "HR", "ACCOUNTANT", "BDO", "EMPLOYEE"), start=1):
            email = f"{role.lower()}@fixes.local"
            user = User.objects.create_user(email, password="FixPassword@123", is_superuser=role == "ADMIN")
            UserRole.objects.create(user=user, role=role)
            if role != "ADMIN":
                Employee.objects.create(
                    user=user, employee_code=f"FIX-{index}", name=role.title(), email=email,
                    phone=f"900000000{index}", department="HR" if role == "HR" else "Finance",
                    designation=role.title(), joining_date=date.today(),
                )
            self.accounts[role] = user

    def token_for(self, role):
        return str(RefreshToken.for_user(self.accounts[role]).access_token)

    def test_registration_is_disabled_returns_403(self):
        response = self.client.post("/api/auth/register/", {
            "full_name": "Attacker Admin",
            "email": "attacker@flumenx.local",
            "phone": "9999999990",
            "portal_role": "ADMIN",
            "password": "StrongPass@123",
            "confirm_password": "StrongPass@123",
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_user_without_employee_profile_returns_validation_error(self):
        user_no_emp = User.objects.create_user("noemp@flumenx.local", password="Password@123")
        UserRole.objects.create(user=user_no_emp, role="EMPLOYEE")
        token = str(RefreshToken.for_user(user_no_emp).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        leave_res = self.client.post("/api/leaves/", {
            "leave_type": "Annual", "start_date": "2026-08-01", "end_date": "2026-08-02", "reason": "Vacation"
        }, format="json")
        self.assertEqual(leave_res.status_code, 400)

        checkin_res = self.client.post("/api/attendance/check-in/", {}, format="json")
        self.assertEqual(checkin_res.status_code, 400)

        checkout_res = self.client.post("/api/attendance/check-out/", {}, format="json")
        self.assertEqual(checkout_res.status_code, 400)

    def test_salary_slip_file_validation_and_download_permissions(self):
        # Non-PDF upload
        invalid_file = SimpleUploadedFile("test.exe", b"binary content", content_type="application/octet-stream")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('ACCOUNTANT')}")
        bad_upload = self.client.post("/api/salary-slips/", {
            "employee": self.accounts["EMPLOYEE"].employee.id,
            "month": 1, "year": 2026, "file": invalid_file, "gross_salary": 50000, "net_salary": 45000,
        }, format="multipart")
        self.assertEqual(bad_upload.status_code, 400)

        # File size > 5MB
        large_file = SimpleUploadedFile("large.pdf", b"%PDF-1.4 " + b"0" * (5 * 1024 * 1024 + 100), content_type="application/pdf")
        large_upload = self.client.post("/api/salary-slips/", {
            "employee": self.accounts["EMPLOYEE"].employee.id,
            "month": 1, "year": 2026, "file": large_file, "gross_salary": 50000, "net_salary": 45000,
        }, format="multipart")
        self.assertEqual(large_upload.status_code, 400)

        # Valid slip creation
        valid_file = SimpleUploadedFile("slip.pdf", b"%PDF-1.4 content", content_type="application/pdf")
        slip = SalarySlip.objects.create(
            employee=self.accounts["EMPLOYEE"].employee,
            month=2, year=2026, file=valid_file, gross_salary=50000, net_salary=45000,
        )

        # Other employee cannot download
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('BDO')}")
        forbidden_dl = self.client.get(f"/api/salary-slips/{slip.id}/download/")
        self.assertEqual(forbidden_dl.status_code, 403)

        # Owner employee can download
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('EMPLOYEE')}")
        owner_dl = self.client.get(f"/api/salary-slips/{slip.id}/download/")
        self.assertEqual(owner_dl.status_code, 200)

        # Accountant can download
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('ACCOUNTANT')}")
        acct_dl = self.client.get(f"/api/salary-slips/{slip.id}/download/")
        self.assertEqual(acct_dl.status_code, 200)
