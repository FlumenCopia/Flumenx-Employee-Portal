import { PortalPage } from '../models/PortalPage.js';
import { DynamicRole } from '../models/DynamicRole.js';
import { seedAccountingDefaults } from './accounting/seedChartOfAccounts.js';

export async function syncDefaultPortalPages(): Promise<void> {
  try {
    await seedAccountingDefaults();

    const requiredPages = [
      { moduleCode: 'COMMAND_CENTER', title: 'Command Center', routePath: '/work?view=command-center', icon: 'Sparkles', sidebarOrder: 1 },
      { moduleCode: 'TOOLS', title: 'Utility Toolbox', routePath: '/tools', icon: 'Wrench', sidebarOrder: 2 },
      { moduleCode: 'CHAT', title: 'Team Chat Hub', routePath: '/chat', icon: 'MessageSquare', sidebarOrder: 3 },
      { moduleCode: 'TASKS', title: 'Task Board', routePath: '/work?view=kanban', icon: 'Kanban', sidebarOrder: 4 },
      { moduleCode: 'TIMER', title: 'Time Tracker', routePath: '/timer', icon: 'Clock3', sidebarOrder: 5 },
      { moduleCode: 'TEAM_WORK', title: 'Team Work', routePath: '/team-work', icon: 'Users', sidebarOrder: 6 },
      { moduleCode: 'CLIENTS', title: 'Clients Master', routePath: '/clients', icon: 'BriefcaseBusiness', sidebarOrder: 7 },
      { moduleCode: 'CLIENT_TASKS', title: 'Client Tasks & Calendar', routePath: '/clients/tasks', icon: 'Calendar', sidebarOrder: 8 },
      { moduleCode: 'TIMELINE', title: 'Timeline & Phases', routePath: '/work?view=timeline', icon: 'Layers', sidebarOrder: 9 },
      { moduleCode: 'KPI', title: 'KPI Performance', routePath: '/kpi', icon: 'TrendingUp', sidebarOrder: 10 },
      { moduleCode: 'EMPLOYEES', title: 'Employees Directory', routePath: '/employees', icon: 'Users', sidebarOrder: 11 },
      { moduleCode: 'ATTENDANCE', title: 'Attendance', routePath: '/attendance', icon: 'CalendarCheck', sidebarOrder: 12 },
      { moduleCode: 'EMPLOYEE_TRACKING', title: 'Employee Location Tracking', routePath: '/tracking', icon: 'MapPin', sidebarOrder: 13 },
      { moduleCode: 'LEAVES', title: 'Leave Requests', routePath: '/leaves', icon: 'CalendarDays', sidebarOrder: 14 },
      { moduleCode: 'MEETINGS', title: 'Meetings', routePath: '/meetings', icon: 'UserRound', sidebarOrder: 15 },
      { moduleCode: 'REPORTS', title: 'Reports Center', routePath: '/reports', icon: 'FileSpreadsheet', sidebarOrder: 16 },
      { moduleCode: 'ACCOUNTING', title: 'Accounting & Finance', routePath: '/accounting', icon: 'Landmark', sidebarOrder: 17 },
      { moduleCode: 'ROLES', title: 'Dynamic Roles', routePath: '/admin/roles', icon: 'ShieldAlert', sidebarOrder: 18 },
      { moduleCode: 'SUPER_ADMIN_USERS', title: 'User Management', routePath: '/admin/users', icon: 'UserCheck', sidebarOrder: 19 },
      { moduleCode: 'PAGE_MANAGEMENT', title: 'Page Management', routePath: '/pages', icon: 'FileCode', sidebarOrder: 20 },
      { moduleCode: 'SALARY_SLIPS', title: 'Salary & Payroll', routePath: '/admin/salary-slips', icon: 'Receipt', sidebarOrder: 21 },
      { moduleCode: 'ANNOUNCEMENTS', title: 'Announcements', routePath: '/admin/announcements', icon: 'Megaphone', sidebarOrder: 22 },
      { moduleCode: 'AUDIT_LOGS', title: 'Audit Logs', routePath: '/admin/audit-logs', icon: 'History', sidebarOrder: 23 },
      { moduleCode: 'SETTINGS_ACCESS', title: 'Settings & Access', routePath: '/settings', icon: 'Settings', sidebarOrder: 24 },
    ];

    for (const p of requiredPages) {
      let pageDoc = await PortalPage.findOne({ moduleCode: p.moduleCode });
      if (!pageDoc) {
        pageDoc = await PortalPage.create({
          ...p,
          isActive: true,
        });
        console.log(`[AutoSync] Created missing portal page: ${p.title} (${p.moduleCode})`);
      } else {
        if (!pageDoc.isActive || pageDoc.routePath !== p.routePath || pageDoc.icon !== p.icon) {
          pageDoc.isActive = true;
          pageDoc.routePath = p.routePath;
          pageDoc.icon = p.icon;
          await pageDoc.save();
        }
      }

      // Ensure dynamic roles have permissions for this page without destroying existing customizations
      const roles = await DynamicRole.find();
      for (const role of roles) {
        const isSuper = role.isSuperadminWildcard || role.code === 'ADMIN' || role.code === 'SUPER_ADMIN';
        const isFinanceRole = role.code === 'ACCOUNTANT' || role.code === 'CFO';
        const isAccountingPage = p.moduleCode === 'ACCOUNTING';

        const existingPerm = role.permissions.find(
          (perm) => perm.page && perm.page.toString() === pageDoc!._id.toString()
        );

        if (!existingPerm) {
          const canView = isSuper || (isAccountingPage ? isFinanceRole : false);
          const canCreate = isSuper || (isAccountingPage ? isFinanceRole : false);
          const canEdit = isSuper || (isAccountingPage ? isFinanceRole : false);
          const canDelete = isSuper || (isAccountingPage ? isFinanceRole : false);

          role.permissions.push({
            page: pageDoc._id as any,
            canView,
            canCreate,
            canEdit,
            canDelete,
          } as any);
          await role.save();
        } else if (isAccountingPage) {
          // If Accountant or CFO was missing mutation rights, ensure full rights
          if (isFinanceRole && (!existingPerm.canView || !existingPerm.canCreate || !existingPerm.canEdit || !existingPerm.canDelete)) {
            existingPerm.canView = true;
            existingPerm.canCreate = true;
            existingPerm.canEdit = true;
            existingPerm.canDelete = true;
            await role.save();
          }
        }
      }
    }
  } catch (err) {
    console.error('[AutoSync] Error during portal pages sync:', err);
  }
}
