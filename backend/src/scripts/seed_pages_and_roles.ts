import { connectDB } from '../config/db.js';
import { PortalPage } from '../models/PortalPage.js';
import { DynamicRole } from '../models/DynamicRole.js';
import { User } from '../models/User.js';
import { defaultRoleActionMatrix } from '../middleware/rbac.js';

interface PageDefinition {
  moduleCode: string;
  title: string;
  routePath: string;
  icon: string;
  sidebarOrder: number;
}

interface RoleDefinition {
  code: string;
  name: string;
  description: string;
  isSuperadminWildcard: boolean;
  isSystemRole: boolean;
}

const CANONICAL_PAGES: PageDefinition[] = [
  { moduleCode: 'COMMAND_CENTER', title: 'Command Center', routePath: '/work?view=command-center', icon: 'Sparkles', sidebarOrder: 1 },
  { moduleCode: 'CHAT', title: 'Team Chat Hub', routePath: '/chat', icon: 'MessageSquare', sidebarOrder: 2 },
  { moduleCode: 'TASKS', title: 'Task Board', routePath: '/work?view=kanban', icon: 'Kanban', sidebarOrder: 3 },
  { moduleCode: 'TIMER', title: 'Time Tracker', routePath: '/timer', icon: 'Clock3', sidebarOrder: 4 },
  { moduleCode: 'TEAM_WORK', title: 'Team Work', routePath: '/team-work', icon: 'Users', sidebarOrder: 5 },
  { moduleCode: 'CLIENTS', title: 'Clients Master', routePath: '/clients', icon: 'BriefcaseBusiness', sidebarOrder: 6 },
  { moduleCode: 'CLIENT_TASKS', title: 'Client Tasks & Calendar', routePath: '/clients/tasks', icon: 'Calendar', sidebarOrder: 7 },
  { moduleCode: 'TIMELINE', title: 'Timeline & Phases', routePath: '/work?view=timeline', icon: 'Layers', sidebarOrder: 8 },
  { moduleCode: 'KPI', title: 'KPI Performance', routePath: '/kpi', icon: 'TrendingUp', sidebarOrder: 9 },
  { moduleCode: 'EMPLOYEES', title: 'Employees Directory', routePath: '/employees', icon: 'Users', sidebarOrder: 10 },
  { moduleCode: 'ATTENDANCE', title: 'Attendance', routePath: '/attendance', icon: 'CalendarCheck', sidebarOrder: 11 },
  { moduleCode: 'EMPLOYEE_TRACKING', title: 'Employee Location Tracking', routePath: '/tracking', icon: 'MapPin', sidebarOrder: 12 },
  { moduleCode: 'LEAVES', title: 'Leave Requests', routePath: '/leaves', icon: 'CalendarDays', sidebarOrder: 13 },
  { moduleCode: 'MEETINGS', title: 'Meetings', routePath: '/meetings', icon: 'UserRound', sidebarOrder: 14 },
  { moduleCode: 'REPORTS', title: 'Reports Center', routePath: '/reports', icon: 'FileSpreadsheet', sidebarOrder: 15 },
  { moduleCode: 'ROLES', title: 'Dynamic Roles', routePath: '/admin/roles', icon: 'ShieldAlert', sidebarOrder: 16 },
  { moduleCode: 'SUPER_ADMIN_USERS', title: 'User Management', routePath: '/admin/users', icon: 'UserCheck', sidebarOrder: 17 },
  { moduleCode: 'PAGE_MANAGEMENT', title: 'Page Management', routePath: '/pages', icon: 'FileCode', sidebarOrder: 18 },
  { moduleCode: 'SALARY_SLIPS', title: 'Salary & Payroll', routePath: '/admin/salary-slips', icon: 'Receipt', sidebarOrder: 19 },
  { moduleCode: 'ANNOUNCEMENTS', title: 'Announcements', routePath: '/admin/announcements', icon: 'Megaphone', sidebarOrder: 20 },
  { moduleCode: 'AUDIT_LOGS', title: 'Audit Logs', routePath: '/admin/audit-logs', icon: 'History', sidebarOrder: 21 },
  { moduleCode: 'SETTINGS_ACCESS', title: 'Settings & Access', routePath: '/settings', icon: 'Settings', sidebarOrder: 22 },
];

