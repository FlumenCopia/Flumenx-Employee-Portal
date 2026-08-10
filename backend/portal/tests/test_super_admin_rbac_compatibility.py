from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from portal.models import DynamicRole, PortalPage, RolePermission, UserRole
from portal.permissions import IsSuperAdmin, portal_role


class SuperAdminRBACCompatibilityTests(TestCase):
    def setUp(self):
        call_command("seed_rbac")

        # Create standard legacy users with UserRole
        self.admin_user = User.objects.create_user(username="test_admin", password="password123")
        self.admin_role = UserRole.objects.create(user=self.admin_user, role="ADMIN")

        self.hr_user = User.objects.create_user(username="test_hr", password="password123")
        self.hr_role = UserRole.objects.create(user=self.hr_user, role="HR")

        self.employee_user = User.objects.create_user(username="test_emp", password="password123")
        self.employee_role = UserRole.objects.create(user=self.employee_user, role="EMPLOYEE")

        self.superuser = User.objects.create_superuser(username="test_super", email="super@example.com", password="password123")

    def test_existing_admin_resolves_correctly(self):
        self.assertEqual(portal_role(self.admin_user), "ADMIN")

    def test_existing_hr_resolves_correctly(self):
        self.assertEqual(portal_role(self.hr_user), "HR")

    def test_existing_employee_resolves_correctly(self):
        self.assertEqual(portal_role(self.employee_user), "EMPLOYEE")

    def test_superuser_resolves_to_super_admin(self):
        self.assertEqual(portal_role(self.superuser), "SUPER_ADMIN")

    def test_existing_userrole_rows_remain_valid(self):
        self.assertEqual(self.admin_role.role, "ADMIN")
        self.assertEqual(self.hr_role.role, "HR")
        self.assertEqual(self.employee_role.role, "EMPLOYEE")

    def test_seed_can_run_twice_safely_and_is_idempotent(self):
        role_count_1 = DynamicRole.objects.count()
        page_count_1 = PortalPage.objects.count()
        permission_count_1 = RolePermission.objects.count()

        # Run seed again
        call_command("seed_rbac")

        self.assertEqual(DynamicRole.objects.count(), role_count_1)
        self.assertEqual(PortalPage.objects.count(), page_count_1)
        self.assertEqual(RolePermission.objects.count(), permission_count_1)

    def test_missing_dynamic_role_does_not_break_legacy_users(self):
        legacy_user = User.objects.create_user(username="legacy_user", password="password123")
        legacy_role = UserRole.objects.create(user=legacy_user, role="ACCOUNTANT", dynamic_role=None)

        self.assertIsNone(legacy_role.dynamic_role)
        self.assertEqual(portal_role(legacy_user), "ACCOUNTANT")

    def test_super_admin_permission_class(self):
        perm = IsSuperAdmin()

        class DummyRequest:
            def __init__(self, user):
                self.user = user

        self.assertTrue(perm.has_permission(DummyRequest(self.superuser), None))
        self.assertFalse(perm.has_permission(DummyRequest(self.admin_user), None))
        self.assertFalse(perm.has_permission(DummyRequest(self.hr_user), None))
        self.assertFalse(perm.has_permission(DummyRequest(self.employee_user), None))
