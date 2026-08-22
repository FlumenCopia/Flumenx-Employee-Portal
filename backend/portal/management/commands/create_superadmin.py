from datetime import date
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from portal.models import DynamicRole, Employee, UserRole


class Command(BaseCommand):
    help = "Creates or updates the superadmin user"

    def handle(self, *args, **options):
        email = "flumenx@gmail.com"
        password = "flumenx@gmail.com"

        user = User.objects.filter(username=email).first() or User.objects.filter(email=email).first()
        if not user:
            user = User.objects.create_user(username=email, email=email, password=password)
        else:
            user.email = email
            user.set_password(password)

        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.save()

        dyn_role = DynamicRole.objects.filter(code="SUPER_ADMIN").first() or DynamicRole.objects.filter(is_superadmin_wildcard=True).first()

        role, _ = UserRole.objects.get_or_create(user=user)
        role.role = "SUPER_ADMIN"
        if dyn_role:
            role.dynamic_role = dyn_role
        role.save()

        emp = Employee.objects.filter(user=user).first() or Employee.objects.filter(email=email).first()
        if not emp:
            Employee.objects.create(
                user=user,
                employee_code="FLX-SA01",
                name="Super Admin",
                email=email,
                phone="9999999999",
                department="Management",
                designation="Super Admin",
                joining_date=date.today(),
                status="Active",
            )
        else:
            emp.user = user
            emp.name = "Super Admin"
            emp.email = email
            emp.status = "Active"
        from portal.models import AttendancePolicy
        policy = AttendancePolicy.current()
        policy.office_latitude = "8.521310"
        policy.office_longitude = "76.978630"
        policy.allowed_radius_meters = 200
        policy.save()

        self.stdout.write(self.style.SUCCESS(f"Superadmin {email} created/updated successfully! Office policy updated to Flumenx HQ (8.521310, 76.978630)."))