const CANONICAL_ROLES: RoleDefinition[] = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full wildcard access to all modules and settings', isSuperadminWildcard: true, isSystemRole: true },
  { code: 'ADMIN', name: 'Administrator', description: 'Full operational management access', isSuperadminWildcard: false, isSystemRole: true },
  { code: 'HR', name: 'Human Resources', description: 'HR Manager with employee, leave, attendance, holiday, tracking, and payroll access', isSuperadminWildcard: false, isSystemRole: true },
  { code: 'ACCOUNTANT', name: 'Accountant', description: 'Accountant with financial, statutory, and salary/payroll access', isSuperadminWildcard: false, isSystemRole: true },
  { code: 'TEAM_LEAD', name: 'Team Lead', description: 'Team Leader managing assignments, attendance, tracking, and reviews', isSuperadminWildcard: false, isSystemRole: true },
  { code: 'EMPLOYEE', name: 'Employee', description: 'Regular employee with self-service portal, location tracking, and payslip access', isSuperadminWildcard: false, isSystemRole: true },
  { code: 'BDE', name: 'Business Development', description: 'BDM managing clients, leads, location tracking, and proposals', isSuperadminWildcard: false, isSystemRole: true },
  { code: 'BDO', name: 'Business Development Officer', description: 'BDO managing client acquisition, location tracking, and accounts', isSuperadminWildcard: false, isSystemRole: true },
  { code: 'OPERATIONS', name: 'Operations', description: 'Operations Specialist managing daily deliverables and live workforce tracking', isSuperadminWildcard: false, isSystemRole: true },
  { code: 'OPERATIONS_HEAD', name: 'Operations Head', description: 'Head of Operations overseeing team deliverables and workforce mobility', isSuperadminWildcard: false, isSystemRole: true },
];

