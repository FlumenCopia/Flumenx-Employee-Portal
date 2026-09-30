import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Department } from '../models/Department.js';
import { PortalPage } from '../models/PortalPage.js';
import { DynamicRole } from '../models/DynamicRole.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { resolveUserPermissions } from '../services/permissionResolver.js';

// --- Departments ---
export async function getDepartments(req: Request, res: Response): Promise<void> {
  const departments = await Department.find().sort({ displayOrder: 1, name: 1 });
  const formatted = departments.map((d) => ({
    id: d._id,
    name: d.name,
    code: d.code,
    description: d.description,
    is_active: d.isActive,
    display_order: d.displayOrder,
  }));
  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function createDepartment(req: Request, res: Response): Promise<void> {
  const { name, code, description, is_active, display_order } = req.body;
  const dept = new Department({
    name: name.trim(),
    code: code ? code.trim() : name.trim().toUpperCase().replace(/\s+/g, '_'),
    description: description || '',
    isActive: is_active !== undefined ? is_active : true,
    displayOrder: display_order || 0,
  });
  await dept.save();
  res.status(201).json(dept);
}

export async function updateDepartment(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Department not found.' });
    return;
  }
  const dept = await Department.findById(req.params.id);
  if (!dept) {
    res.status(404).json({ detail: 'Department not found.' });
    return;
  }
  const fields = req.body;
  if (fields.name) dept.name = fields.name.trim();
  if (fields.code) dept.code = fields.code.trim();
  if (fields.description !== undefined) dept.description = fields.description;
  if (fields.is_active !== undefined) dept.isActive = fields.is_active;
  if (fields.display_order !== undefined) dept.displayOrder = fields.display_order;
  await dept.save();
  res.json(dept);
}

export async function deleteDepartment(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Department not found.' });
    return;
  }
  await Department.findByIdAndDelete(req.params.id);
  res.status(204).send();
}

