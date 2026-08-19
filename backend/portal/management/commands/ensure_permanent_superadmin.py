import logging
import os
from datetime import date
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from portal.models import Department, DynamicRole, Employee, UserRole

logger = logging.getLogger(__name__)

PERMANENT_SUPERADMIN_EMAIL = os.getenv("PERMANENT_SUPERADMIN_EMAIL", "anoop@flumenx.com").strip().lower()
PERMANENT_SUPERADMIN_USERNAME = PERMANENT_SUPERADMIN_EMAIL


def run_ensure_permanent_superadmin(stdout=None, style=None, password_override=None):
    """
    Idempotent helper function to ensure exactly one protected Super Admin account
    exists for anoop@flumenx.com.
    """
    with transaction.atomic():
        super_role, _ = DynamicRole.objects.get_or_create(
            code="SUPER_ADMIN",
            defaults={
                "name": "Super Admin",
                "description": "System Administrator with full wildcard access",
                "is_superadmin_wildcard": True,
                "is_system_role": True,
            },
        )

        all_matches = list(
            User.objects.filter(
                Q(email__iexact=PERMANENT_SUPERADMIN_EMAIL)
                | Q(username__iexact=PERMANENT_SUPERADMIN_USERNAME)
                | Q(username__iexact="anoop")
            ).order_by("-is_superuser", "-is_active", "id").distinct()
        )

        if all_matches:
            user = all_matches[0]
            # Clean up duplicate accounts if any exist
            for dup in all_matches[1:]:
                try:
                    UserRole.objects.filter(user=dup).delete()
                    Employee.objects.filter(user=dup).update(user=None)
                    dup.delete()
                except Exception as exc:
                    logger.warning("Could not delete duplicate superadmin user %s: %s", dup.id, exc)
            created = False
        else:
            user = User(
                username=PERMANENT_SUPERADMIN_USERNAME,
                email=PERMANENT_SUPERADMIN_EMAIL,
                first_name="Anoop",
                last_name="Krishna",
            )
            created = True

        user.username = PERMANENT_SUPERADMIN_USERNAME
        user.email = PERMANENT_SUPERADMIN_EMAIL
        user.is_superuser = True
        user.is_staff = True
        user.is_active = True
        user.save()

        raw_password = password_override or os.getenv("PERMANENT_SUPERADMIN_PASSWORD")
        if raw_password:
            user.set_password(raw_password)
            user.save()
        elif created or not user.has_usable_password():
            user.set_password("FlumenxSuperAdmin2026!")
            user.save()

        user_role, _ = UserRole.objects.get_or_create(
            user=user,
            defaults={"role": "SUPER_ADMIN", "dynamic_role": super_role},
        )
        if user_role.role != "SUPER_ADMIN" or user_role.dynamic_role != super_role:
            user_role.role = "SUPER_ADMIN"
            user_role.dynamic_role = super_role
            user_role.save()

        emp = (
            Employee.objects.filter(user=user).first()
            or Employee.objects.filter(email__iexact=PERMANENT_SUPERADMIN_EMAIL).first()
        )
        if not emp:
            emp_code = "EMP-0001" if not Employee.objects.filter(employee_code="EMP-0001").exists() else f"EMP-SA-{user.id}"
            emp = Employee.objects.create(
                user=user,
                employee_code=emp_code,
                name="Anoop Krishna",
                email=PERMANENT_SUPERADMIN_EMAIL,
                phone="9999999999",
                department="Operations",
                designation="Super Admin",
                joining_date=date(2025, 1, 1),
                status="Active",
            )
        else:
            emp.user = user
            if not emp.name:
                emp.name = "Anoop Krishna"
            emp.email = PERMANENT_SUPERADMIN_EMAIL
            emp.status = "Active"
            emp.save()

        if stdout and style:
            msg = f"Successfully {'created' if created else 'verified & updated'} permanent Super Admin account ({PERMANENT_SUPERADMIN_EMAIL})."
            stdout.write(style.SUCCESS(msg))

        return user


class Command(BaseCommand):
    help = "Ensure permanent protected Super Admin account exists for anoop@flumenx.com (Idempotent)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            type=str,
            help="Optional explicit password to set for anoop@flumenx.com",
            default=None,
        )

    def handle(self, *args, **options):
        self.stdout.write(f"Ensuring permanent Super Admin account ({PERMANENT_SUPERADMIN_EMAIL})...")
        run_ensure_permanent_superadmin(
            stdout=self.stdout,
            style=self.style,
            password_override=options.get("password"),
        )
