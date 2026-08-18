from datetime import date, time, timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from portal.models import (
    AttendanceRecord, Client, Employee, EmployeeKPIRating, LeaveRequest, UserRole, WorkAssignment
)
from portal.services.kpi_service import KPIService, get_kpi_grade


class KPISystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin_user = User.objects.create_user("admin@kpi.local", password="Pass@123", is_superuser=True)
        UserRole.objects.create(user=self.admin_user, role="ADMIN")

        # HR user
        self.hr_user = User.objects.create_user("hr@kpi.local", password="Pass@123")
        UserRole.objects.create(user=self.hr_user, role="HR")

        # Operations Head user
        self.ops_user = User.objects.create_user("opshead@kpi.local", password="Pass@123")
        UserRole.objects.create(user=self.ops_user, role="OPERATIONS_HEAD")
        self.ops_emp = Employee.objects.create(
            user=self.ops_user, employee_code="OPS-001", name="Ops Head User",
            email="opshead@kpi.local", phone="9876543210", department="Operations",
            designation="Operations Head", joining_date=date.today()
        )

        # Employee 1 user
        self.emp1_user = User.objects.create_user("emp1@kpi.local", password="Pass@123")
        UserRole.objects.create(user=self.emp1_user, role="EMPLOYEE")
        self.emp1 = Employee.objects.create(
            user=self.emp1_user, employee_code="EMP-001", name="Alice Developer",
            email="emp1@kpi.local", phone="9876543211", department="Web Development",
            designation="Developer", joining_date=date.today()
        )

        # Employee 2 user
        self.emp2_user = User.objects.create_user("emp2@kpi.local", password="Pass@123")
        UserRole.objects.create(user=self.emp2_user, role="EMPLOYEE")
        self.emp2 = Employee.objects.create(
            user=self.emp2_user, employee_code="EMP-002", name="Bob Designer",
            email="emp2@kpi.local", phone="9876543212", department="Design",
            designation="Designer", joining_date=date.today()
        )

        # Client for work assignments
        self.client_obj = Client.objects.create(name="KPI Test Client")

    def token_for(self, user):
        return str(RefreshToken.for_user(user).access_token)

    def test_kpi_grade_boundaries(self):
        self.assertEqual(get_kpi_grade(9.7), "Outstanding")
        self.assertEqual(get_kpi_grade(9.5), "Outstanding")
        self.assertEqual(get_kpi_grade(9.0), "Excellent")
        self.assertEqual(get_kpi_grade(8.5), "Excellent")
        self.assertEqual(get_kpi_grade(8.0), "Good")
        self.assertEqual(get_kpi_grade(7.5), "Good")
        self.assertEqual(get_kpi_grade(6.5), "Needs Improvement")
        self.assertEqual(get_kpi_grade(6.0), "Needs Improvement")
        self.assertEqual(get_kpi_grade(5.5), "Critical")
        self.assertEqual(get_kpi_grade(0.0), "Critical")

    def test_kpi_calculation_perfect_score(self):
        today = date.today()

        from datetime import datetime
        # Work Assignment: 100% completed on time (status="Published")
        WorkAssignment.objects.create(
            employee=self.emp1, client=self.client_obj, title="Task 1",
            assigned_date=date(today.year, today.month, 1),
            due_date=date(today.year, today.month, 10),
            assigned_quantity=100, completed_quantity=100, status="Published",
            completed_at=timezone.make_aware(datetime.combine(date(today.year, today.month, 5), time(12, 0)))
        )

        # Attendance: Present every day
        for d in range(1, 6):
            AttendanceRecord.objects.create(
                employee=self.emp1, attendance_date=date(today.year, today.month, d),
                check_in_time=time(9, 15), check_out_time=time(18, 30), attendance_status="Present"
            )

        kpi = KPIService.calculate_employee_kpi(self.emp1, today.month, today.year)
        self.assertTrue(kpi["is_evaluated"])
        self.assertEqual(kpi["final_score"], 10.0)
        self.assertEqual(kpi["grade"], "Outstanding")
        self.assertEqual(kpi["components"]["attendance"]["score"], 2.0)
        self.assertEqual(kpi["components"]["on_time_delivery"]["score"], 3.0)
        self.assertEqual(kpi["components"]["pending_work"]["score"], 2.0)
        self.assertEqual(kpi["components"]["rework"]["score"], 2.0)
        self.assertEqual(kpi["components"]["work_completion"]["score"], 1.0)

    def test_kpi_does_not_award_full_score_without_activity(self):
        today = date.today()

        kpi = KPIService.calculate_employee_kpi(self.emp2, today.month, today.year)

        self.assertEqual(kpi["final_score"], 0.0)
        self.assertEqual(kpi["score_out_of_10"], 0.0)
        self.assertFalse(kpi["is_evaluated"])
        self.assertEqual(kpi["grade"], "Not Evaluated")

    def test_manager_rating_api_and_permissions(self):
        today = date.today()
        url = "/api/kpi/rating/"
        data = {
            "employee_id": self.emp1.id,
            "month": today.month,
            "year": today.year,
            "rating": 4.0,
            "notes": "Good effort overall"
        }

        # Admin can update rating
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.admin_user)}")
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, 200)

        rating_db = EmployeeKPIRating.objects.get(employee=self.emp1, month=today.month, year=today.year)
        self.assertEqual(float(rating_db.rating), 4.0)

        # HR can update rating
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.hr_user)}")
        data["rating"] = 4.5
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, 200)

        # Ops Head can update rating
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.ops_user)}")
        data["rating"] = 3.5
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, 200)

        # Regular employee CANNOT update rating (403)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.emp1_user)}")
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, 403)

    def test_dashboard_permissions(self):
        dash_url = "/api/kpi/dashboard/"

        # Admin allowed
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.admin_user)}")
        self.assertEqual(self.client.get(dash_url).status_code, 200)

        # HR allowed
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.hr_user)}")
        self.assertEqual(self.client.get(dash_url).status_code, 200)

        # Ops Head allowed
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.ops_user)}")
        self.assertEqual(self.client.get(dash_url).status_code, 200)

        # Employee 1 forbidden from dashboard
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.emp1_user)}")
        self.assertEqual(self.client.get(dash_url).status_code, 403)

    def test_employee_detail_privacy(self):
        emp1_detail_url = f"/api/kpi/employee/{self.emp1.id}/"
        emp2_detail_url = f"/api/kpi/employee/{self.emp2.id}/"

        # Admin can view emp1 and emp2 detail
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.admin_user)}")
        self.assertEqual(self.client.get(emp1_detail_url).status_code, 200)
        self.assertEqual(self.client.get(emp2_detail_url).status_code, 200)

        # Emp1 can view own detail
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.emp1_user)}")
        self.assertEqual(self.client.get(emp1_detail_url).status_code, 200)

        # Emp1 CANNOT view Emp2 detail (403)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.emp1_user)}")
        self.assertEqual(self.client.get(emp2_detail_url).status_code, 403)

        # Emp1 can view my-kpi
        self.assertEqual(self.client.get("/api/kpi/my-kpi/").status_code, 200)

    def test_csv_export_endpoint(self):
        export_url = "/api/kpi/export-csv/"
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_for(self.admin_user)}")
        res = self.client.get(export_url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "text/csv")
        content = res.content.decode("utf-8")
        self.assertIn("Employee Code", content)
        self.assertIn("Alice Developer", content)
