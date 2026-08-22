from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.models import User
from portal.models import (
    Employee,
    DynamicRole,
    UserRole,
    AttendanceRecord,
    AttendanceCorrection,
    WorkAssignment,
    WorkDeliverable,
    ClientWorkShareLink,
    LeaveRequest,
    SalarySlip,
    RolePermission,
    EmployeeKPIRating,
    Meeting,
    Announcement,
    Notification,
)


class Command(BaseCommand):
    help = "Resets the portal database: removes all users/employees except Super Admin (flumenx@gmail.com) and cleans up custom dynamic roles."

    def handle(self, *args, **options):
        super_admin_email = "flumenx@gmail.com"

        with transaction.atomic():
            self.stdout.write("Starting database cleanup...")

            # 1. Fetch Super Admin User & Employee
            sa_user = User.objects.filter(email=super_admin_email).first()
            if not sa_user:
                sa_user = User.objects.filter(username=super_admin_email).first()

            sa_employee = Employee.objects.filter(email=super_admin_email).first()

            # 2. Delete operational data
            AttendanceCorrection.objects.all().delete()
            AttendanceRecord.objects.all().delete()
            ClientWorkShareLink.objects.all().delete()
            WorkDeliverable.objects.all().delete()
            WorkAssignment.objects.all().delete()
            LeaveRequest.objects.all().delete()
            SalarySlip.objects.all().delete()
            EmployeeKPIRating.objects.all().delete()
            Meeting.objects.all().delete()
            Announcement.objects.all().delete()
            Notification.objects.all().delete()

            # 3. Delete non-Super Admin employees
            non_sa_emps = Employee.objects.exclude(email=super_admin_email)
            emp_count = non_sa_emps.count()
            non_sa_emps.delete()
            self.stdout.write(f"Removed {emp_count} non-superadmin employee profiles.")

            # 4. Delete non-Super Admin users
            non_sa_users = User.objects.exclude(email=super_admin_email)
            user_count = non_sa_users.count()
            non_sa_users.delete()
            self.stdout.write(f"Removed {user_count} non-superadmin user accounts.")

            # 5. Remove non-Super Admin roles & permissions
            non_sa_roles = DynamicRole.objects.exclude(code="SUPER_ADMIN")
            role_count = non_sa_roles.count()
            
            # Delete permissions attached to non-sa roles
            RolePermission.objects.filter(role__in=non_sa_roles).delete()
            UserRole.objects.filter(dynamic_role__in=non_sa_roles).delete()
            non_sa_roles.delete()
            self.stdout.write(f"Removed {role_count} non-superadmin roles.")

            # 6. Ensure Super Admin is linked to SUPER_ADMIN DynamicRole
            if sa_user:
                super_admin_role = DynamicRole.objects.filter(code="SUPER_ADMIN").first()
                if super_admin_role:
                    UserRole.objects.filter(user=sa_user).delete()
                    UserRole.objects.create(
                        user=sa_user,
                        role="SUPER_ADMIN",
                        dynamic_role=super_admin_role
                    )
                    self.stdout.write("Ensured Super Admin is linked to SUPER_ADMIN role.")

            self.stdout.write(self.style.SUCCESS("Database reset successfully! Only Super Admin remains."))
