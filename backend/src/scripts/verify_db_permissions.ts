import mongoose from 'mongoose';

const CANONICAL_PAGE_FEATURES: Record<string, { key: string; label: string; description?: string }[]> = {
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
    { key: 'evaluate_kpi', label: 'Evaluate Employee KPI', description: 'Can rate and rate KPI appraisals' },
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

async function syncAndVerify() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/flumenx_portal';
  await mongoose.connect(mongoUri);
  const db = mongoose.connection;

  console.log('1. Checking & updating portalpages collection in MongoDB...');
  const pages = await db.collection('portalpages').find({}).toArray();
  console.log(`Found ${pages.length} portal pages in database.`);

  let updatedPageCount = 0;
  for (const page of pages) {
    const canonicalFeatures = CANONICAL_PAGE_FEATURES[page.moduleCode] || [];
    const existingFeatures = page.features || [];
    const existingKeys = new Set(existingFeatures.map((f: any) => f.key));

    const missingFeatures = canonicalFeatures.filter((f) => !existingKeys.has(f.key));
    if (missingFeatures.length > 0) {
      const mergedFeatures = [...existingFeatures, ...missingFeatures];
      await db.collection('portalpages').updateOne(
        { _id: page._id },
        { $set: { features: mergedFeatures } }
      );
      console.log(`  ✓ Updated page [${page.moduleCode}] with missing features:`, missingFeatures.map((f) => f.key));
      updatedPageCount++;
    }
  }
  console.log(`Updated ${updatedPageCount} pages with missing features.`);

  // Verify TASKS page specifically
  const tasksPage = await db.collection('portalpages').findOne({ moduleCode: 'TASKS' });
  console.log('\n2. TASKS page features in MongoDB now:');
  console.log(JSON.stringify(tasksPage?.features, null, 2));

  // Check roles
  const roles = await db.collection('dynamicroles').find({}).toArray();
  console.log(`\n3. Verifying ${roles.length} Dynamic Roles for TASKS permissions:`);
  for (const role of roles) {
    const taskPerm = (role.permissions || []).find(
      (p: any) => p.page && p.page.toString() === tasksPage?._id.toString()
    );
    console.log(
      `  - Role [${role.code.padEnd(16)}] | canCreate: ${String(taskPerm?.canCreate).padEnd(5)} | bulk_create: ${String(taskPerm?.features?.includes('bulk_create')).padEnd(5)} | dataScope: ${taskPerm?.dataScope || (role.isSuperadminWildcard ? 'ALL' : 'DEFAULT')}`
    );
  }

  await mongoose.disconnect();
  console.log('\nSync & verification successfully finished.');
}

syncAndVerify().catch((err) => {
  console.error(err);
  process.exit(1);
});