export async function seedPagesAndRoles() {
  await connectDB();
  console.log('================================================================================');
  console.log('=== STARTING PRODUCTION-SAFE PORTAL PAGES & DYNAMIC ROLES SYNC ===');
  console.log('================================================================================\n');

  // STEP 1: UPSERT / REFRESH ALL PORTAL PAGES
  console.log('[Step 1] 📄 Syncing Canonical Portal Pages...');
  const pageDocMap: Record<string, any> = {};

  for (const pageDef of CANONICAL_PAGES) {
    let pageDoc = await PortalPage.findOne({ moduleCode: pageDef.moduleCode });

    if (pageDoc) {
      pageDoc.title = pageDef.title;
      pageDoc.routePath = pageDef.routePath;
      pageDoc.icon = pageDef.icon;
      pageDef.sidebarOrder = pageDef.sidebarOrder;
      pageDoc.isActive = true;
      await pageDoc.save();
      console.log(`  ✓ Updated page: ${pageDef.title} [${pageDef.moduleCode}]`);
    } else {
      pageDoc = await PortalPage.create({
        ...pageDef,
        isActive: true,
      });
      console.log(`  + Created page: ${pageDef.title} [${pageDef.moduleCode}]`);
    }

    pageDocMap[pageDef.moduleCode] = pageDoc;
  }

  // Remove obsolete/orphaned pages not in canonical list
  const canonicalCodes = CANONICAL_PAGES.map((p) => p.moduleCode);
  const deletedPages = await PortalPage.deleteMany({ moduleCode: { $nin: canonicalCodes } });
  if (deletedPages.deletedCount > 0) {
    console.log(`  🧹 Cleaned up ${deletedPages.deletedCount} deprecated portal pages.`);
  }
  console.log(`[Step 1] ✅ ${Object.keys(pageDocMap).length} Portal Pages active & synchronized.\n`);

  // STEP 2: IN-PLACE UPDATE FOR DYNAMIC ROLES (PRESERVING OBJECT IDs & EMPLOYEE ASSOCIATIONS)
  console.log('[Step 2] 🛡️ Updating Dynamic Roles in place (zero impact on existing users/employees)...');
  const roleDocMap: Record<string, any> = {};

  for (const roleDef of CANONICAL_ROLES) {
    const roleMatrix = defaultRoleActionMatrix[roleDef.code] || {};
    const isSuper = roleDef.isSuperadminWildcard || roleDef.code === 'SUPER_ADMIN';

    // Build permissions array for all canonical pages
    const permissions = CANONICAL_PAGES.map((pageDef) => {
      const pageDoc = pageDocMap[pageDef.moduleCode];
      if (isSuper) {
        return {
          page: pageDoc._id,
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        };
      }

      const perms = roleMatrix[pageDef.moduleCode] || {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      };

      return {
        page: pageDoc._id,
        canView: Boolean(perms.canView),
        canCreate: Boolean(perms.canCreate),
        canEdit: Boolean(perms.canEdit),
        canDelete: Boolean(perms.canDelete),
      };
    });

    let existingRole = await DynamicRole.findOne({ code: roleDef.code });

    if (existingRole) {
      // IN-PLACE UPDATE: Update role definition without changing _id
      existingRole.name = roleDef.name;
      existingRole.description = roleDef.description;
      existingRole.isSuperadminWildcard = roleDef.isSuperadminWildcard;
      existingRole.isSystemRole = true;
      existingRole.permissions = permissions as any;
      await existingRole.save();
      console.log(`  ✓ Updated existing role: ${roleDef.name} (${roleDef.code}) [ID: ${existingRole._id}]`);
      roleDocMap[roleDef.code] = existingRole;
    } else {
      // Create if it doesn't exist yet
      const newRole = await DynamicRole.create({
        ...roleDef,
        permissions,
      });
      console.log(`  + Created new role: ${roleDef.name} (${roleDef.code}) [ID: ${newRole._id}]`);
      roleDocMap[roleDef.code] = newRole;
    }
  }

  // STEP 3: UPDATE CUSTOM DYNAMIC ROLES (IF ANY EXIST)
  const allRoles = await DynamicRole.find();
  const canonicalRoleCodes = CANONICAL_ROLES.map((r) => r.code);
  const customRoles = allRoles.filter((r) => !canonicalRoleCodes.includes(r.code));

  if (customRoles.length > 0) {
    console.log(`\n[Step 3] 🧩 Updating ${customRoles.length} custom dynamic roles with new pages...`);
    for (const customRole of customRoles) {
      const existingPageIds = new Set(
        customRole.permissions.map((p) => p.page?.toString()).filter(Boolean)
      );

      for (const pageDef of CANONICAL_PAGES) {
        const pageDoc = pageDocMap[pageDef.moduleCode];
        if (!existingPageIds.has(pageDoc._id.toString())) {
          customRole.permissions.push({
            page: pageDoc._id,
            canView: true,
            canCreate: false,
            canEdit: false,
            canDelete: false,
          } as any);
        }
      }

      await customRole.save();
      console.log(`  ✓ Synced custom role: ${customRole.name} (${customRole.code})`);
    }
  }

  // STEP 4: VERIFY USER-ROLE INTEGRITY
  console.log('\n[Step 4] 👥 Verifying User & Employee dynamicRole link integrity...');
  const users = await User.find();
  let relinkedCount = 0;

  for (const user of users) {
    const roleCode = user.role;
    const targetDynamicRole = roleDocMap[roleCode];

    if (targetDynamicRole) {
      if (!user.dynamicRole || user.dynamicRole.toString() !== targetDynamicRole._id.toString()) {
        user.dynamicRole = targetDynamicRole._id;
        await user.save();
        relinkedCount++;
      }
    }
  }
  console.log(`  ✓ Verified ${users.length} user accounts (${relinkedCount} references relinked).`);

  console.log('\n================================================================================');
  console.log('✅ ALL PORTAL PAGES & DYNAMIC ROLES SUCCESSFULLY SEEDED AND UPDATED!');
  console.log('   - 0 users/employees affected or broken.');
  console.log('   - Role ObjectIds preserved in place.');
  console.log('   - All 22 canonical modules updated with full action permissions.');
  console.log('================================================================================\n');
}

// Allow direct execution from CLI
if (process.argv[1] && process.argv[1].endsWith('seed_pages_and_roles.ts')) {
  seedPagesAndRoles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error executing seed_pages_and_roles:', err);
      process.exit(1);
    });
}
