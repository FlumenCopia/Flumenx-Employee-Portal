from datetime import date
from django.contrib.auth.models import User
from django.core import mail
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
            user = User.objects.create_user(username=email, email=email, password="FixPassword@123", is_superuser=role == "ADMIN")
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

    def test_csrf_token_endpoint_and_login_validation(self):
        client = APIClient(enforce_csrf_checks=True)
        csrf_res = client.get("/api/auth/csrf/")
        self.assertEqual(csrf_res.status_code, 200)
        self.assertIn("csrfToken", csrf_res.data)
        self.assertIn("csrftoken", client.cookies)

        cookie_token = client.cookies["csrftoken"].value
        json_token = csrf_res.data["csrfToken"]
        self.assertTrue(cookie_token)
        self.assertTrue(json_token)

        login_res = client.post(
            "/api/auth/login/",
            {"email": "admin@fixes.local", "password": "FixPassword@123"},
            format="json",
            HTTP_X_CSRFTOKEN=json_token,
        )
        self.assertEqual(login_res.status_code, 200)
        self.assertIn("user", login_res.data)

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

    def test_employee_temporary_password_login(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('ADMIN')}")
        emp_email = "newemp@flumenx.local"
        temp_pass = "TempPass#2026"
        create_res = self.client.post("/api/employees/", {
            "employee_code": "FLX-999",
            "name": "New Temp Employee",
            "email": emp_email,
            "phone": "9876543210",
            "department": "Web Development",
            "designation": "Developer",
            "joining_date": "2026-08-05",
            "status": "Active",
            "portal_role": "EMPLOYEE",
            "password": temp_pass,
        }, format="json")
        self.assertEqual(create_res.status_code, 201)

        # Clear admin auth header
        self.client.credentials()
        login_res = self.client.post("/api/auth/login/", {
            "email": emp_email,
            "password": temp_pass,
        }, format="json")
        self.assertEqual(login_res.status_code, 200)
        self.assertIn("user", login_res.data)
        self.assertIn("flumenx_access", login_res.cookies)
        self.assertEqual(login_res.data["user"]["email"], emp_email)

    def test_employee_create_emails_login_details(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('ADMIN')}")
        emp_email = "welcome@flumenx.local"
        temp_pass = "Welcome#2026"

        create_res = self.client.post("/api/employees/", {
            "employee_code": "FLX-WELCOME",
            "name": "Welcome Employee",
            "email": emp_email,
            "phone": "9876543210",
            "department": "Web Development",
            "designation": "Developer",
            "joining_date": "2026-08-05",
            "status": "Active",
            "portal_role": "EMPLOYEE",
            "password": temp_pass,
        }, format="json")

        self.assertEqual(create_res.status_code, 201, create_res.data)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertIn(emp_email, message.to)
        self.assertIn("Your Login Details", message.subject)
        self.assertIn(f"Email: {emp_email}", message.body)
        self.assertIn(f"Temporary password: {temp_pass}", message.body)
        self.assertIn("/login", message.body)

    def test_work_assignment_assignee_and_management_permissions(self):
        from portal.models import Client, WorkAssignment
        client_obj = Client.objects.create(name="Test Client Corp")
        assignee_emp = self.accounts["EMPLOYEE"].employee
        admin_user = self.accounts["ADMIN"]

        # Admin creates assignment
        assignment = WorkAssignment.objects.create(
            employee=assignee_emp,
            client=client_obj,
            title="Design Homepage Banner",
            description="Create responsive banners",
            priority="Normal",
            assigned_date=date.today(),
            due_date=date.today(),
            assigned_quantity=10,
            completed_quantity=0,
            unit="items",
            assigned_by=admin_user,
        )

        # Assignee attempts to edit restricted assignment fields (title) -> 403 / PermissionDenied
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('EMPLOYEE')}")
        patch_res = self.client.patch(f"/api/work-assignments/{assignment.id}/", {
            "title": "Maliciously Renamed Title",
        }, format="json")
        self.assertEqual(patch_res.status_code, 403)

        # Assignee attempts to delete assignment -> 403 / PermissionDenied
        del_res = self.client.delete(f"/api/work-assignments/{assignment.id}/")
        self.assertEqual(del_res.status_code, 403)

        # Assignee updates progress/status -> 200 OK
        prog_res = self.client.patch(f"/api/work-assignments/{assignment.id}/", {
            "completed_quantity": 5,
            "status": "In Progress",
        }, format="json")
        self.assertEqual(prog_res.status_code, 200)

        # Management (Admin) can edit and delete
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('ADMIN')}")
        mgmt_edit = self.client.patch(f"/api/work-assignments/{assignment.id}/", {
            "title": "Admin Updated Title",
        }, format="json")
        self.assertEqual(mgmt_edit.status_code, 200)

        mgmt_del = self.client.delete(f"/api/work-assignments/{assignment.id}/")
        self.assertEqual(mgmt_del.status_code, 204)

    def test_password_reset_minimum_8_character_rule(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        target_user = self.accounts["EMPLOYEE"]
        uid = urlsafe_base64_encode(force_bytes(target_user.pk))
        token = default_token_generator.make_token(target_user)

        # 1. 7-character password -> rejected (HTTP 400)
        res_7 = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": uid, "token": token, "new_password": "1234567"
        }, format="json")
        self.assertEqual(res_7.status_code, 400)
        self.assertIn("new_password", res_7.data)

        # 2. Numeric-only 8-character password -> accepted (HTTP 200)
        res_num = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": uid, "token": token, "new_password": "12345678"
        }, format="json")
        self.assertEqual(res_num.status_code, 200)

        # 3. Old password no longer works
        self.client.credentials()
        old_login = self.client.post("/api/auth/login/", {
            "email": target_user.email, "password": "FixPassword@123"
        }, format="json")
        self.assertEqual(old_login.status_code, 401)

        # 4. New password works
        new_login = self.client.post("/api/auth/login/", {
            "email": target_user.email, "password": "12345678"
        }, format="json")
        self.assertEqual(new_login.status_code, 200)

        # 5. Token is single-use: reusing same token returns HTTP 400
        res_reuse = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": uid, "token": token, "new_password": "password123"
        }, format="json")
        self.assertEqual(res_reuse.status_code, 400)

        # 6. Common 8+ character password ('password123') accepted with fresh token
        target_user.refresh_from_db()
        token2 = default_token_generator.make_token(target_user)
        res_common = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": uid, "token": token2, "new_password": "password123"
        }, format="json")
        self.assertEqual(res_common.status_code, 200)

        # 7. Username-like 8+ character password ('employee@fixes.local') accepted with fresh token
        target_user.refresh_from_db()
        token3 = default_token_generator.make_token(target_user)
        res_userlike = self.client.post("/api/auth/password-reset/confirm/", {
            "uid": uid, "token": token3, "new_password": "employee@fixes.local"
        }, format="json")
        self.assertEqual(res_userlike.status_code, 200)

    def test_duplicate_existing_user_email_rejection_and_no_password_overwrite(self):
        # 1. Existing user with email 'admin@fixes.local' and password 'FixPassword@123'
        admin_user = self.accounts["ADMIN"]
        original_pass = "FixPassword@123"

        # 2. Attempt to create an employee with the SAME email 'admin@fixes.local'
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('ADMIN')}")
        dup_res = self.client.post("/api/employees/", {
            "employee_code": "FLX-888",
            "name": "Imposter Employee",
            "email": "  ADMIN@fixes.local  ", # Case and whitespace variations
            "phone": "9876543211",
            "department": "Web Development",
            "designation": "Developer",
            "joining_date": "2026-08-05",
            "status": "Active",
            "portal_role": "EMPLOYEE",
            "password": "OverwritingPass#123",
        }, format="json")

        # 3. Must be rejected with HTTP 400 validation error
        self.assertEqual(dup_res.status_code, 400)
        self.assertIn("email", dup_res.data)

        # 4. Verify existing admin user's password was NOT overwritten and original login still works
        self.client.credentials()
        admin_login = self.client.post("/api/auth/login/", {
            "email": "admin@fixes.local",
            "password": original_pass,
        }, format="json")
        self.assertEqual(admin_login.status_code, 200)

        # 5. Overwriting password attempt fails login
        failed_login = self.client.post("/api/auth/login/", {
            "email": "admin@fixes.local",
            "password": "OverwritingPass#123",
        }, format="json")
        self.assertEqual(failed_login.status_code, 401)

    def test_reviewer_workflow_and_delete_permissions(self):
        from portal.models import Client, WorkAssignment
        client_obj = Client.objects.create(name="Reviewer Client Corp")
        assignee_emp = self.accounts["EMPLOYEE"].employee
        reviewer_user = self.accounts["BDO"]
        unrelated_user = self.accounts["ACCOUNTANT"]

        # Assignment created with BDO user as reviewer
        assignment = WorkAssignment.objects.create(
            employee=assignee_emp,
            client=client_obj,
            title="Video Banner Review",
            description="Review assigned video",
            priority="High",
            assigned_date=date.today(),
            due_date=date.today(),
            assigned_quantity=1,
            completed_quantity=0,
            unit="video",
            reviewer=reviewer_user,
            reviewer_name="BDO User",
            status="In Review",
        )

        # 1. Assigned employee attempts to move to "Approved" or "Published" -> HTTP 400 / 403
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('EMPLOYEE')}")
        emp_app_res = self.client.patch(f"/api/work-assignments/{assignment.id}/", {"status": "Approved"}, format="json")
        self.assertIn(emp_app_res.status_code, (400, 403))
        emp_pub_res = self.client.patch(f"/api/work-assignments/{assignment.id}/", {"status": "Published"}, format="json")
        self.assertIn(emp_pub_res.status_code, (400, 403))

        # 2. Assigned employee attempts to delete assignment -> HTTP 403 Forbidden
        emp_del_res = self.client.delete(f"/api/work-assignments/{assignment.id}/")
        self.assertEqual(emp_del_res.status_code, 403)

        # 3. Unrelated user attempts to delete assignment -> HTTP 403 Forbidden
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('ACCOUNTANT')}")
        unrel_del_res = self.client.delete(f"/api/work-assignments/{assignment.id}/")
        self.assertEqual(unrel_del_res.status_code, 403)

        # 4. Assigned reviewer moves status: In Review -> Approved -> Published (200 OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('BDO')}")
        rev_app_res = self.client.patch(f"/api/work-assignments/{assignment.id}/", {"status": "Approved"}, format="json")
        self.assertEqual(rev_app_res.status_code, 200)
        self.assertEqual(rev_app_res.data["status"], "Approved")

        rev_pub_res = self.client.patch(f"/api/work-assignments/{assignment.id}/", {"status": "Published"}, format="json")
        self.assertEqual(rev_pub_res.status_code, 200)
        self.assertEqual(rev_pub_res.data["status"], "Published")

        # 5. Assigned reviewer deletes own reviewed assignment -> HTTP 204 No Content
        del_res = self.client.delete(f"/api/work-assignments/{assignment.id}/")
        self.assertEqual(del_res.status_code, 204)
        self.assertFalse(WorkAssignment.objects.filter(id=assignment.id).exists())