export const CANONICAL_PAGE_FEATURES: Record<string, { key: string; label: string; description?: string }[]> = {
  COMMAND_CENTER: [
    { key: 'view_all_work', label: 'View All Work Across Company', description: 'Can monitor all active tasks and assignments' },
    { key: 'bulk_assign', label: 'Bulk Assignment', description: 'Can mass re-assign work between teams' },
  ],
  TASKS: [
    { key: 'create_task', label: 'Create New Tasks', description: 'Can create work cards and tasks' },
    { key: 'bulk_create', label: 'Bulk Create Tasks', description: 'Can bulk create and batch assign multiple tasks' },
    { key: 'can_edit', label: 'Edit Tasks', description: 'Can update task progress and details' },
    { key: 'review_tasks', label: 'Review & Verify Tasks', description: 'Can review submissions and approve work' },
    { key: 'delete_task', label: 'Delete Tasks', description: 'Can permanently remove tasks' },
    { key: 'manage_labels', label: 'Manage Labels & Priorities', description: 'Can create labels and change priorities' },
  ],
  TEAM_WORK: [
    { key: 'view_team_work', label: 'View Team Work', description: 'Can monitor team workloads and assignments' },
    { key: 'assign_team_work', label: 'Assign Team Work', description: 'Can distribute tasks among team members' },
  ],
  CLIENTS: [
    { key: 'create_client', label: 'Create Clients', description: 'Can onboard new clients' },
    { key: 'edit_client', label: 'Edit Clients', description: 'Can update client details' },
    { key: 'delete_client', label: 'Delete Clients', description: 'Can delete or archive clients' },
  ],
  CLIENT_TASKS: [
    { key: 'create_task', label: 'Create Client Deliverables', description: 'Can schedule deliverables and milestones' },
    { key: 'can_edit', label: 'Edit Client Deliverables', description: 'Can update client deliverables' },
  ],
  TIMELINE: [
    { key: 'manage_phases', label: 'Manage Timeline & Phases', description: 'Can update project phase timelines' },
  ],
  KPI: [
    { key: 'view_kpi', label: 'View KPI Scores', description: 'Can view performance metrics' },
    { key: 'evaluate_kpi', label: 'Evaluate Employee KPI', description: 'Can rate and record KPI appraisals' },
  ],
  EMPLOYEES: [
    { key: 'add_employee', label: 'Add New Employee', description: 'Can onboard new staff members' },
    { key: 'edit_employee', label: 'Edit Employee Profile', description: 'Can update designations, phones, and addresses' },
    { key: 'manage_documents', label: 'Manage KYC & Documents', description: 'Can upload and verify contracts and IDs' },
    { key: 'edit_salary_info', label: 'Edit Salary & Compensation', description: 'Can view and modify base pay details' },
    { key: 'terminate_employee', label: 'Offboard / Terminate', description: 'Can deactivate employee accounts' },
  ],
  ATTENDANCE: [
    { key: 'manual_entry', label: 'Manual Check-in/out Entry', description: 'Can log attendance on behalf of others' },
    { key: 'policy_settings', label: 'Configure Attendance Policies', description: 'Can adjust office hours and grace times' },
    { key: 'reports_export', label: 'Export Attendance Reports', description: 'Can download CSV/PDF attendance logs' },
    { key: 'view_register', label: 'View Organization Register', description: 'Can inspect entire company attendance grid' },
  ],
  EMPLOYEE_TRACKING: [
    { key: 'live_map', label: 'Live Location Tracking Map', description: 'Can view real-time GPS locations of staff' },
    { key: 'history_playback', label: 'Route History Playback', description: 'Can review GPS routes and travel trails' },
    { key: 'geofence_alerts', label: 'Geofence Breaches & Alerts', description: 'Can see alert logs when leaving geofenced zones' },
  ],
  LEAVES: [
    { key: 'apply_leave', label: 'Apply For Leave', description: 'Can submit leave requests' },
    { key: 'review_leave', label: 'Approve / Reject Leave', description: 'Can approve or reject pending leave applications' },
    { key: 'adjust_balance', label: 'Adjust Leave Balances', description: 'Can manually credit or debit leave quotas' },
  ],
  MEETINGS: [
    { key: 'create_meeting', label: 'Schedule Meetings', description: 'Can create audio/video meetings' },
    { key: 'host_controls', label: 'Meeting Host Controls', description: 'Can mute, record, or manage participants' },
  ],
  CHAT: [
    { key: 'create_channel', label: 'Create Group Channels', description: 'Can create department or project channels' },
    { key: 'direct_message', label: 'Direct Messaging', description: 'Can send direct messages to colleagues' },
  ],
  TIMER: [
    { key: 'manage_timers', label: 'Team Timer Controls', description: 'Can start, stop, or adjust work timers' },
  ],
  REPORTS: [
    { key: 'export_reports', label: 'Export Enterprise Reports', description: 'Can export attendance, work, and productivity reports' },
    { key: 'view_all_reports', label: 'View All Department Reports', description: 'Can view reports across departments' },
  ],
  ACCOUNTING: [
    { key: 'create_invoice', label: 'Create Invoices', description: 'Can issue customer invoices' },
    { key: 'record_expense', label: 'Record Expenses & Bills', description: 'Can record vendor bills and disbursements' },
    { key: 'reconcile_bank', label: 'Bank Reconciliation', description: 'Can match bank statements with ledger accounts' },
    { key: 'export_reports', label: 'Export Financial Statements', description: 'Can download Balance Sheet and P&L' },
    { key: 'manage_accounts', label: 'Chart of Accounts Management', description: 'Can add, edit, or archive ledger accounts' },
    { key: 'manage_budgets', label: 'Budget Configuration', description: 'Can create fiscal budgets and cost centers' },
  ],
  SALARY_SLIPS: [
    { key: 'generate_slips', label: 'Run Monthly Payroll', description: 'Can compute monthly salary registers' },
    { key: 'disburse_salary', label: 'Disburse Salary', description: 'Can mark payments as executed' },
    { key: 'configure_structures', label: 'Manage Salary Structures', description: 'Can adjust base pay and CTC components' },
    { key: 'export_bank_advice', label: 'Export Bank Payment Advice', description: 'Can download bulk salary transfer files' },
    { key: 'view_payroll_reports', label: 'View Comprehensive Payroll Reports', description: 'Can inspect company-wide salary audit reports' },
  ],
  ANNOUNCEMENTS: [
    { key: 'create_announcement', label: 'Publish Announcements', description: 'Can broadcast news to all employees' },
  ],
  AUDIT_LOGS: [
    { key: 'view_audit_logs', label: 'View System Audit Logs', description: 'Can inspect authentication and modification trails' },
  ],
  ROLES: [
    { key: 'create_role', label: 'Create Dynamic Roles', description: 'Can create custom roles with permission matrices' },
    { key: 'edit_matrix', label: 'Edit Permission Matrix', description: 'Can toggle granular permissions for roles' },
    { key: 'delete_role', label: 'Delete Roles', description: 'Can remove custom dynamic roles' },
  ],
  SUPER_ADMIN_USERS: [
    { key: 'create_user', label: 'Create Portal Users', description: 'Can generate new login credentials' },
    { key: 'assign_roles', label: 'Assign & Reassign Roles', description: 'Can change dynamic roles of any user' },
    { key: 'reset_passwords', label: 'Force Password Reset', description: 'Can issue temporary passwords' },
    { key: 'toggle_status', label: 'Suspend / Activate Accounts', description: 'Can lock user access' },
  ],
  PAGE_MANAGEMENT: [
    { key: 'toggle_modules', label: 'Enable / Disable System Modules', description: 'Can hide entire modules system-wide' },
    { key: 'reorder_navigation', label: 'Reorder Navigation Bar', description: 'Can alter sidebar sequence' },
  ],
  SETTINGS_ACCESS: [
    { key: 'manage_company_settings', label: 'Manage Company Settings', description: 'Can adjust organization profile and access policies' },
  ],
  TOOLS: [
    { key: 'use_tools', label: 'Access Developer & Utility Tools', description: 'Can run portal tools and utilities' },
  ],
};

