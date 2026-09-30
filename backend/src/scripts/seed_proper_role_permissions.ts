import mongoose from 'mongoose';

interface PermConfig {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  dataScope: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL';
  features?: string[];
}

const DEFAULT_ROLE_CONFIGS: Record<string, Record<string, PermConfig>> = {
  SUPER_ADMIN: {
    // Wildcard handles all
  },
  ADMIN: {
    // All modules full access
    ALL_MODULES_WILDCARD: { canView: true, canCreate: true, canEdit: true, canDelete: true, dataScope: 'ALL' },
  },
  TEAM_LEAD: {
    COMMAND_CENTER: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'TEAM', features: ['view_all_work'] },
    TASKS: { canView: true, canCreate: true, canEdit: true, canDelete: true, dataScope: 'TEAM', features: ['create_task', 'can_edit', 'review_tasks', 'delete_task', 'manage_labels'] },
    TEAM_WORK: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'TEAM' },
    ATTENDANCE: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'TEAM', features: ['view_register', 'reports_export'] },
    EMPLOYEE_TRACKING: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'TEAM', features: ['live_map', 'history_playback'] },
    LEAVES: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'TEAM', features: ['apply_leave', 'review_leave'] },
    EMPLOYEES: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'TEAM' },
    CLIENTS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'TEAM' },
    CLIENT_TASKS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'TEAM' },
    TIMELINE: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'TEAM' },
    KPI: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'TEAM' },
    MEETINGS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    CHAT: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL' },
    TIMER: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'OWN' },
    REPORTS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'TEAM' },
    SALARY_SLIPS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    ANNOUNCEMENTS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    TOOLS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    // Restricted
    ACCOUNTING: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    ROLES: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    SUPER_ADMIN_USERS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    PAGE_MANAGEMENT: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    AUDIT_LOGS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    SETTINGS_ACCESS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
  },
  HR: {
    COMMAND_CENTER: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['view_all_work', 'bulk_assign'] },
    EMPLOYEES: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['add_employee', 'edit_employee', 'manage_documents', 'edit_salary_info'] },
    ATTENDANCE: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['manual_entry', 'policy_settings', 'reports_export', 'view_register'] },
    LEAVES: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['apply_leave', 'review_leave', 'adjust_balance'] },
    EMPLOYEE_TRACKING: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['live_map', 'history_playback', 'geofence_alerts'] },
    SALARY_SLIPS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['generate_slips', 'view_payroll_reports', 'configure_structures'] },
    ANNOUNCEMENTS: { canView: true, canCreate: true, canEdit: true, canDelete: true, dataScope: 'ALL' },
    TASKS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['create_task', 'can_edit', 'review_tasks', 'manage_labels'] },
    TEAM_WORK: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    MEETINGS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    CHAT: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL' },
    TIMER: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'OWN' },
    REPORTS: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL' },
    CLIENTS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    CLIENT_TASKS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    TIMELINE: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    KPI: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    TOOLS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    // Restricted
    ACCOUNTING: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    ROLES: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    SUPER_ADMIN_USERS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    PAGE_MANAGEMENT: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    AUDIT_LOGS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    SETTINGS_ACCESS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
  },
  ACCOUNTANT: {
    ACCOUNTING: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['create_invoice', 'record_expense', 'reconcile_bank', 'export_reports', 'manage_accounts', 'manage_budgets'] },
    SALARY_SLIPS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['generate_slips', 'disburse_salary', 'export_bank_advice', 'view_payroll_reports', 'configure_structures'] },
    REPORTS: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL', features: ['export_reports'] },
    ATTENDANCE: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL', features: ['view_register', 'reports_export'] },
    EMPLOYEES: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL', features: ['edit_salary_info'] },
    CLIENTS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    CLIENT_TASKS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    COMMAND_CENTER: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    TASKS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    TEAM_WORK: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    TIMER: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'OWN' },
    CHAT: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL' },
    MEETINGS: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL' },
    ANNOUNCEMENTS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    TOOLS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    // Restricted
    ROLES: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    SUPER_ADMIN_USERS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    PAGE_MANAGEMENT: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    AUDIT_LOGS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    SETTINGS_ACCESS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
  },
  EMPLOYEE: {
    COMMAND_CENTER: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    TASKS: { canView: true, canCreate: false, canEdit: true, canDelete: false, dataScope: 'OWN', features: ['can_edit'] },
    TEAM_WORK: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    ATTENDANCE: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'OWN' },
    EMPLOYEE_TRACKING: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'OWN' },
    LEAVES: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'OWN', features: ['apply_leave'] },
    TIMER: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'OWN' },
    CHAT: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL' },
    MEETINGS: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL' },
    SALARY_SLIPS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    ANNOUNCEMENTS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    TOOLS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    KPI: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    EMPLOYEES: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    CLIENTS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    CLIENT_TASKS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    TIMELINE: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    REPORTS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    ACCOUNTING: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    ROLES: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    SUPER_ADMIN_USERS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    PAGE_MANAGEMENT: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    AUDIT_LOGS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    SETTINGS_ACCESS: { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
  },
  BDE: {
    COMMAND_CENTER: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['view_all_work'] },
    CLIENTS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    CLIENT_TASKS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['create_task', 'can_edit'] },
    TASKS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['create_task', 'can_edit', 'manage_labels'] },
    TIMELINE: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    ATTENDANCE: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'OWN' },
    LEAVES: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'OWN', features: ['apply_leave'] },
    TIMER: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'OWN' },
    CHAT: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL' },
    MEETINGS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    SALARY_SLIPS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    ANNOUNCEMENTS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    TOOLS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    REPORTS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
  },
  BDO: {
    COMMAND_CENTER: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['view_all_work'] },
    CLIENTS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    CLIENT_TASKS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['create_task', 'can_edit'] },
    TASKS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL', features: ['create_task', 'can_edit', 'manage_labels'] },
    TIMELINE: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    ATTENDANCE: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'OWN' },
    LEAVES: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'OWN', features: ['apply_leave'] },
    TIMER: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'OWN' },
    CHAT: { canView: true, canCreate: true, canEdit: false, canDelete: false, dataScope: 'ALL' },
    MEETINGS: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
    SALARY_SLIPS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' },
    ANNOUNCEMENTS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    TOOLS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
    REPORTS: { canView: true, canCreate: false, canEdit: false, canDelete: false, dataScope: 'ALL' },
  },
  OPERATIONS: {
    ALL_MODULES_WILDCARD: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
  },
  OPERATIONS_HEAD: {
    ALL_MODULES_WILDCARD: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
  },
  CFO: {
    ALL_MODULES_WILDCARD: { canView: true, canCreate: true, canEdit: true, canDelete: false, dataScope: 'ALL' },
  },
};

