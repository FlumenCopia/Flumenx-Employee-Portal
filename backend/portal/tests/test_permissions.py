from datetime import date, time

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from portal.models import AttendanceCorrection, AttendancePolicy, AttendanceRecord, Employee, UserRole


class RoleAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.accounts = {}
        AttendancePolicy.current()
        for index, role in enumerate(("ADMIN", "HR", "ACCOUNTANT", "BDE", "EMPLOYEE"), start=1):
            email = f"{role.lower()}@roles.local"
            user = User.objects.create_user(email, password="RolePass@123", is_superuser=role == "ADMIN")
            UserRole.objects.create(user=user, role=role)
            if role != "ADMIN":
                Employee.objects.create(
                    user=user, employee_code=f"ROLE-{index}", name=role.title(), email=email,
                    phone=f"900000000{index}", department="HR" if role == "HR" else "Accountant" if role == "ACCOUNTANT" else "Digital Marketing",
                    designation=role.title(), joining_date=date.today(),
                )
            self.accounts[role] = user

    def token_for(self, role):
        return str(RefreshToken.for_user(self.accounts[role]).access_token)

    def get_as(self, role, path):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(role)}")
        return self.client.get(path)

    def post_as(self, role, path, data):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(role)}")
        return self.client.post(path, data, format="json")

    def put_as(self, role, path, data):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(role)}")
        return self.client.put(path, data, format="json")

    def test_all_five_roles_authenticate(self):
        for role in self.accounts:
            self.token_for(role)

    def test_cross_role_api_permissions(self):
        self.assertEqual(self.get_as("ADMIN", "/api/audit-logs/").status_code, 200)
        self.assertEqual(self.get_as("HR", "/api/employees/").status_code, 200)
        self.assertEqual(self.get_as("HR", "/api/audit-logs/").status_code, 403)
        self.assertEqual(self.get_as("ACCOUNTANT", "/api/employees/").status_code, 403)
        self.assertEqual(self.get_as("ACCOUNTANT", "/api/salary-slips/").status_code, 200)
        self.assertEqual(self.get_as("BDE", "/api/employees/").status_code, 403)
        self.assertEqual(self.get_as("EMPLOYEE", "/api/employees/").status_code, 403)

    def create_attendance_records(self):
        records = {}
        for role in ("HR", "ACCOUNTANT", "BDE", "EMPLOYEE"):
            records[role] = AttendanceRecord.objects.create(
                employee=self.accounts[role].employee,
                attendance_date=date.today(),
                check_in_time=time(9, 30),
                check_out_time=time(18, 30),
            )
        return records

    def test_admin_and_hr_can_view_all_attendance(self):
        self.create_attendance_records()
        admin_response = self.get_as("ADMIN", "/api/attendance/")
        hr_response = self.get_as("HR", "/api/attendance/")
        self.assertEqual(admin_response.status_code, 200)
        self.assertEqual(hr_response.status_code, 200)
        self.assertEqual(admin_response.data["count"], 4)
        self.assertEqual(hr_response.data["count"], 4)

    def test_accountant_bde_and_employee_view_only_own_attendance(self):
        records = self.create_attendance_records()
        for role in ("ACCOUNTANT", "BDE", "EMPLOYEE"):
            with self.subTest(role=role):
                response = self.get_as(role, "/api/attendance/")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["count"], 1)
                self.assertEqual(response.data["results"][0]["id"], records[role].id)

    def test_employee_bde_and_accountant_can_mark_own_attendance(self):
        for role in ("EMPLOYEE", "BDE", "ACCOUNTANT"):
            with self.subTest(role=role):
                response = self.post_as(role, "/api/attendance/check-in/", {
                    "latitude": 12.971599,
                    "longitude": 77.594566,
                    "employee": self.accounts["HR"].employee.id,
                })
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["employee"], self.accounts[role].employee.id)
                self.assertFalse(AttendanceRecord.objects.filter(employee=self.accounts["HR"].employee).exists())

    def test_admin_and_hr_cannot_mark_attendance_without_employee_workspace(self):
        for role in ("ADMIN", "HR"):
            with self.subTest(role=role):
                response = self.post_as(role, "/api/attendance/check-in/", {
                    "latitude": 12.971599,
                    "longitude": 77.594566,
                })
                self.assertEqual(response.status_code, 403)

    def employee_payload(self, code="ROLE-NEW", email="created.employee@roles.local", role="EMPLOYEE"):
        return {
            "employee_code": code,
            "name": f"Created {role.title()}",
            "email": email,
            "phone": "9111111111",
            "department": "Operations",
            "portal_role": role,
            "designation": role.title(),
            "joining_date": date.today().isoformat(),
            "status": "Active",
            "password": "RolePass@123",
        }

    def test_employee_create_sets_selected_portal_roles(self):
        for role in ("HR", "ACCOUNTANT", "BDE", "EMPLOYEE"):
            with self.subTest(role=role):
                response = self.post_as("ADMIN", "/api/employees/", self.employee_payload(
                    code=f"ROLE-NEW-{role}",
                    email=f"created.{role.lower()}@roles.local",
                    role=role,
                ))
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["portal_role"], role)
                user = User.objects.get(email=f"created.{role.lower()}@roles.local")
                self.assertEqual(user.portal_profile.role, role)
                self.assertEqual(UserRole.objects.filter(user=user).count(), 1)

    def test_employee_update_changes_linked_portal_role_without_duplicate(self):
        employee = self.accounts["EMPLOYEE"].employee
        response = self.put_as("ADMIN", f"/api/employees/{employee.id}/", {
            "employee_code": employee.employee_code,
            "name": employee.name,
            "email": employee.email,
            "phone": employee.phone,
            "department": employee.department,
            "portal_role": "BDE",
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "location": employee.location,
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["portal_role"], "BDE")
        employee.user.portal_profile.refresh_from_db()
        self.assertEqual(employee.user.portal_profile.role, "BDE")
        self.assertEqual(UserRole.objects.filter(user=employee.user).count(), 1)

    def test_employee_create_duplicate_user_username_returns_400(self):
        response = self.post_as("ADMIN", "/api/employees/", self.employee_payload(
            code="ROLE-DUP-USER",
            email=self.accounts["ADMIN"].username,
        ))
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_employee_create_duplicate_employee_email_returns_400(self):
        response = self.post_as("ADMIN", "/api/employees/", self.employee_payload(
            code="ROLE-DUP-EMAIL",
            email=self.accounts["EMPLOYEE"].employee.email,
        ))
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_employee_create_duplicate_employee_code_returns_400(self):
        response = self.post_as("ADMIN", "/api/employees/", self.employee_payload(
            code=self.accounts["EMPLOYEE"].employee.employee_code,
            email="duplicate.code@roles.local",
        ))
        self.assertEqual(response.status_code, 400)
        self.assertIn("employee_code", response.data)

    def test_employee_update_can_keep_own_email_and_code(self):
        employee = self.accounts["EMPLOYEE"].employee
        response = self.put_as("ADMIN", f"/api/employees/{employee.id}/", {
            "employee_code": employee.employee_code,
            "name": employee.name,
            "email": employee.email,
            "phone": employee.phone,
            "department": employee.department,
            "portal_role": "EMPLOYEE",
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "location": employee.location,
        })
        self.assertEqual(response.status_code, 200, response.data)

    def test_employee_create_rejects_missing_department(self):
        payload = self.employee_payload(code="ROLE-NO-DEPT", email="no.dept@roles.local")
        payload.pop("department")
        response = self.post_as("ADMIN", "/api/employees/", payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("department", response.data)

    def test_employee_create_rejects_invalid_department(self):
        response = self.post_as("ADMIN", "/api/employees/", self.employee_payload(
            code="ROLE-BAD-DEPT",
            email="bad.dept@roles.local",
        ) | {"department": "Engineering"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("department", response.data)

    def test_employee_update_syncs_linked_user_email_and_username(self):
        employee = self.accounts["EMPLOYEE"].employee
        old_email = employee.email
        response = self.put_as("ADMIN", f"/api/employees/{employee.id}/", {
            "employee_code": employee.employee_code,
            "name": employee.name,
            "email": " Updated.Employee@Roles.Local ",
            "phone": employee.phone,
            "department": employee.department,
            "portal_role": "EMPLOYEE",
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "location": employee.location,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], "updated.employee@roles.local")
        employee.refresh_from_db()
        employee.user.refresh_from_db()
        self.assertEqual(employee.email, "updated.employee@roles.local")
        self.assertEqual(employee.user.email, "updated.employee@roles.local")
        self.assertEqual(employee.user.username, "updated.employee@roles.local")
        self.assertFalse(User.objects.filter(email__iexact=old_email).exists())

    def test_employee_update_rejects_case_insensitive_user_email_collision(self):
        employee = self.accounts["EMPLOYEE"].employee
        response = self.put_as("ADMIN", f"/api/employees/{employee.id}/", {
            "employee_code": employee.employee_code,
            "name": employee.name,
            "email": self.accounts["HR"].email.upper(),
            "phone": employee.phone,
            "department": employee.department,
            "portal_role": "EMPLOYEE",
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "location": employee.location,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_hr_can_create_allowed_employee_roles(self):
        for role in ("ACCOUNTANT", "BDE", "EMPLOYEE"):
            with self.subTest(role=role):
                response = self.post_as("HR", "/api/employees/", self.employee_payload(
                    code=f"HR-CREATE-{role}",
                    email=f"hr.created.{role.lower()}@roles.local",
                    role=role,
                ))
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["portal_role"], role)

    def test_hr_cannot_create_or_promote_to_hr(self):
        create = self.post_as("HR", "/api/employees/", self.employee_payload(
            code="HR-BLOCK-HR",
            email="hr.block.hr@roles.local",
            role="HR",
        ))
        self.assertEqual(create.status_code, 400)
        self.assertIn("portal_role", create.data)

        employee = self.accounts["EMPLOYEE"].employee
        promote = self.put_as("HR", f"/api/employees/{employee.id}/", {
            "employee_code": employee.employee_code,
            "name": employee.name,
            "email": employee.email,
            "phone": employee.phone,
            "department": employee.department,
            "portal_role": "HR",
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "location": employee.location,
        })
        self.assertEqual(promote.status_code, 400)
        self.assertIn("portal_role", promote.data)

    def test_hr_cannot_modify_existing_hr_record(self):
        employee = self.accounts["HR"].employee
        response = self.put_as("HR", f"/api/employees/{employee.id}/", {
            "employee_code": employee.employee_code,
            "name": "Changed HR",
            "email": employee.email,
            "phone": employee.phone,
            "department": employee.department,
            "portal_role": "EMPLOYEE",
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "location": employee.location,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)

    def test_admin_cannot_demote_existing_admin_employee_record(self):
        admin_user = self.accounts["ADMIN"]
        employee = Employee.objects.create(
            user=admin_user,
            employee_code="ROLE-ADMIN-EMP",
            name="Admin Employee",
            email=admin_user.username,
            phone="9000000099",
            department="Operations",
            designation="Administrator",
            joining_date=date.today(),
        )
        response = self.put_as("ADMIN", f"/api/employees/{employee.id}/", {
            "employee_code": employee.employee_code,
            "name": employee.name,
            "email": employee.email,
            "phone": employee.phone,
            "department": employee.department,
            "portal_role": "HR",
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "location": employee.location,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)

    def test_employee_update_to_another_employee_email_returns_400(self):
        employee = self.accounts["EMPLOYEE"].employee
        response = self.put_as("ADMIN", f"/api/employees/{employee.id}/", {
            "employee_code": employee.employee_code,
            "name": employee.name,
            "email": self.accounts["HR"].employee.email,
            "phone": employee.phone,
            "portal_role": "EMPLOYEE",
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "location": employee.location,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_employee_update_to_another_employee_code_returns_400(self):
        employee = self.accounts["EMPLOYEE"].employee
        response = self.put_as("ADMIN", f"/api/employees/{employee.id}/", {
            "employee_code": self.accounts["HR"].employee.employee_code,
            "name": employee.name,
            "email": employee.email,
            "phone": employee.phone,
            "portal_role": "EMPLOYEE",
            "designation": employee.designation,
            "joining_date": employee.joining_date.isoformat(),
            "status": employee.status,
            "location": employee.location,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("employee_code", response.data)

    def test_attendance_correction_uses_portal_role_not_staff_flag(self):
        employee_record = AttendanceRecord.objects.create(
            employee=self.accounts["EMPLOYEE"].employee,
            attendance_date=date.today(),
            check_in_time=time(9, 45),
            check_out_time=time(18, 30),
        )
        bde_record = AttendanceRecord.objects.create(
            employee=self.accounts["BDE"].employee,
            attendance_date=date.today(),
            check_in_time=time(9, 30),
            check_out_time=time(18, 30),
        )
        self.accounts["BDE"].is_staff = True
        self.accounts["BDE"].save(update_fields=["is_staff"])

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for('BDE')}")
        forbidden = self.client.post("/api/attendance-corrections/", {
            "attendance_record": employee_record.id,
            "requested_check_in": "09:35:00",
            "reason": "Trying another user's record",
        }, format="json")
        self.assertEqual(forbidden.status_code, 400)
        self.assertEqual(AttendanceCorrection.objects.count(), 0)

        own_record = self.client.post("/api/attendance-corrections/", {
            "attendance_record": bde_record.id,
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
