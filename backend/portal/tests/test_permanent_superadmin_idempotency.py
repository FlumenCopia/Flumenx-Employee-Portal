import os
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APITestCase

from portal.models import DynamicRole, Employee, UserRole


class PermanentSuperAdminIdempotencyTests(APITestCase):
    def setUp(self):
        call_command("seed_rbac")

    def test_command_idempotency_and_environment_variable_password(self):
        # Initial run
        with patch.dict(os.environ, {"PERMANENT_SUPERADMIN_PASSWORD": "EnvPassword123!"}):
            call_command("ensure_permanent_superadmin")

        users = User.objects.filter(email="anoop@flumenx.com")
        self.assertEqual(users.count(), 1)
        sa_user = users.first()
        self.assertTrue(sa_user.check_password("EnvPassword123!"))
        self.assertTrue(sa_user.is_superuser)
        self.assertTrue(sa_user.is_staff)
        self.assertTrue(sa_user.is_active)

        # Re-run to verify idempotency (no duplicate accounts created)
        with patch.dict(os.environ, {"PERMANENT_SUPERADMIN_PASSWORD": "EnvPassword123!"}):
            call_command("ensure_permanent_superadmin")

        self.assertEqual(User.objects.filter(email="anoop@flumenx.com").count(), 1)

        # Check attached role and employee profile
        profile = getattr(sa_user, "portal_profile", None)
        self.assertIsNotNone(profile)
        self.assertEqual(profile.role, "SUPER_ADMIN")

        emp = Employee.objects.filter(user=sa_user).first()
        self.assertIsNotNone(emp)
        self.assertEqual(emp.status, "Active")