const CANONICAL_PAGE_DEFS = [
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

export async function ensureCanonicalPagesExist(): Promise<void> {
  for (const pageDef of CANONICAL_PAGE_DEFS) {
    const canonicalFeatures = CANONICAL_PAGE_FEATURES[pageDef.moduleCode] || [];
    let pageDoc = await PortalPage.findOne({ moduleCode: pageDef.moduleCode });
    if (!pageDoc) {
      await PortalPage.create({ ...pageDef, features: canonicalFeatures as any, isActive: true });
    } else {
      let changed = false;
      if (!pageDoc.isActive) {
        pageDoc.isActive = true;
        changed = true;
      }
      if (pageDoc.routePath !== pageDef.routePath) {
        pageDoc.routePath = pageDef.routePath;
        changed = true;
      }
      if (pageDoc.icon !== pageDef.icon) {
        pageDoc.icon = pageDef.icon;
        changed = true;
      }
      // Ensure all canonical features are present on pageDoc
      const existingKeys = new Set((pageDoc.features || []).map((f: any) => f.key));
      const missingFeatures = canonicalFeatures.filter((f) => !existingKeys.has(f.key));
      if (missingFeatures.length > 0) {
        pageDoc.features = [...(pageDoc.features || []), ...missingFeatures] as any;
        changed = true;
      }
      if (changed) {
        await pageDoc.save();
      }
    }
  }

  // Ensure all dynamic roles have permissions for every active page without overwriting existing customizations
  const pages = await PortalPage.find({ isActive: true });
  const roles = await DynamicRole.find();

  for (const role of roles) {
    let roleModified = false;
    for (const page of pages) {
      const existingPerm = role.permissions.find(
        (p) => p.page && p.page.toString() === page._id.toString()
      );

      const isSuper = role.isSuperadminWildcard || role.code === 'SUPER_ADMIN' || role.code === 'ADMIN';
      const isFinanceRole = role.code === 'ACCOUNTANT' || role.code === 'CFO';
      const isAccountingPage = page.moduleCode === 'ACCOUNTING';

      if (!existingPerm) {
        const canView = isSuper || (isAccountingPage ? isFinanceRole : false);
        const canCreate = isSuper || (isAccountingPage ? isFinanceRole : false);
        const canEdit = isSuper || (isAccountingPage ? isFinanceRole : false);
        const canDelete = isSuper || (isAccountingPage ? isFinanceRole : false);

        role.permissions.push({
          page: page._id as any,
          canView,
          canCreate,
          canEdit,
          canDelete,
        } as any);
        roleModified = true;
      } else if (isAccountingPage && isFinanceRole) {
        // Upgrade finance roles (Accountant & CFO) to full access if they were missing mutation perms
        if (!existingPerm.canView || !existingPerm.canCreate || !existingPerm.canEdit || !existingPerm.canDelete) {
          existingPerm.canView = true;
          existingPerm.canCreate = true;
          existingPerm.canEdit = true;
          existingPerm.canDelete = true;
          roleModified = true;
        }
      }
    }

    if (roleModified) {
      await role.save();
    }
  }
}

// --- Portal Pages ---
export async function getPortalPages(req: Request, res: Response): Promise<void> {
  await ensureCanonicalPagesExist();
  const pages = await PortalPage.find().sort({ sidebarOrder: 1, title: 1 });
  const formatted = pages.map((p) => ({
    id: p._id,
    title: p.title,
    route_path: p.routePath,
    module_code: p.moduleCode,
    icon: p.icon,
    sidebar_order: p.sidebarOrder,
    is_active: p.isActive,
  }));
  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function createPortalPage(req: Request, res: Response): Promise<void> {
  const { title, route_path, module_code, icon, sidebar_order, is_active } = req.body;
  const page = new PortalPage({
    title: title.trim(),
    routePath: route_path.trim(),
    moduleCode: module_code.trim(),
    icon: icon || 'LayoutDashboard',
    sidebarOrder: sidebar_order || 0,
    isActive: is_active !== undefined ? is_active : true,
  });
  await page.save();
  res.status(201).json(page);
}

export async function updatePortalPage(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Portal page not found.' });
    return;
  }
  const page = await PortalPage.findById(req.params.id);
  if (!page) {
    res.status(404).json({ detail: 'Portal page not found.' });
    return;
  }
  const fields = req.body;
  if (fields.title) page.title = fields.title.trim();
  if (fields.route_path) page.routePath = fields.route_path.trim();
  if (fields.module_code) page.moduleCode = fields.module_code.trim();
  if (fields.icon) page.icon = fields.icon;
  if (fields.sidebar_order !== undefined) page.sidebarOrder = fields.sidebar_order;
  if (fields.is_active !== undefined) page.isActive = fields.is_active;
  await page.save();
  res.json(page);
}

export async function deletePortalPage(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Portal page not found.' });
    return;
  }
  await PortalPage.findByIdAndDelete(req.params.id);
  res.status(204).send();
}

