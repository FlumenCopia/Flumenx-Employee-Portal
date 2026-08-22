from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from portal.models import Employee, DynamicRole, UserRole, Department
import os

class Command(BaseCommand):
    help = "Seeds dummy login accounts and employee profiles for all portal roles."

    def handle(self, *args, **options):
        self.stdout.write("Seeding dummy login accounts and employee profiles...")

        # Standard password for all dummy test accounts: password123
        DEFAULT_PASS = "password123"

        accounts = [
            {
                "username": "admin@flumenx.com",
                "email": "admin@flumenx.com",
                "password": DEFAULT_PASS,
                "first_name": "Alex",
                "last_name": "Smith",
                "role_code": "ADMIN",
                "emp_code": "EMP-1001",
                "department": "Operations",
                "designation": "System Administrator",
                "phone": "+91 9876543210",
                "location": "Kochi",
            },
            {
                "username": "hr@flumenx.com",
                "email": "hr@flumenx.com",
                "password": DEFAULT_PASS,
                "first_name": "Sarah",
                "last_name": "Connor",
                "role_code": "HR",
                "emp_code": "EMP-1002",
                "department": "HR",
                "designation": "HR Manager",
                "phone": "+91 9876543211",
                "location": "Kochi",
            },
            {
                "username": "accountant@flumenx.com",
                "email": "accountant@flumenx.com",
                "password": DEFAULT_PASS,
                "first_name": "Bob",
                "last_name": "Vance",
                "role_code": "ACCOUNTANT",
                "emp_code": "EMP-1003",
                "department": "Accountant",
                "designation": "Senior Accountant",
                "phone": "+91 9876543212",
                "location": "Kochi",
            },
            {
                "username": "opshead@flumenx.com",
                "email": "opshead@flumenx.com",
                "password": DEFAULT_PASS,
                "first_name": "Elena",
                "last_name": "Rostova",
                "role_code": "OPERATIONS_HEAD",
                "emp_code": "EMP-1004",
                "department": "Operations",
                "designation": "Head of Operations",
                "phone": "+91 9876543213",
                "location": "Kochi",
            },
            {
                "username": "ops@flumenx.com",
                "email": "ops@flumenx.com",
                "password": DEFAULT_PASS,
                "first_name": "John",
                "last_name": "Wick",
                "role_code": "OPERATIONS",
                "emp_code": "EMP-1005",
                "department": "Operations",
                "designation": "Operations Specialist",
                "phone": "+91 9876543214",
                "location": "Kochi",
            },
            {
                "username": "teamlead@flumenx.com",
                "email": "teamlead@flumenx.com",
                "password": DEFAULT_PASS,
                "first_name": "David",
                "last_name": "Miller",
                "role_code": "TEAM_LEAD",
                "emp_code": "EMP-1006",
                "department": "Web Development",
                "designation": "Tech Lead / Lead Engineer",
                "phone": "+91 9876543215",
                "location": "Kochi",
            },
            {
                "username": "bde@flumenx.com",
                "email": "bde@flumenx.com",
                "password": DEFAULT_PASS,
                "first_name": "Alice",
                "last_name": "Young",
                "role_code": "BDE",
                "emp_code": "EMP-1007",
                "department": "Digital Marketing",
                "designation": "Business Development Executive",
                "phone": "+91 9876543216",
                "location": "Kochi",
            },
            {
                "username": "employee@flumenx.com",
                "email": "employee@flumenx.com",
                "password": DEFAULT_PASS,
                "first_name": "Peter",
                "last_name": "Parker",
                "role_code": "EMPLOYEE",
                "emp_code": "EMP-1008",
                "department": "Web Development",
                "designation": "Frontend Developer",
                "phone": "+91 9876543217",
                "location": "Kochi",
            },
            {
                "username": "employee2@flumenx.com",
                "email": "employee2@flumenx.com",
                "password": DEFAULT_PASS,
                "first_name": "Mary",
                "last_name": "Jane",
                "role_code": "EMPLOYEE",
                "emp_code": "EMP-1009",
                "department": "Video Editing",
                "designation": "Video Editor",
                "phone": "+91 9876543218",
                "location": "Kochi",
            },
        ]

        with transaction.atomic():
            # 1. Ensure Super Admin account exists & linked
            sa_email = os.getenv("PERMANENT_SUPERADMIN_EMAIL", "anoop@flumenx.com")
            sa_pass = os.getenv("PERMANENT_SUPERADMIN_PASSWORD", "anoop@flumenx.com")
            sa_user = User.objects.filter(email__iexact=sa_email).first() or User.objects.filter(username__iexact=sa_email).first()
            if not sa_user:
                sa_user = User.objects.create(
                    username=sa_email,
                    email=sa_email,
                    first_name="Anoop",
                    last_name="(Super Admin)",
                    is_staff=True,
                    is_superuser=True,
                    is_active=True,
                )
            sa_user.set_password(sa_pass)
            sa_user.is_staff = True
            sa_user.is_superuser = True
            sa_user.is_active = True
            sa_user.save()

            sa_drole = DynamicRole.objects.filter(code="SUPER_ADMIN").first()
            if sa_drole:
                UserRole.objects.update_or_create(
                    user=sa_user,
                    defaults={"role": "SUPER_ADMIN", "dynamic_role": sa_drole}
                )

            sa_dept = Department.objects.filter(code="OPERATIONS").first() or Department.objects.first()
            Employee.objects.update_or_create(
                email=sa_email,
                defaults={
                    "user": sa_user,
                    "employee_code": "EMP-0001",
                    "name": "Anoop (Super Admin)",
                    "phone": "+91 9999999999",
                    "department": sa_dept.name if sa_dept else "Operations",
                    "department_ref": sa_dept,
                    "designation": "Super Admin / Director",
                    "joining_date": "2023-01-01",
                    "status": "Active",
                    "location": "Kochi",
                }
            )

            # 2. Seed dummy accounts
            for acc in accounts:
                user = User.objects.filter(email__iexact=acc["email"]).first() or User.objects.filter(username__iexact=acc["username"]).first()
                if not user:
                    user = User.objects.create(
                        username=acc["username"],
                        email=acc["email"],
                        first_name=acc["first_name"],
                        last_name=acc["last_name"],
                        is_active=True,
                    )
                else:
                    user.first_name = acc["first_name"]
                    user.last_name = acc["last_name"]
                    user.email = acc["email"]
                    user.is_active = True
                
                user.set_password(acc["password"])
                user.save()

                drole = DynamicRole.objects.filter(code=acc["role_code"]).first()
                UserRole.objects.update_or_create(
                    user=user,
                    defaults={
                        "role": acc["role_code"],
                        "dynamic_role": drole,
                    }
                )

                dept_obj = Department.objects.filter(name__iexact=acc["department"]).first() or Department.objects.filter(code=acc["department"].upper()).first()
                if not dept_obj:
                    dept_obj, _ = Department.objects.get_or_create(
                        code=acc["department"].upper().replace(" ", "_"),
                        defaults={"name": acc["department"], "display_order": 10, "is_active": True}
                    )

                Employee.objects.update_or_create(
                    email=acc["email"],
                    defaults={
                        "user": user,
                        "employee_code": acc["emp_code"],
                        "name": f"{acc['first_name']} {acc['last_name']}",
                        "phone": acc["phone"],
                        "department": dept_obj.name,
                        "department_ref": dept_obj,
                        "designation": acc["designation"],
                        "joining_date": "2024-01-15",
                        "status": "Active",
                        "location": acc["location"],
                    }
                )
                self.stdout.write(f"Account Ready: {acc['email']} ({acc['role_code']}) | Password: {acc['password']}")

        self.stdout.write(self.style.SUCCESS("All dummy login accounts successfully seeded with password123!"))
