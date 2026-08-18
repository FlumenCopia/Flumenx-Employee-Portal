from datetime import date
from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from portal.models import Department, DynamicRole, Employee, PortalPage, RolePermission, UserRole
from portal.permissions import has_page_permission
from portal.serializer_modules.employees import EmployeeSerializer


class MultiUserDynamicRolesTestCase(APITestCase):
    def setUp(self):
        self.super_user = User.objects.create_superuser("admin_boss", "boss@flumenx.com", "pass123")
        self.super_role, _ = DynamicRole.objects.get_or_create(
            code="SUPER_ADMIN",
            defaults={"name": "Super Admin", "is_superadmin_wildcard": True, "is_system_role": True}
        )
        UserRole.objects.create(user=self.super_user, role="SUPER_ADMIN", dynamic_role=self.super_role)

        self.dept_dev, _ = Department.objects.get_or_create(name="Development", defaults={"code": "DEVELOPMENT", "display_order": 1})
        self.dept_hr, _ = Department.objects.get_or_create(name="Human Resources", defaults={"code": "HR_DEPT", "display_order": 2})

        self.page_tasks, _ = PortalPage.objects.get_or_create(
            module_code="TASKS",
            defaults={"title": "Task Board", "route_path": "/work?view=kanban", "sidebar_order": 2, "is_active": True}
        )
        self.page_leaves, _ = PortalPage.objects.get_or_create(
            module_code="LEAVES",
            defaults={"title": "Leave Requests", "route_path": "/leaves", "sidebar_order": 3, "is_active": True}
        )

    def test_multi_user_dynamic_role_sharing(self):
        """Verify multiple users can share the exact same DynamicRole record across all roles."""
        # 1. Create standard dynamic roles
        designer_role, created = DynamicRole.objects.get_or_create(
            code="DESIGNER",
            defaults={"name": "Designer", "description": "Design Team"}
        )
        hr_role, _ = DynamicRole.objects.get_or_create(
            code="HR",
            defaults={"name": "Human Resources", "description": "HR Team"}
        )
        web_dev_role, _ = DynamicRole.objects.get_or_create(
            code="WEB_DEVELOPER",
            defaults={"name": "Web Developer", "description": "Development Team"}
        )
        motion_role, _ = DynamicRole.objects.get_or_create(
            code="MOTION_DESIGNER",
            defaults={"name": "Motion Designer", "description": "Custom Motion Role"}
        )

        initial_role_count = DynamicRole.objects.count()

        # 2. Assign 2 Designers to DESIGNER
        des_1 = User.objects.create_user("sreejith", "sreejith@flumenx.com", "pass123")
        des_2 = User.objects.create_user("eby", "eby@flumenx.com", "pass123")
        UserRole.objects.create(user=des_1, role="EMPLOYEE", dynamic_role=designer_role)
        UserRole.objects.create(user=des_2, role="EMPLOYEE", dynamic_role=designer_role)

        # 3. Assign 2 HR users to HR
        hr_1 = User.objects.create_user("hr1", "hr1@flumenx.com", "pass123")
        hr_2 = User.objects.create_user("hr2", "hr2@flumenx.com", "pass123")
        UserRole.objects.create(user=hr_1, role="HR", dynamic_role=hr_role)
        UserRole.objects.create(user=hr_2, role="HR", dynamic_role=hr_role)

        # 4. Assign 2 Web Developers to WEB_DEVELOPER
        dev_1 = User.objects.create_user("devA", "deva@flumenx.com", "pass123")
        dev_2 = User.objects.create_user("devB", "devb@flumenx.com", "pass123")
        UserRole.objects.create(user=dev_1, role="EMPLOYEE", dynamic_role=web_dev_role)
        UserRole.objects.create(user=dev_2, role="EMPLOYEE", dynamic_role=web_dev_role)

        # 5. Assign 3 users to Custom MOTION_DESIGNER role
        m_1 = User.objects.create_user("motion1", "m1@flumenx.com", "pass123")
        m_2 = User.objects.create_user("motion2", "m2@flumenx.com", "pass123")
        m_3 = User.objects.create_user("motion3", "m3@flumenx.com", "pass123")
        UserRole.objects.create(user=m_1, role="EMPLOYEE", dynamic_role=motion_role)
        UserRole.objects.create(user=m_2, role="EMPLOYEE", dynamic_role=motion_role)
        UserRole.objects.create(user=m_3, role="EMPLOYEE", dynamic_role=motion_role)

        # Assert no extra DynamicRole records were created
        self.assertEqual(DynamicRole.objects.count(), initial_role_count)
        self.assertEqual(DynamicRole.objects.filter(code="DESIGNER").count(), 1)
        self.assertEqual(DynamicRole.objects.filter(code="HR").count(), 1)
        self.assertEqual(DynamicRole.objects.filter(code="WEB_DEVELOPER").count(), 1)
        self.assertEqual(DynamicRole.objects.filter(code="MOTION_DESIGNER").count(), 1)

        # Assert assigned users count
        self.assertEqual(designer_role.user_roles.count(), 2)
        self.assertEqual(hr_role.user_roles.count(), 2)
        self.assertEqual(web_dev_role.user_roles.count(), 2)
        self.assertEqual(motion_role.user_roles.count(), 3)

        # Assert user list members match exactly
        self.assertCountEqual(
            list(designer_role.user_roles.values_list("user__username", flat=True)),
            ["sreejith", "eby"]
        )
        self.assertCountEqual(
            list(motion_role.user_roles.values_list("user__username", flat=True)),
            ["motion1", "motion2", "motion3"]
        )

    def test_role_permission_inheritance_across_all_assigned_users(self):
        """Verify modifying permissions on a DynamicRole instantly affects every assigned user."""
        designer_role, _ = DynamicRole.objects.get_or_create(
            code="DESIGNER",
            defaults={"name": "Designer"}
        )

        u1 = User.objects.create_user("des_u1", "d1@flumenx.com", "pass123")
        u2 = User.objects.create_user("des_u2", "d2@flumenx.com", "pass123")
        UserRole.objects.create(user=u1, role="EMPLOYEE", dynamic_role=designer_role)
        UserRole.objects.create(user=u2, role="EMPLOYEE", dynamic_role=designer_role)

        # Initially no permission
        self.assertFalse(has_page_permission(u1, "TASKS", "view"))
        self.assertFalse(has_page_permission(u2, "TASKS", "view"))

        # Grant TASKS view permission to DESIGNER role once
        RolePermission.objects.create(
            role=designer_role,
            page=self.page_tasks,
            can_view=True,
            can_create=True,
            can_edit=False,
            can_delete=False
        )

        # Both assigned users inherit permission automatically
        self.assertTrue(has_page_permission(u1, "TASKS", "view"))
        self.assertTrue(has_page_permission(u2, "TASKS", "view"))

    def test_employee_serializer_dynamic_role_assignment_and_reassignment(self):
        """Verify EmployeeSerializer accepts dynamic_role_id and re-assigns roles without creating duplicates."""
        role_dev, _ = DynamicRole.objects.get_or_create(code="WEB_DEVELOPER", defaults={"name": "Web Developer"})
        role_hr, _ = DynamicRole.objects.get_or_create(code="HR", defaults={"name": "Human Resources"})

        initial_count = DynamicRole.objects.count()

        # Onboard new employee with WEB_DEVELOPER dynamic_role_id
        payload = {
            "name": "Nidhin K G",
            "email": "nidhin@flumenx.com",
            "employee_code": "EMP999",
            "phone": "9876543210",
            "department": "Web Development",
            "designation": "Web Developer",
            "joining_date": "2026-01-01",
            "password": "Password123!",
            "dynamic_role_id": role_dev.id,
            "portal_role": "EMPLOYEE",
        }
        self.client.force_authenticate(user=self.super_user)
        res = self.client.post("/api/employees/", data=payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)

        emp = Employee.objects.get(id=res.data["id"])
        self.assertEqual(emp.user.portal_profile.dynamic_role_id, role_dev.id)
        self.assertEqual(DynamicRole.objects.count(), initial_count)

        # Switch employee's role to HR via PATCH
        patch_res = self.client.patch(f"/api/employees/{emp.id}/", data={"dynamic_role_id": role_hr.id}, format="json")
        self.assertEqual(patch_res.status_code, 200)

        emp.user.portal_profile.refresh_from_db()
        self.assertEqual(emp.user.portal_profile.dynamic_role_id, role_hr.id)
        # Assert still no duplicate roles created
        self.assertEqual(DynamicRole.objects.count(), initial_count)