// --- Dynamic Roles & Permissions Matrix ---
export async function getDynamicRoles(req: Request, res: Response): Promise<void> {
  const roles = await DynamicRole.find().populate('permissions.page').sort({ name: 1 });
  const formatted = roles.map((r) => ({
    id: r._id,
    name: r.name,
    code: r.code,
    description: r.description,
    is_superadmin_wildcard: r.isSuperadminWildcard,
    is_system_role: r.isSystemRole,
    permissions_count: r.permissions ? r.permissions.length : 0,
  }));
  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function createDynamicRole(req: Request, res: Response): Promise<void> {
  const { name, code, description, is_superadmin_wildcard } = req.body;
  if (!name || !code) {
    res.status(400).json({ detail: 'Role name and code are required.' });
    return;
  }
  const role = new DynamicRole({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    description: description || '',
    isSuperadminWildcard: Boolean(is_superadmin_wildcard),
    isSystemRole: false,
    permissions: [],
  });
  await role.save();
  res.status(201).json(role);
}

export async function updateDynamicRole(req: Request, res: Response): Promise<void> {
  const roleId = req.params.id || req.params.roleId;
  if (!mongoose.Types.ObjectId.isValid(roleId)) {
    res.status(404).json({ detail: 'Dynamic role not found.' });
    return;
  }
  const role = await DynamicRole.findById(roleId);
  if (!role) {
    res.status(404).json({ detail: 'Dynamic role not found.' });
    return;
  }

  const { name, code, description, is_superadmin_wildcard, permissions } = req.body;
  if (name) role.name = name.trim();
  if (code) role.code = code.trim().toUpperCase();
  if (description !== undefined) role.description = description;
  if (is_superadmin_wildcard !== undefined) role.isSuperadminWildcard = Boolean(is_superadmin_wildcard);

  if (Array.isArray(permissions)) {
    role.permissions = permissions.map((p: any) => ({
      page: p.page_id || p.page,
      canView: p.can_view ?? p.canView ?? false,
      canCreate: p.can_create ?? p.canCreate ?? false,
      canEdit: p.can_edit ?? p.canEdit ?? false,
      canDelete: p.can_delete ?? p.canDelete ?? false,
      dataScope: p.data_scope || p.dataScope || 'OWN',
      features: Array.isArray(p.features) ? p.features : [],
    }));
  }

  await role.save();
  res.json({
    id: role._id,
    code: role.code,
    name: role.name,
    description: role.description,
    is_superadmin_wildcard: role.isSuperadminWildcard,
    is_system_role: role.isSystemRole,
    permissions_count: role.permissions ? role.permissions.length : 0,
  });
}

export async function deleteDynamicRole(req: Request, res: Response): Promise<void> {
  const roleId = req.params.id || req.params.roleId;
  if (!mongoose.Types.ObjectId.isValid(roleId)) {
    res.status(404).json({ detail: 'Dynamic role not found.' });
    return;
  }
  const role = await DynamicRole.findById(roleId);
  if (!role) {
    res.status(404).json({ detail: 'Dynamic role not found.' });
    return;
  }
  if (role.isSystemRole) {
    res.status(400).json({ detail: 'System roles cannot be deleted.' });
    return;
  }
  await DynamicRole.findByIdAndDelete(roleId);
  res.json({ detail: 'Dynamic role deleted successfully.' });
}

export async function getRolePermissionMatrix(req: Request, res: Response): Promise<void> {
  const roleId = req.params.roleId || req.params.id;
  if (!mongoose.Types.ObjectId.isValid(roleId)) {
    res.status(404).json({ detail: 'Dynamic role not found.' });
    return;
  }
  const role = await DynamicRole.findById(roleId).populate('permissions.page');
  if (!role) {
    res.status(404).json({ detail: 'Dynamic role not found.' });
    return;
  }

  await ensureCanonicalPagesExist();
  const allPages = await PortalPage.find({ isActive: true }).sort({ sidebarOrder: 1 });

  const matrix = allPages.map((page) => {
    const perm = role.permissions.find(
      (p) => p.page && (p.page as any)._id.toString() === page._id.toString()
    );
    return {
      page_id: page._id,
      page_title: page.title,
      route_path: page.routePath,
      module_code: page.moduleCode,
      available_features: page.features || [],
      can_view: role.isSuperadminWildcard ? true : perm ? perm.canView : false,
      can_create: role.isSuperadminWildcard ? true : perm ? perm.canCreate : false,
      can_edit: role.isSuperadminWildcard ? true : perm ? perm.canEdit : false,
      can_delete: role.isSuperadminWildcard ? true : perm ? perm.canDelete : false,
      data_scope: role.isSuperadminWildcard ? 'ALL' : perm?.dataScope || 'OWN',
      features: role.isSuperadminWildcard ? (page.features || []).map((f) => f.key) : perm?.features || [],
    };
  });

  res.json({
    role: {
      id: role._id,
      code: role.code,
      name: role.name,
      is_superadmin_wildcard: role.isSuperadminWildcard,
      is_system_role: role.isSystemRole,
    },
    permissions: matrix,
  });
}

export async function updateRolePermissionMatrix(req: Request, res: Response): Promise<void> {
  const roleId = req.params.roleId || req.params.id;
  if (!mongoose.Types.ObjectId.isValid(roleId)) {
    res.status(404).json({ detail: 'Dynamic role not found.' });
    return;
  }
  const role = await DynamicRole.findById(roleId);
  if (!role) {
    res.status(404).json({ detail: 'Dynamic role not found.' });
    return;
  }

  const { permissions, is_superadmin_wildcard } = req.body;
  if (is_superadmin_wildcard !== undefined) {
    role.isSuperadminWildcard = Boolean(is_superadmin_wildcard);
  }
  if (Array.isArray(permissions)) {
    role.permissions = permissions.map((p: any) => ({
      page: p.page_id || p.page,
      canView: p.can_view ?? p.canView ?? false,
      canCreate: p.can_create ?? p.canCreate ?? false,
      canEdit: p.can_edit ?? p.canEdit ?? false,
      canDelete: p.can_delete ?? p.canDelete ?? false,
      dataScope: p.data_scope || p.dataScope || 'OWN',
      features: Array.isArray(p.features) ? p.features : [],
    }));
  }

  await role.save();
  res.json({
    role: {
      id: role._id,
      code: role.code,
      name: role.name,
      is_superadmin_wildcard: role.isSuperadminWildcard,
      is_system_role: role.isSystemRole,
    },
    permissions: role.permissions,
  });
}

// --- Dynamic Navigation ---
export async function getDynamicNavigationMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }

  const allPages = await PortalPage.find({ isActive: true }).sort({ sidebarOrder: 1 });
  const permissions = await resolveUserPermissions(req.user);

  const visiblePages = allPages.filter((page) => {
    const pagePerm = permissions[page.moduleCode];
    return pagePerm && Boolean(pagePerm.canView);
  });

  res.json(
    visiblePages.map((p) => ({
      id: p._id,
      title: p.title,
      route_path: p.routePath,
      module_code: p.moduleCode,
      icon: p.icon,
      sidebar_order: p.sidebarOrder,
    }))
  );
}


