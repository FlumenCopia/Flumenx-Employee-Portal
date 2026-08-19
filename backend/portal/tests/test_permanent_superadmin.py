from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from portal.models import DynamicRole, Employee, UserRole


class PermanentSuperAdminTests(APITestCase):
    def setUp(self):
        call_command("seed_rbac")
        self.superadmin = User.objects.get(email="anoop@flumenx.com")
        self.client.force_authenticate(user=self.superadmin)

        # Create a standard target user to test normal deletion
        self.target_user = User.objects.create_user(
            username="normaluser@flumenx.com",
            email="normaluser@flumenx.com",
            password="Password123!",
        )
        emp_role = DynamicRole.objects.get(code="EMPLOYEE")
        UserRole.objects.create(user=self.target_user, role="EMPLOYEE", dynamic_role=emp_role)

    def test_permanent_superadmin_deletion_rejected(self):
        sa_role = DynamicRole.objects.get(code="SUPER_ADMIN")
        other_admin = User.objects.create_user(username="otheradmin", email="otheradmin@flumenx.com", password="Pass@1234!", is_superuser=True)
        UserRole.objects.create(user=other_admin, role="SUPER_ADMIN", dynamic_role=sa_role)
        self.client.force_authenticate(user=other_admin)

        res = self.client.delete(f"/api/portal/super-admin/users/{self.superadmin.id}/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be deleted", res.data.get("detail", ""))
        self.assertTrue(User.objects.filter(id=self.superadmin.id).exists())

        emp = Employee.objects.filter(user=self.superadmin).first()
        if not emp:
            from datetime import date
            emp = Employee.objects.create(
                user=self.superadmin,
                employee_code="EMP-SA-TEST",
                name="Anoop Krishna",
                email="anoop@flumenx.com",
                phone="9999999999",
                department="Operations",
                designation="Super Admin",
                joining_date=date(2025, 1, 1),
                status="Active",
            )

        res_emp = self.client.delete(f"/api/employees/{emp.id}/")
        self.assertEqual(res_emp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be deleted", res_emp.data.get("detail", ""))

    def test_permanent_superadmin_deactivation_and_role_demotion_rejected(self):
        emp_role = DynamicRole.objects.get(code="EMPLOYEE")

        # Attempt to deactivate permanent superadmin
        res_deact = self.client.patch(
            f"/api/portal/super-admin/users/{self.superadmin.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res_deact.status_code, status.HTTP_400_BAD_REQUEST)

        # Attempt to demote permanent superadmin to EMPLOYEE
        res_demote = self.client.patch(
            f"/api/portal/super-admin/users/{self.superadmin.id}/",
            {"dynamic_role_id": emp_role.id},
            format="json",
        )
        self.assertEqual(res_demote.status_code, status.HTTP_400_BAD_REQUEST)

    def test_normal_user_deletion_remains_functional(self):
        res = self.client.delete(f"/api/portal/super-admin/users/{self.target_user.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.filter(id=self.target_user.id).exists())

    def test_idempotent_management_command(self):
        call_command("ensure_permanent_superadmin")
        self.assertEqual(User.objects.filter(email="anoop@flumenx.com").count(), 1)
        sa = User.objects.get(email="anoop@flumenx.com")
        self.assertTrue(sa.is_superuser)
        self.assertTrue(sa.is_staff)
        self.assertTrue(sa.is_active)
