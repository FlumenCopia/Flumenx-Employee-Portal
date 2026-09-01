import { PortalPage } from '../models/PortalPage.js';
import { DynamicRole } from '../models/DynamicRole.js';

export async function syncDefaultPortalPages(): Promise<void> {
  try {
    const requiredPages = [
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
      { moduleCode: 'EMPLOYEE_TRACKING', title: 'Employee Tracking', routePath: '/tracking', icon: 'MapPin', sidebarOrder: 12 },
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

    for (const p of requiredPages) {
      let pageDoc = await PortalPage.findOne({ moduleCode: p.moduleCode });
      if (!pageDoc) {
        pageDoc = await PortalPage.create({
          ...p,
          isActive: true,
        });
        console.log(`[AutoSync] Created missing portal page: ${p.title} (${p.moduleCode})`);
      }

      // Ensure dynamic roles have permissions for this page
      const roles = await DynamicRole.find();
      for (const role of roles) {
        const hasPerm = role.permissions.some(
          (perm) => perm.page && perm.page.toString() === pageDoc!._id.toString()
        );
        if (!hasPerm) {
          const isSuper = role.isSuperadminWildcard || role.code === 'ADMIN' || role.code === 'SUPER_ADMIN';
          const isGeneralAccessible = p.moduleCode === 'CHAT' || p.moduleCode === 'CLIENT_TASKS';
          
          role.permissions.push({
            page: pageDoc._id as any,
            canView: isSuper || isGeneralAccessible || true,
            canCreate: isSuper || p.moduleCode === 'CHAT',
            canEdit: isSuper || p.moduleCode === 'CHAT',
            canDelete: isSuper,
          } as any);
          await role.save();
        }
      }
    }
  } catch (err) {
    console.error('[AutoSync] Error during portal pages sync:', err);
  }
}
