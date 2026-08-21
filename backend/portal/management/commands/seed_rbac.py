from django.core.management.base import BaseCommand
from django.db import connection, transaction
from portal.models import Department, DynamicRole, PortalPage, RolePermission, UserRole


class Command(BaseCommand):
    help = "Seed initial RBAC models (PortalPage, DynamicRole, RolePermission) and link existing UserRoles."

    def handle(self, *args, **options):
        self.stdout.write("Seeding RBAC models...")
        with transaction.atomic():
            roles_data = [
                {
                    "code": "SUPER_ADMIN",
                    "name": "Super Admin",
                    "description": "System Administrator with full wildcard access",
                    "is_superadmin_wildcard": True,
                    "is_system_role": True,
                },
                {
                    "code": "ADMIN",
                    "name": "Administrator",
                    "description": "Full portal management access",
                    "is_superadmin_wildcard": False,
                    "is_system_role": True,
                },
                {
                    "code": "HR",
                    "name": "Human Resources",
                    "description": "Employee, recruitment, attendance, and leave management",
                    "is_superadmin_wildcard": False,
                    "is_system_role": True,
                },
                {
                    "code": "ACCOUNTANT",
                    "name": "Accountant",
                    "description": "Financial, salary slip, and attendance view access",
                    "is_superadmin_wildcard": False,
                    "is_system_role": True,
                },
                {
                    "code": "BDE",
                    "name": "Business Development",
                    "description": "Client & task management access",
                    "is_superadmin_wildcard": False,
                    "is_system_role": True,
                },
                {
                    "code": "TEAM_LEAD",
                    "name": "Team Lead",
                    "description": "Team & project execution management",
                    "is_superadmin_wildcard": False,
                    "is_system_role": True,
                },
                {
                    "code": "EMPLOYEE",
                    "name": "Employee",
                    "description": "Standard employee access",
                    "is_superadmin_wildcard": False,
                    "is_system_role": True,
                },
                {
                    "code": "OPERATIONS",
                    "name": "Operations",
                    "description": "Operations execution & task management",
                    "is_superadmin_wildcard": False,
                    "is_system_role": True,
                },
                {
                    "code": "OPERATIONS_HEAD",
                    "name": "Operations Head",
                    "description": "Operations head & KPI management",
                    "is_superadmin_wildcard": False,
                    "is_system_role": True,
                },
            ]

            created_roles = {}
            for rdata in roles_data:
                role_obj, _ = DynamicRole.objects.get_or_create(
                    code=rdata["code"],
                    defaults={
                        "name": rdata["name"],
                        "description": rdata["description"],
                        "is_superadmin_wildcard": rdata["is_superadmin_wildcard"],
                        "is_system_role": rdata["is_system_role"],
                    },
                )
                created_roles[rdata["code"]] = role_obj

            pages_data = [
                # {
                #     "module_code": "DASHBOARD",
                #     "title": "Command Center Dashboard",
                #     "route_path": "/work?view=command-center",
                #     "icon": "Sparkles",
                #     "sidebar_order": 1,
                # },
                {
                    "module_code": "TASKS",
                    "title": "Task Board",
                    "route_path": "/work?view=kanban",
                    "icon": "Kanban",
                    "sidebar_order": 2,
                },
                # {
                #     "module_code": "TIMELINE",
                #     "title": "Timeline & Phases",
                #     "route_path": "/work?view=timeline",
                #     "icon": "Layers",
                #     "sidebar_order": 3,
                # },
                {
                    "module_code": "TEAM_WORK",
                    "title": "Team Work",
                    "route_path": "/team-work",
                    "icon": "Users",
                    "sidebar_order": 4,
                },
                {
                    "module_code": "KPI",
                    "title": "KPI Performance",
                    "route_path": "/kpi",
                    "icon": "TrendingUp",
                    "sidebar_order": 5,
                },
                # {
                #     "module_code": "EMPLOYEES",
                #     "title": "Employees",
                #     "route_path": "/employees",
                #     "icon": "Users",
                #     "sidebar_order": 6,
                # },
                {
                    "module_code": "ATTENDANCE",
                    "title": "Attendance",
                    "route_path": "/attendance",
                    "icon": "CalendarCheck",
                    "sidebar_order": 7,
                },
                {
                    "module_code": "LEAVES",
                    "title": "Leave Requests",
                    "route_path": "/leaves",
                    "icon": "CalendarDays",
                    "sidebar_order": 8,
                },
                {
                    "module_code": "MEETINGS",
                    "title": "Meetings",
                    "route_path": "/meetings",
                    "icon": "UserRound",
                    "sidebar_order": 9,
                },
                {
                    "module_code": "PAGE_MANAGEMENT",
                    "title": "Page Management",
                    "route_path": "/pages",
                    "icon": "FileCode",
                    "sidebar_order": 10,
                },
                {
                    "module_code": "SETTINGS_ACCESS",
                    "title": "Settings & Access",
                    "route_path": "/settings",
                    "icon": "Settings",
                    "sidebar_order": 11,
                },
            ]

            created_pages = {}
            for pdata in pages_data:
                page_obj, _ = PortalPage.objects.get_or_create(
                    module_code=pdata["module_code"],
                    defaults={
                        "title": pdata["title"],
                        "route_path": pdata["route_path"],
                        "icon": pdata["icon"],
                        "sidebar_order": pdata["sidebar_order"],
                        "is_active": True,
                    },
                )
                created_pages[pdata["module_code"]] = page_obj

            permissions_map = {
                "SUPER_ADMIN": {p: (True, True, True, True) for p in created_pages},
                "ADMIN": {
                    p: (True, True, True, True)
                    for p in created_pages
                    if p not in ("PAGE_MANAGEMENT", "SETTINGS_ACCESS")
                },
                "HR": {
                    p: (True, True, True, False)
                    for p in ("DASHBOARD", "TASKS", "TIMELINE", "KPI", "EMPLOYEES", "ATTENDANCE", "LEAVES", "MEETINGS")
                },
                "TEAM_LEAD": {
                    p: (True, True, True, False)
                    for p in ("DASHBOARD", "TASKS", "TIMELINE", "TEAM_WORK", "MEETINGS")
                },
                "EMPLOYEE": {
                    "DASHBOARD": (True, False, False, False),
                    "TASKS": (True, False, True, False),
                    "KPI": (True, False, False, False),
                    "ATTENDANCE": (True, False, False, False),
                    "LEAVES": (True, True, False, False),
                    "MEETINGS": (True, False, False, False),
                },
                "ACCOUNTANT": {
                    "DASHBOARD": (True, False, False, False),
                    "TASKS": (True, False, False, False),
                    "ATTENDANCE": (True, False, False, False),
                },
                "BDE": {
                    "DASHBOARD": (True, False, False, False),
                    "TASKS": (True, True, True, False),
                    "TIMELINE": (True, False, False, False),
                    "MEETINGS": (True, False, False, False),
                    "LEAVES": (True, True, False, False),
                },
                "OPERATIONS": {
                    "DASHBOARD": (True, True, True, False),
                    "TASKS": (True, True, True, False),
                    "TIMELINE": (True, True, True, False),
                    "KPI": (True, True, True, False),
                },
                "OPERATIONS_HEAD": {
                    "DASHBOARD": (True, True, True, True),
                    "TASKS": (True, True, True, True),
                    "TIMELINE": (True, True, True, True),
                    "KPI": (True, True, True, True),
                },
            }

            for rcode, pdict in permissions_map.items():
                role_obj = created_roles.get(rcode)
                if not role_obj:
                    continue
                for mcode, (v, c, e, d) in pdict.items():
                    page_obj = created_pages.get(mcode)
                    if not page_obj:
                        continue
                    RolePermission.objects.get_or_create(
                        role=role_obj,
                        page=page_obj,
                        defaults={
                            "can_view": v,
                            "can_create": c,
                            "can_edit": e,
                            "can_delete": d,
                        },
                    )

            # Department & Employee link (ONLY run if portal_department table exists)
            linked_emp_count = 0
            tables = connection.introspection.table_names()
            if "portal_department" in tables:
                try:
                    with transaction.atomic():
                        from portal.models import Department, Employee

                        dept_data = [
                            {"name": "Web Development", "code": "WEB_DEVELOPMENT", "order": 1},
                            {"name": "Video Editing", "code": "VIDEO_EDITING", "order": 2},
                            {"name": "Design", "code": "DESIGN", "order": 3},
                            {"name": "Digital Marketing", "code": "DIGITAL_MARKETING", "order": 4},
                            {"name": "Accountant", "code": "ACCOUNTANT", "order": 5},
                            {"name": "HR", "code": "HR", "order": 6},
                            {"name": "Operations", "code": "OPERATIONS", "order": 7},
                        ]

                        created_depts = {}
                        for ditem in dept_data:
                            dept_obj, _ = Department.objects.get_or_create(
                                code=ditem["code"],
                                defaults={
                                    "name": ditem["name"],
                                    "display_order": ditem["order"],
                                    "is_active": True,
                                },
                            )
                            created_depts[ditem["name"]] = dept_obj

                        cursor = connection.cursor()
                        emp_cols = [c.name for c in connection.introspection.get_table_description(cursor, "portal_employee")]
                        if "department_ref_id" in emp_cols:
                            for emp in Employee.objects.filter(department_ref__isnull=True):
                                dept_name = emp.department
                                if dept_name and dept_name in created_depts:
                                    emp.department_ref = created_depts[dept_name]
                                    emp.save(update_fields=["department_ref"])
                                    linked_emp_count += 1
                except Exception as exc:
                    self.stdout.write(f"Skipping department seeding: {exc}")

            updated_count = 0
            for user_role in UserRole.objects.filter(dynamic_role__isnull=True):
                target_code = "SUPER_ADMIN" if user_role.user.is_superuser else user_role.role
                drole = created_roles.get(target_code) or created_roles.get(user_role.role)
                if drole:
                    user_role.dynamic_role = drole
                    user_role.save(update_fields=["dynamic_role"])
                    updated_count += 1

            self.stdout.write(
                self.style.SUCCESS(f"Successfully seeded RBAC & Departments. Linked {updated_count} user roles & {linked_emp_count} employee department_refs.")
            )
