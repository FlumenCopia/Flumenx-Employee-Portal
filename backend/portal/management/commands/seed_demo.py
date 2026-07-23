from datetime import date, time, timedelta
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from portal.models import Announcement, AttendancePolicy, AttendanceRecord, Employee, LeaveRequest, Meeting, SalarySlip, UserRole

class Command(BaseCommand):
    help = "Create presentation-ready FLUMENX demo data"

    def handle(self, *args, **kwargs):
        legacy_admin = User.objects.filter(username="admin@hive.local").first()
        if legacy_admin and not User.objects.filter(username="admin@flumenx.local").exists():
            legacy_admin.username = legacy_admin.email = "admin@flumenx.local"
            legacy_admin.save()
        admin, _ = User.objects.get_or_create(username="admin@flumenx.local", defaults={"email": "admin@flumenx.local", "first_name": "Aarav"})
        admin.is_staff = admin.is_superuser = True
        admin.set_password("Admin@123")
        admin.save()
        UserRole.objects.update_or_create(user=admin, defaults={"role": "ADMIN"})

        people = [
            ("FLX-001", "Maya Kapoor", "maya@flumenx.local", "Engineering", "Senior Product Engineer", "Bengaluru"),
            ("FLX-002", "Rohan Mehta", "rohan@flumenx.local", "Design", "Product Designer", "Mumbai"),
            ("FLX-003", "Ananya Singh", "ananya@flumenx.local", "HR", "People Operations Lead", "Delhi"),
            ("FLX-004", "Kabir Shah", "kabir@flumenx.local", "Finance", "Finance Analyst", "Pune"),
            ("FLX-005", "Ishita Rao", "ishita@flumenx.local", "Sales", "Enterprise Account Manager", "Hyderabad"),
            ("FLX-006", "Dev Malhotra", "dev@flumenx.local", "Operations", "Operations Manager", "Bengaluru"),
        ]
        employees = []
        for i, (code, name, email, dept, title, location) in enumerate(people):
            legacy_code = code.replace("FLX-", "HVE-")
            legacy_email = email.replace("@flumenx.local", "@hive.local")
            legacy_employee = Employee.objects.filter(employee_code=legacy_code).first()
            if legacy_employee and not Employee.objects.filter(employee_code=code).exists():
                legacy_employee.employee_code = code
                legacy_employee.email = email
                if legacy_employee.user:
                    legacy_employee.user.username = legacy_employee.user.email = email
                    legacy_employee.user.save()
                legacy_employee.save()
            user, _ = User.objects.get_or_create(username=email, defaults={"email": email, "first_name": name})
            user.set_password("Employee@123")
            user.is_staff = False
            user.save()
            role = (
                "HR" if email == "ananya@flumenx.local"
                else "ACCOUNTANT" if email == "kabir@flumenx.local"
                else "EMPLOYEE" if email == "dev@flumenx.local"
                else "BDO"
            )
            UserRole.objects.update_or_create(user=user, defaults={"role": role})
            employee, _ = Employee.objects.update_or_create(employee_code=code, defaults={
                "user": user, "name": name, "email": email, "phone": f"+91 98765 43{i:03d}",
                "department": dept, "designation": title, "joining_date": date(2022 + i % 3, (i % 9) + 1, 12),
                "status": "Active", "location": location,
            })
            employees.append(employee)

        hr_user = User.objects.get(username="ananya@flumenx.local")
        hr_user.set_password("HR@123")
        hr_user.save()
        accountant_user = User.objects.get(username="kabir@flumenx.local")
        accountant_user.set_password("Accountant@123")
        accountant_user.save()
        bdo_user = User.objects.get(username="maya@flumenx.local")
        bdo_user.set_password("BDO@123")
        bdo_user.save()
        employee_user = User.objects.get(username="dev@flumenx.local")
        employee_user.set_password("Employee@123")
        employee_user.save()

        LeaveRequest.objects.get_or_create(employee=employees[1], start_date=date.today() + timedelta(days=3), defaults={"end_date": date.today() + timedelta(days=5), "leave_type": "Annual", "reason": "Family event", "status": "Pending"})
        LeaveRequest.objects.get_or_create(employee=employees[0], start_date=date.today() - timedelta(days=12), defaults={"end_date": date.today() - timedelta(days=11), "leave_type": "Sick", "reason": "Recovery and rest", "status": "Approved"})
        LeaveRequest.objects.get_or_create(employee=employees[4], start_date=date.today() + timedelta(days=9), defaults={"end_date": date.today() + timedelta(days=9), "leave_type": "Personal", "reason": "Personal appointment", "status": "Pending"})

        for employee in employees:
            for offset in range(3):
                month = ((date.today().month - offset - 1) % 12) + 1
                year = date.today().year if month <= date.today().month else date.today().year - 1
                SalarySlip.objects.get_or_create(employee=employee, month=month, year=year, defaults={"gross_salary": 125000 + offset * 2500, "net_salary": 108500 + offset * 2200})

        meetings = [
            ("Q3 Product Direction", 2, time(10, 30), "Engineering", "Orion Room"),
            ("All Hands Â· The Next Chapter", 4, time(16, 0), "All Employees", "Town Hall"),
            ("Design Critique", 6, time(11, 30), "Design", "Studio 02"),
            ("People & Culture Forum", 9, time(15, 0), "All Employees", "Online"),
        ]
        for title, days, at, dept, location in meetings:
            Meeting.objects.get_or_create(title=title, date=date.today() + timedelta(days=days), defaults={"time": at, "department": dept, "location": location, "description": "A focused session for alignment, decisions, and next actions.", "created_by": admin})

        announcements = [
            ("Welcome to FLUMENX", "One place for our people, work, and shared momentum.", "Important"),
            ("Wellness Friday", "This Friday closes at 3 PM. Take the space to recharge.", "Normal"),
            ("Benefits enrollment", "Annual benefits enrollment is open through the end of this month.", "Urgent"),
        ]
        for title, message, priority in announcements:
            Announcement.objects.get_or_create(title=title, defaults={"message": message, "priority": priority, "created_by": admin})

        AttendancePolicy.current()
        today = date.today()
        attendance_patterns = [
            (time(9, 24), time(18, 38), "QR + Location"),
            (time(9, 32), time(18, 34), "QR + Location"),
            (time(9, 47), time(18, 42), "QR + Location"),
            (time(9, 28), time(18, 5), "QR + Location"),
            (time(9, 41), time(18, 12), "QR + Location"),
        ]
        working_days = []
        cursor = today.replace(day=1)
        while cursor <= today:
            if cursor.weekday() < 5:
                working_days.append(cursor)
            cursor += timedelta(days=1)
        for employee_index, employee in enumerate(employees):
            for day_index, attendance_day in enumerate(working_days):
                pattern = attendance_patterns[(day_index + employee_index) % len(attendance_patterns)]
                if (day_index + employee_index) % 13 == 0:
                    AttendanceRecord.objects.update_or_create(
                        employee=employee, attendance_date=attendance_day,
                        defaults={"attendance_status": "Leave", "notes": "Approved leave"}
                    )
                    continue
                check_in, check_out, source = pattern
                AttendanceRecord.objects.update_or_create(
                    employee=employee, attendance_date=attendance_day,
                    defaults={
                        "check_in_time": check_in, "check_out_time": check_out, "source": source,
                        "qr_reference": f"FLUMENX-HQ-{attendance_day:%Y%m%d}",
                        "latitude": "12.971599", "longitude": "77.594566",
                        "location_verified": True,
                    }
                )
        self.stdout.write(self.style.SUCCESS("FLUMENX demo data is ready."))