export async function seedProperRolePermissions() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_portal';
  console.log('================================================================');
  console.log('🛡️ SEEDING PROPER ROLE PERMISSIONS, DATA SCOPES & FEATURES');
  console.log('================================================================');
  console.log(`Connecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const pages = await db.collection('portalpages').find({}).toArray();
  const pageByCode: Record<string, any> = {};
  pages.forEach((p) => {
    pageByCode[p.moduleCode] = p;
  });

  const roles = await db.collection('dynamicroles').find({}).toArray();
  console.log(`Found ${roles.length} roles in database.`);

  for (const role of roles) {
    const roleCode = (role.code || '').toUpperCase();
    console.log(`\nConfiguring role: [${role.name}] (${roleCode})...`);

    if (roleCode === 'SUPER_ADMIN') {
      await db.collection('dynamicroles').updateOne(
        { _id: role._id },
        {
          $set: {
            isSuperadminWildcard: true,
            isSystemRole: true,
            status: 'ACTIVE',
            permissions: pages.map((p) => ({
              page: p._id,
              canView: true,
              canCreate: true,
              canEdit: true,
              canDelete: true,
              dataScope: 'ALL',
              features: (p.features || []).map((f: any) => f.key),
            })),
          },
        }
      );
      console.log(`  ✓ Super Admin set to Wildcard ALL permissions.`);
      continue;
    }

    const config = DEFAULT_ROLE_CONFIGS[roleCode];
    if (!config) {
      console.log(`  ℹ️ Custom role [${roleCode}] - preserving custom setup.`);
      continue;
    }

    const isWildcardRole = Boolean(config.ALL_MODULES_WILDCARD);
    const updatedPermissions: any[] = [];

    for (const page of pages) {
      const pageCode = page.moduleCode;
      let permConfig: PermConfig;

      if (isWildcardRole) {
        permConfig = config.ALL_MODULES_WILDCARD;
      } else if (config[pageCode]) {
        permConfig = config[pageCode];
      } else {
        // Default restricted for undefined modules
        permConfig = { canView: false, canCreate: false, canEdit: false, canDelete: false, dataScope: 'OWN' };
      }

      const availableFeatureKeys = (page.features || []).map((f: any) => f.key);
      const assignedFeatures = permConfig.features || (permConfig.canView && permConfig.canCreate ? availableFeatureKeys : []);

      updatedPermissions.push({
        page: page._id,
        canView: permConfig.canView,
        canCreate: permConfig.canCreate,
        canEdit: permConfig.canEdit,
        canDelete: permConfig.canDelete,
        dataScope: permConfig.dataScope,
        features: assignedFeatures,
      });
    }

    await db.collection('dynamicroles').updateOne(
      { _id: role._id },
      {
        $set: {
          permissions: updatedPermissions,
          status: 'ACTIVE',
        },
      }
    );

    console.log(`  ✓ Updated ${updatedPermissions.length} module permissions with proper data scopes & features.`);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL ROLES PROPERLY SEEDED WITH ENTERPRISE RBAC & DATA SCOPES!');
  console.log('================================================================');
  await mongoose.disconnect();
}

seedProperRolePermissions().catch((err) => {
  console.error('Role seeding failed:', err);
  process.exit(1);
});