// --- SuperAdmin User Management ---
export async function getSuperAdminUsers(req: Request, res: Response): Promise<void> {
  const users = await User.find().populate('dynamicRole').sort({ dateJoined: -1 });
  const formatted = await Promise.all(
    users.map(async (u) => {
      const emp = await Employee.findOne({ $or: [{ user: u._id }, { email: u.email }] });
      const avatarUrl = u.avatar || (emp ? emp.avatar : null) || '';
      return {
        user_id: u._id,
        id: u._id,
        username: u.username,
        email: u.email,
        work_email: u.email,
        full_name: `${u.firstName} ${u.lastName}`.trim() || u.username,
        first_name: u.firstName,
        last_name: u.lastName,
        designation: emp ? emp.designation : '—',
        department: emp ? emp.department : '—',
        department_id: emp ? emp.departmentRef : null,
        role: u.role,
        legacy_portal_role: u.role,
        avatar: avatarUrl,
        dynamic_role: u.dynamicRole
          ? {
              id: (u.dynamicRole as any)._id,
              code: (u.dynamicRole as any).code,
              name: (u.dynamicRole as any).name,
            }
          : null,
        is_active: u.isActive,
        status: u.isActive ? 'Active' : 'Inactive',
        is_staff: u.isStaff,
        is_superuser: u.isSuperuser,
        employee_id: emp ? emp._id : null,
        date_joined: u.dateJoined ? u.dateJoined.toISOString() : new Date().toISOString(),
      };
    })
  );
  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function updateSuperAdminUser(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'User not found.' });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ detail: 'User not found.' });
    return;
  }

  const { role, dynamic_role_id, is_active, full_name, designation, department, department_id } = req.body;

  const validSystemRoles = [
    'SUPER_ADMIN',
    'HR',
    'ADMIN',
    'ACCOUNTANT',
    'BDE',
    'TEAM_LEAD',
    'EMPLOYEE',
    'OPERATIONS',
    'OPERATIONS_HEAD',
  ];

  if (role && validSystemRoles.includes(role.toUpperCase())) {
    user.role = role.toUpperCase() as any;
  }

  if (dynamic_role_id !== undefined) {
    if (mongoose.Types.ObjectId.isValid(dynamic_role_id)) {
      user.dynamicRole = dynamic_role_id as any;
      const dynRole = await DynamicRole.findById(dynamic_role_id);
      if (dynRole && dynRole.code) {
        const dynCode = dynRole.code.trim().toUpperCase();
        if (validSystemRoles.includes(dynCode)) {
          user.role = dynCode as any;
        }
      }
    } else if (dynamic_role_id === null || dynamic_role_id === '') {
      user.dynamicRole = null;
    }
  }

  if (is_active !== undefined) user.isActive = is_active;

  if (full_name) {
    const parts = full_name.trim().split(' ');
    user.firstName = parts[0] || '';
    user.lastName = parts.slice(1).join(' ') || '';
  }

  await user.save();

  // Also sync Employee document if present
  const employee = await Employee.findOne({ $or: [{ user: user._id }, { email: user.email }] });
  if (employee) {
    if (full_name) employee.name = full_name.trim();
    if (designation) employee.designation = designation.trim();
    if (department) employee.department = department.trim();
    if (department_id && mongoose.Types.ObjectId.isValid(department_id)) {
      employee.departmentRef = department_id as any;
    }
    if (is_active !== undefined) {
      employee.status = is_active ? 'Active' : 'Inactive';
    }
    await employee.save();
  }

  res.json(user);
}

