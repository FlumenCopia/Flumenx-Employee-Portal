import mongoose from 'mongoose';

const DEFAULT_PAGE_FEATURES: Record<string, { key: string; label: string; description?: string }[]> = {
  COMMAND_CENTER: [
    { key: 'view_all_work', label: 'View All Work Across Company', description: 'Can monitor all active tasks and assignments' },
    { key: 'bulk_assign', label: 'Bulk Assignment', description: 'Can mass re-assign work between teams' },
  ],
  TASKS: [
    { key: 'create_task', label: 'Create New Tasks', description: 'Can create work cards and tasks' },
    { key: 'can_edit', label: 'Edit Tasks', description: 'Can update task progress and details' },
    { key: 'review_tasks', label: 'Review & Verify Tasks', description: 'Can review submissions and approve work' },
    { key: 'delete_task', label: 'Delete Tasks', description: 'Can permanently remove tasks' },
    { key: 'manage_labels', label: 'Manage Labels & Priorities', description: 'Can create labels and change priorities' },
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
  EMPLOYEES: [
    { key: 'add_employee', label: 'Add New Employee', description: 'Can onboard new staff members' },
    { key: 'edit_employee', label: 'Edit Employee Profile', description: 'Can update designations, phones, and addresses' },
    { key: 'manage_documents', label: 'Manage KYC & Documents', description: 'Can upload and verify contracts and IDs' },
    { key: 'edit_salary_info', label: 'Edit Salary & Compensation', description: 'Can view and modify base pay details' },
    { key: 'terminate_employee', label: 'Offboard / Terminate', description: 'Can deactivate employee accounts' },
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
};

const CANONICAL_PATH_UPDATES: Record<string, string> = {
  ROLES: '/roles',
  SUPER_ADMIN_USERS: '/users',
  SALARY_SLIPS: '/salary-slips',
  ANNOUNCEMENTS: '/announcements',
  AUDIT_LOGS: '/audit-logs',
};

export async function runProductionMigration() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_portal';
  console.log('================================================================');
  console.log('🛠️ FLUMENX PORTAL SAFE PRODUCTION MIGRATION');
  console.log('================================================================');
  console.log(`Connecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  // 1. UPDATE PORTAL PAGES TO CANONICAL URLS
  console.log('\n[1/4] Updating PortalPages canonical routes & granular features...');
  const pages = await db.collection('portalpages').find({}).toArray();

  for (const page of pages) {
    const canonicalRoute = CANONICAL_PATH_UPDATES[page.moduleCode];
    const features = DEFAULT_PAGE_FEATURES[page.moduleCode] || [];

    const updates: any = {};
    if (canonicalRoute && page.routePath !== canonicalRoute) {
      updates.routePath = canonicalRoute;
      console.log(`  ✓ Updated [${page.moduleCode}] routePath: ${page.routePath} -> ${canonicalRoute}`);
    }

    if (!page.features || page.features.length === 0) {
      if (features.length > 0) {
        updates.features = features;
        console.log(`  ✓ Added ${features.length} granular features to [${page.moduleCode}]`);
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('portalpages').updateOne({ _id: page._id }, { $set: updates });
    }
  }

  // 2. VERIFY DYNAMIC ROLES STATUS
  console.log('\n[2/4] Ensuring DynamicRoles have valid status...');
  const roleUpdateResult = await db.collection('dynamicroles').updateMany(
    { $or: [{ status: { $exists: false } }, { status: null }] },
    { $set: { status: 'ACTIVE' } }
  );
  console.log(`  ✓ Updated ${roleUpdateResult.modifiedCount} dynamic roles with default status 'ACTIVE'.`);

  // 3. FIX ORPHAN DYNAMIC ROLES IN USERS
  console.log('\n[3/4] Checking and fixing orphan user dynamicRole references...');
  const allRoles = await db.collection('dynamicroles').find({}).toArray();
  const validRoleIds = new Set(allRoles.map((r) => r._id.toString()));
  const employeeRole = allRoles.find((r) => r.code === 'EMPLOYEE');

  const users = await db.collection('users').find({}).toArray();
  for (const u of users) {
    if (u.dynamicRole) {
      const dIdStr = u.dynamicRole.toString();
      if (!validRoleIds.has(dIdStr)) {
        console.warn(`  ⚠️ Found orphan dynamicRole on user [${u.email}] (id: ${dIdStr}).`);
        if (employeeRole) {
          await db.collection('users').updateOne(
            { _id: u._id },
            { $set: { dynamicRole: employeeRole._id } }
          );
          console.log(`  ✓ Re-linked user [${u.email}] to valid EMPLOYEE role.`);
        }
      }
    }
  }

  // 4. VERIFY REQUISITE INDEXES
  console.log('\n[4/4] Ensuring production database indexes...');
  await db.collection('portalpages').createIndex({ moduleCode: 1 }, { unique: true, background: true });
  await db.collection('portalpages').createIndex({ sidebarOrder: 1 }, { background: true });
  await db.collection('dynamicroles').createIndex({ code: 1 }, { unique: true, background: true });
  console.log('  ✓ Verified indexes on portalpages and dynamicroles.');

  console.log('\n================================================================');
  console.log('🎉 PRODUCTION MIGRATION COMPLETED SAFELY AND SUCCESSFULLY!');
  console.log('================================================================');
  await mongoose.disconnect();
}

runProductionMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
