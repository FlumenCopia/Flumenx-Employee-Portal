from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from portal.models import DynamicRole, Employee, PortalPage, RolePermission, UserRole


class SuperAdminPhase2APITests(APITestCase):
    def setUp(self):
        call_command("seed_rbac")

        # Create Super Admin User
        self.super_user = User.objects.create_superuser(username="superadmin@flumenx.com", email="superadmin@flumenx.com", password="Password123!")
        super_role = DynamicRole.objects.get(code="SUPER_ADMIN")
        UserRole.objects.create(user=self.super_user, role="SUPER_ADMIN", dynamic_role=super_role)

        # Create Admin User
        self.admin_user = User.objects.create_user(username="admin@flumenx.com", email="admin@flumenx.com", password="Password123!")
        admin_role = DynamicRole.objects.get(code="ADMIN")
        UserRole.objects.create(user=self.admin_user, role="ADMIN", dynamic_role=admin_role)

        # Create HR User
        self.hr_user = User.objects.create_user(username="hr@flumenx.com", email="hr@flumenx.com", password="Password123!")
        hr_role = DynamicRole.objects.get(code="HR")
        UserRole.objects.create(user=self.hr_user, role="HR", dynamic_role=hr_role)

        # Create Team Lead User
        self.tl_user = User.objects.create_user(username="tl@flumenx.com", email="tl@flumenx.com", password="Password123!")
        tl_role = DynamicRole.objects.get(code="TEAM_LEAD")
        UserRole.objects.create(user=self.tl_user, role="TEAM_LEAD", dynamic_role=tl_role)

        # Create Employee User
        self.emp_user = User.objects.create_user(username="emp@flumenx.com", email="emp@flumenx.com", password="Password123!")
        emp_role = DynamicRole.objects.get(code="EMPLOYEE")
        UserRole.objects.create(user=self.emp_user, role="EMPLOYEE", dynamic_role=emp_role)

    # 1. SECURITY TESTS (HTTP 403 Enforcement)
    def test_super_admin_security_enforcement(self):
        endpoints = [
            "/api/portal/pages/",
            "/api/portal/roles/",
            "/api/portal/super-admin/users/",
        ]
        non_super_users = [self.admin_user, self.hr_user, self.tl_user, self.emp_user]

        for u in non_super_users:
            self.client.force_authenticate(user=u)
            for ep in endpoints:
                res = self.client.get(ep)
                self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, f"User {u.username} should get 403 on {ep}")

        self.client.force_authenticate(user=self.super_user)
        for ep in endpoints:
            res = self.client.get(ep)
            self.assertEqual(res.status_code, status.HTTP_200_OK, f"Superuser should get 200 on {ep}")

    # 2. PAGE MANAGEMENT API TESTS
    def test_page_management_crud(self):
        self.client.force_authenticate(user=self.super_user)

        # Create custom page
        payload = {
            "title": "Custom Analytics",
            "route_path": "/admin/custom-analytics",
            "module_code": "CUSTOM_ANALYTICS",
            "icon": "BarChart",
            "sidebar_order": 20,
            "is_active": True,
        }
        res = self.client.post("/api/portal/pages/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        page_id = res.data["id"]

        # Duplicate route_path / module_code rejected
        res_dup = self.client.post("/api/portal/pages/", payload, format="json")
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Edit page
        edit_payload = {"title": "Updated Analytics", "sidebar_order": 21}
        res_edit = self.client.patch(f"/api/portal/pages/{page_id}/", edit_payload, format="json")
        self.assertEqual(res_edit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_edit.data["title"], "Updated Analytics")

        # System page deletion blocked
        sys_page = PortalPage.objects.get(module_code="TASKS")
        res_sys_del = self.client.delete(f"/api/portal/pages/{sys_page.id}/")
        self.assertEqual(res_sys_del.status_code, status.HTTP_400_BAD_REQUEST)

        # Custom page deletion allowed
        res_del = self.client.delete(f"/api/portal/pages/{page_id}/")
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)

    # 3. DYNAMIC ROLE API TESTS
    def test_dynamic_role_crud_and_safety(self):
        self.client.force_authenticate(user=self.super_user)

        # Create custom role
        payload = {
            "name": "Quality Specialist",
            "code": "QUALITY_SPECIALIST",
            "description": "Special quality review role",
            "is_superadmin_wildcard": False,
            "is_system_role": False,
        }
        res = self.client.post("/api/portal/roles/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        role_id = res.data["id"]

        # Duplicate code rejected
        res_dup = self.client.post("/api/portal/roles/", payload, format="json")
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # SUPER_ADMIN role deletion blocked
        sys_role = DynamicRole.objects.get(code="SUPER_ADMIN")
        res_sys_del = self.client.delete(f"/api/portal/roles/{sys_role.id}/")
        self.assertEqual(res_sys_del.status_code, status.HTTP_400_BAD_REQUEST)

        # Role assigned to user deletion now succeeds cleanly by reassigning affected users
        UserRole.objects.create(user=User.objects.create_user(username="temp_q", password="p"), role="EMPLOYEE", dynamic_role=DynamicRole.objects.get(id=role_id))
        res_assigned_del = self.client.delete(f"/api/portal/roles/{role_id}/")
        self.assertEqual(res_assigned_del.status_code, status.HTTP_204_NO_CONTENT)

    # 4. PERMISSION MATRIX API TESTS
    def test_role_permission_matrix(self):
        self.client.force_authenticate(user=self.super_user)

        role = DynamicRole.objects.create(name="Matrix Test Role", code="MATRIX_TEST")
        task_page = PortalPage.objects.get(module_code="TASKS")
        kpi_page = PortalPage.objects.get(module_code="KPI")

        # GET Matrix
        res_get = self.client.get(f"/api/portal/roles/{role.id}/permissions/")
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertIn("permissions", res_get.data)

        # PUT Matrix update
        matrix_payload = {
            "permissions": [
                {
                    "page_id": task_page.id,
                    "can_view": True,
                    "can_create": True,
                    "can_edit": False,
                    "can_delete": False,
                },
                {
                    "page_id": kpi_page.id,
                    "can_view": True,
                    "can_create": False,
                    "can_edit": False,
                    "can_delete": False,
                },
            ]
        }
        res_put = self.client.put(f"/api/portal/roles/{role.id}/permissions/", matrix_payload, format="json")
        self.assertEqual(res_put.status_code, status.HTTP_200_OK)

        # Verify DB persistence
        perm_task = RolePermission.objects.get(role=role, page=task_page)
        self.assertTrue(perm_task.can_view)
        self.assertTrue(perm_task.can_create)
        self.assertFalse(perm_task.can_edit)

        # Invalid page ID rejected
        res_inv = self.client.put(f"/api/portal/roles/{role.id}/permissions/", {"permissions": [{"page_id": 9999, "can_view": True}]}, format="json")
        self.assertEqual(res_inv.status_code, status.HTTP_400_BAD_REQUEST)

    # 5. SUPER ADMIN USER MANAGEMENT API TESTS
    def test_super_admin_user_management(self):
        self.client.force_authenticate(user=self.super_user)
        drole = DynamicRole.objects.get(code="HR")

        # Create user
        user_payload = {
            "full_name": "Test User Management",
            "work_email": "new.manage.user@flumenx.com",
            "initial_password": "NewUserPass123!",
            "designation": "HR Generalist",
            "department": "HR",
            "dynamic_role_id": drole.id,
        }
        res_create = self.client.post("/api/portal/super-admin/users/", user_payload, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        created_user_id = res_create.data["user_id"]

        # Password works immediately
        new_user = User.objects.get(id=created_user_id)
        self.assertTrue(new_user.check_password("NewUserPass123!"))

        # Duplicate email rejected
        res_dup = self.client.post("/api/portal/super-admin/users/", user_payload, format="json")
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Password reset by Super Admin
        res_pass = self.client.post(f"/api/portal/super-admin/users/{created_user_id}/password/", {"password": "ResetPassword999!"}, format="json")
        self.assertEqual(res_pass.status_code, status.HTTP_200_OK)
        new_user.refresh_from_db()
        self.assertTrue(new_user.check_password("ResetPassword999!"))

        # Deactivate user
        res_del = self.client.delete(f"/api/portal/super-admin/users/{created_user_id}/")
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        new_user.refresh_from_db()
        self.assertFalse(new_user.is_active)

    # 6. DYNAMIC NAVIGATION API TESTS
    def test_dynamic_navigation_me(self):
        # Super Admin gets all active pages
        self.client.force_authenticate(user=self.super_user)
        res_super = self.client.get("/api/portal/navigation/me/")
        self.assertEqual(res_super.status_code, status.HTTP_200_OK)
        total_active_pages = PortalPage.objects.filter(is_active=True).count()
        self.assertEqual(len(res_super.data), total_active_pages)

        # Dynamic role user gets permitted pages
        custom_role = DynamicRole.objects.create(name="Nav Test Role", code="NAV_TEST")
        page_task = PortalPage.objects.get(module_code="TASKS")
        RolePermission.objects.create(role=custom_role, page=page_task, can_view=True)

        nav_user = User.objects.create_user(username="navuser@flumenx.com", password="p")
        UserRole.objects.create(user=nav_user, role="EMPLOYEE", dynamic_role=custom_role)

        self.client.force_authenticate(user=nav_user)
        res_nav = self.client.get("/api/portal/navigation/me/")
        self.assertEqual(res_nav.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_nav.data), 1)
        self.assertEqual(res_nav.data[0]["module_code"], "TASKS")

        # Legacy user without dynamic role gets safe fallback
        legacy_user = User.objects.create_user(username="legacy_nav@flumenx.com", password="p")
        UserRole.objects.create(user=legacy_user, role="HR", dynamic_role=None)
        self.client.force_authenticate(user=legacy_user)
        res_legacy = self.client.get("/api/portal/navigation/me/")
        self.assertEqual(res_legacy.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_legacy.data) > 0)