export async function createSuperAdminUser(req: Request, res: Response): Promise<void> {
  const { full_name, email, work_email, initial_password, password, designation, department, dynamic_role_id, role } = req.body;
  const userEmail = (work_email || email || '').trim().toLowerCase();
  if (!userEmail) {
    res.status(400).json({ detail: 'Work email is required.' });
    return;
  }

  const existing = await User.findOne({ email: userEmail });
  if (existing) {
    res.status(400).json({ detail: 'User account with this email already exists.' });
    return;
  }

  const nameParts = (full_name || '').trim().split(' ');
  const firstName = nameParts[0] || 'User';
  const lastName = nameParts.slice(1).join(' ') || '';

  const validSystemRoles = [
    'SUPER_ADMIN',
    'HR',
    'ADMIN',
    'ACCOUNTANT',
    'BDE',
    'TEAM_LEAD',
    'EMPLOYEE',
    'OPERATIONS',
    'OPERATIONS_HEAD',
  ];

  let initialRole: any = 'EMPLOYEE';
  if (role && validSystemRoles.includes(role.toUpperCase())) {
    initialRole = role.toUpperCase();
  } else if (dynamic_role_id && mongoose.Types.ObjectId.isValid(dynamic_role_id)) {
    const dynRole = await DynamicRole.findById(dynamic_role_id);
    if (dynRole && dynRole.code && validSystemRoles.includes(dynRole.code.trim().toUpperCase())) {
      initialRole = dynRole.code.trim().toUpperCase();
    }
  }

  const newUser = new User({
    username: userEmail,
    email: userEmail,
    firstName,
    lastName,
    role: initialRole,
    dynamicRole: dynamic_role_id && mongoose.Types.ObjectId.isValid(dynamic_role_id) ? dynamic_role_id : null,
    isActive: true,
    isStaff: false,
    isSuperuser: false,
  });

  const passToSet = initial_password || password || 'password123';
  await newUser.setPassword(passToSet);
  await newUser.save();

  const emp = new Employee({
    user: newUser._id,
    employeeCode: `EMP${Math.floor(1000 + Math.random() * 9000)}`,
    name: full_name || userEmail,
    email: userEmail,
    phone: '0000000000',
    joiningDate: new Date(),
    status: 'Active',
    designation: designation || 'Employee',
    department: department || 'General',
  });
  await emp.save();

  res.status(201).json({
    user_id: newUser._id,
    id: newUser._id,
    email: newUser.email,
    work_email: newUser.email,
    full_name: `${newUser.firstName} ${newUser.lastName}`.trim(),
  });
}

export async function resetSuperAdminUserPassword(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'User not found.' });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ detail: 'User not found.' });
    return;
  }

  const { password } = req.body;
  if (!password || password.length < 6) {
    res.status(400).json({ detail: 'Password must be at least 6 characters long.' });
    return;
  }

  await user.setPassword(password);
  await user.save();
  res.json({ detail: 'Password updated successfully.' });
}

export async function deleteSuperAdminUser(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'User not found.' });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ detail: 'User not found.' });
    return;
  }
  user.isActive = false;
  await user.save();
  res.status(200).json({ detail: 'User deactivated.' });
}
