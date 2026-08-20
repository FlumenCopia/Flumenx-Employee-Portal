from datetime import date, timedelta
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portal.models import Client, Department, Employee, UserRole, WorkAssignment


class BulkTaskCreationTests(APITestCase):
    def setUp(self):
        self.dept_design, _ = Department.objects.get_or_create(name="Design")

        # Admin user
        self.admin_user, _ = User.objects.get_or_create(
            username="admin_user",
            defaults={"email": "admin@example.com", "is_superuser": True, "is_staff": True}
        )
        UserRole.objects.update_or_create(user=self.admin_user, defaults={"role": "ADMIN"})

        # Reviewer user
        self.reviewer_user, _ = User.objects.get_or_create(
            username="reviewer_tl",
            defaults={"email": "reviewer@example.com", "first_name": "Dishun"}
        )
        UserRole.objects.update_or_create(user=self.reviewer_user, defaults={"role": "TEAM_LEAD"})
        self.reviewer_emp, _ = Employee.objects.get_or_create(
            user=self.reviewer_user,
            defaults={
                "employee_code": "EMP-REV",
                "name": "Dishun Reviewer",
                "email": "reviewer@example.com",
                "department": "Design",
                "joining_date": date.today()
            }
        )

        # Assigned employee
        self.employee_user, _ = User.objects.get_or_create(
            username="sreejith_emp",
            defaults={"email": "sreejith@example.com", "first_name": "Sreejith"}
        )
        UserRole.objects.update_or_create(user=self.employee_user, defaults={"role": "EMPLOYEE"})
        self.employee_emp, _ = Employee.objects.get_or_create(
            user=self.employee_user,
            defaults={
                "employee_code": "EMP-SREE",
                "name": "Sreejith Developer",
                "email": "sreejith@example.com",
                "department": "Design",
                "joining_date": date.today(),
                "team_lead": self.reviewer_emp
            }
        )

        self.client_floxa, _ = Client.objects.get_or_create(name="Floxa")

    def test_bulk_create_three_valid_tasks(self):
        self.client.force_authenticate(user=self.admin_user)
        due1 = str(date.today() + timedelta(days=2))
        due2 = str(date.today() + timedelta(days=3))
        due3 = str(date.today() + timedelta(days=5))

        payload = {
            "client": self.client_floxa.id,
            "employee": self.employee_emp.id,
            "reviewer": self.reviewer_user.id,
            "work_type": "design",
            "priority": "High",
            "tasks": [
                {"title": "Independence Day Poster", "due_date": due1},
                {"title": "Product Launch Poster", "due_date": due2},
                {"title": "Hiring Poster", "due_date": due3},
            ]
        }

        res = self.client.post("/api/work-assignments/bulk-create/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data), 3)

        # Verify 3 independent WorkAssignment rows were created in DB
        assignments = list(WorkAssignment.objects.filter(employee=self.employee_emp).order_by("due_date"))
        self.assertEqual(len(assignments), 3)

        # Test 2: Verify shared fields across all tasks
        for assign in assignments:
            self.assertEqual(assign.client, self.client_floxa)
            self.assertEqual(assign.employee, self.employee_emp)
            self.assertEqual(assign.reviewer, self.reviewer_user)
            self.assertEqual(assign.priority, "High")
            self.assertEqual(assign.status, "Assigned")
            self.assertEqual(assign.assigned_by, self.admin_user)


        # Test 3: Verify different due dates
        self.assertEqual(str(assignments[0].due_date), due1)
        self.assertEqual(str(assignments[0].title), "Independence Day Poster")

        self.assertEqual(str(assignments[1].due_date), due2)
        self.assertEqual(str(assignments[1].title), "Product Launch Poster")

        self.assertEqual(str(assignments[2].due_date), due3)
        self.assertEqual(str(assignments[2].title), "Hiring Poster")

    def test_bulk_create_atomic_rollback_on_invalid_task(self):
        self.client.force_authenticate(user=self.admin_user)
        due1 = str(date.today() + timedelta(days=2))

        # Task 2 is missing due_date
        payload = {
            "client": self.client_floxa.id,
            "employee": self.employee_emp.id,
            "reviewer": self.reviewer_user.id,
            "work_type": "design",
            "priority": "High",
            "tasks": [
                {"title": "Valid Poster", "due_date": due1},
                {"title": "Invalid Poster - No Due Date", "due_date": ""},
                {"title": "Another Poster", "due_date": due1},
            ]
        }

        res = self.client.post("/api/work-assignments/bulk-create/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Test 4: Verify entire transaction rolled back and ZERO tasks created
        self.assertEqual(WorkAssignment.objects.filter(employee=self.employee_emp).count(), 0)

    def test_bulk_create_unauthorized_user_forbidden(self):
        # Authenticate as standard employee who cannot create tasks
        self.client.force_authenticate(user=self.employee_user)
        due1 = str(date.today() + timedelta(days=2))

        payload = {
            "client": self.client_floxa.id,
            "employee": self.employee_emp.id,
            "reviewer": self.reviewer_user.id,
            "work_type": "design",
            "priority": "High",
            "tasks": [
                {"title": "Unauthorized Task", "due_date": due1}
            ]
        }

        res = self.client.post("/api/work-assignments/bulk-create/", payload, format="json")
        # Test 5: Verify 403 Forbidden returned
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_single_task_creation_still_works(self):
        self.client.force_authenticate(user=self.admin_user)
        due1 = str(date.today() + timedelta(days=2))

        payload = {
            "client": self.client_floxa.id,
            "employee": self.employee_emp.id,
            "title": "Single Standard Task",
            "work_type": "design",
            "priority": "Normal",
            "assigned_date": str(date.today()),
            "due_date": due1,
            "status": "Pending",
            "assigned_quantity": 1,
            "unit": "Task"
        }

        res = self.client.post("/api/work-assignments/", payload, format="json")
        # Test 6: Verify normal POST /api/work-assignments/ still works
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(WorkAssignment.objects.filter(title="Single Standard Task").exists())

    def test_assigned_vs_backlog_derivation_cases(self):
        self.client.force_authenticate(user=self.admin_user)
        today_date = date.today()
        yesterday_date = today_date - timedelta(days=1)

        # Case 1: assigned_date = today, status = Assigned -> is_backlog = False
        w1 = WorkAssignment.objects.create(
            client=self.client_floxa, employee=self.employee_emp, title="T1",
            assigned_date=today_date, due_date=today_date, status="Assigned"
        )
        # Case 2: assigned_date = today, status = Pending -> is_backlog = False
        w2 = WorkAssignment.objects.create(
            client=self.client_floxa, employee=self.employee_emp, title="T2",
            assigned_date=today_date, due_date=today_date, status="Pending"
        )
        # Case 3: assigned_date = yesterday, status = Assigned -> is_backlog = True
        w3 = WorkAssignment.objects.create(
            client=self.client_floxa, employee=self.employee_emp, title="T3",
            assigned_date=yesterday_date, due_date=today_date, status="Assigned"
        )
        # Case 4: assigned_date = yesterday, status = In Progress -> is_backlog = True
        w4 = WorkAssignment.objects.create(
            client=self.client_floxa, employee=self.employee_emp, title="T4",
            assigned_date=yesterday_date, due_date=today_date, status="In Progress"
        )
        # Case 5: assigned_date = yesterday, status = In Review -> is_backlog = True
        w5 = WorkAssignment.objects.create(
            client=self.client_floxa, employee=self.employee_emp, title="T5",
            assigned_date=yesterday_date, due_date=today_date, status="In Review"
        )
        # Case 6: assigned_date = yesterday, status = Completed -> is_backlog = False
        w6 = WorkAssignment.objects.create(
            client=self.client_floxa, employee=self.employee_emp, title="T6",
            assigned_date=yesterday_date, due_date=today_date, status="Completed"
        )
        # Case 7: assigned_date = yesterday, status = Approved -> is_backlog = False
        w7 = WorkAssignment.objects.create(
            client=self.client_floxa, employee=self.employee_emp, title="T7",
            assigned_date=yesterday_date, due_date=today_date, status="Approved"
        )
        # Case 8: assigned_date = yesterday, status = Published -> is_backlog = False
        w8 = WorkAssignment.objects.create(
            client=self.client_floxa, employee=self.employee_emp, title="T8",
            assigned_date=yesterday_date, due_date=today_date, status="Published"
        )

        res = self.client.get(f"/api/work-assignments/{w1.id}/")
        self.assertFalse(res.data["is_backlog"])

        res = self.client.get(f"/api/work-assignments/{w2.id}/")
        self.assertFalse(res.data["is_backlog"])

        res = self.client.get(f"/api/work-assignments/{w3.id}/")
        self.assertTrue(res.data["is_backlog"])

        res = self.client.get(f"/api/work-assignments/{w4.id}/")
        self.assertTrue(res.data["is_backlog"])

        res = self.client.get(f"/api/work-assignments/{w5.id}/")
        self.assertTrue(res.data["is_backlog"])

        res = self.client.get(f"/api/work-assignments/{w6.id}/")
        self.assertFalse(res.data["is_backlog"])

        res = self.client.get(f"/api/work-assignments/{w7.id}/")
        self.assertFalse(res.data["is_backlog"])

        res = self.client.get(f"/api/work-assignments/{w8.id}/")
        self.assertFalse(res.data["is_backlog"])

