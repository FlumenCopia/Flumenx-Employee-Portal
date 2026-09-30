import { connectDB } from '../config/db.js';
import { PortalPage, IPageFeature } from '../models/PortalPage.js';
import { DynamicRole, DataScope } from '../models/DynamicRole.js';

export const MODULE_FEATURE_DEFINITIONS: Record<string, IPageFeature[]> = {
  ATTENDANCE: [
    { key: 'view_register', label: 'View Company Register Tab', description: 'Access the company-wide attendance register tab' },
    { key: 'manual_entry', label: '+ Manual Attendance Entry', description: 'Create manual check-in/out records for staff' },
    { key: 'policy_settings', label: 'GPS & Policy Settings', description: 'Configure office geofences, grace periods, and shift timings' },
    { key: 'reports_export', label: 'Attendance Reports & Export', description: 'Access monthly attendance matrix and export reports' },
  ],
  TASKS: [
    { key: 'create_task', label: 'Create New Task', description: 'Assign work to team members or employees' },
    { key: 'bulk_create', label: 'Bulk Create Tasks', description: 'Batch generate work assignments' },
    { key: 'delete_task', label: 'Delete Task', description: 'Remove individual work deliverables' },
    { key: 'delete_all', label: 'Delete All Tasks', description: 'Wipe all task assignments in bulk' },
    { key: 'adjust_time', label: 'Adjust Task Timer', description: 'Manually edit duration of recorded task time' },
    { key: 'review_tasks', label: 'Review Center Queue', description: 'Approve deliverables or request corrections' },
  ],
  TRACKING: [
    { key: 'live_map', label: 'Company Live Tracking Map', description: 'View real-time map of employee duty locations' },
    { key: 'record_location', label: 'GPS Location Transmission', description: 'Transmit device GPS location during shifts' },
  ],
  EMPLOYEE_TRACKING: [
    { key: 'live_map', label: 'Company Live Tracking Map', description: 'View real-time map of employee duty locations' },
    { key: 'record_location', label: 'GPS Location Transmission', description: 'Transmit device GPS location during shifts' },
  ],
  LEAVES: [
    { key: 'apply_leave', label: 'Apply Leave Request', description: 'Submit personal absence requests' },
    { key: 'review_leave', label: 'Review & Approve Leaves', description: 'Approve or reject leave applications for subordinates' },
    { key: 'manage_holidays', label: 'Manage Company Holidays', description: 'Add, edit, or remove company holiday dates' },
  ],
  EMPLOYEES: [
    { key: 'add_employee', label: 'Add New Employee', description: 'Onboard new staff with profile and department assignment' },
    { key: 'edit_employee', label: 'Edit Employee Profile', description: 'Update employee designation, team lead, and status' },
    { key: 'manage_documents', label: 'Manage Documents', description: 'Upload and delete official employee documentation' },
  ],
  REPORTS: [
    { key: 'export_reports', label: 'Export Reports Data', description: 'Download CSV / Excel / PDF audit summaries' },
    { key: 'view_payroll_reports', label: 'View Payroll & Financial Reports', description: 'Access analytical salary and disbursement reports' },
  ],
  ACCOUNTING: [
    { key: 'create_invoice', label: 'Create Invoices', description: 'Generate client billing vouchers' },
    { key: 'record_expense', label: 'Record Expenses', description: 'Add company expenditure vouchers' },
    { key: 'delete_records', label: 'Delete Financial Records', description: 'Permanently remove accounting records (Super Admin)' },
  ],
};

export async function migrateDynamicRbacV2() {
  await connectDB();

  console.log('================================================================================');
  console.log('=== PRODUCTION-SAFE DYNAMIC RBAC & DATA SCOPE MIGRATION V2 ===');
  console.log('================================================================================\n');

  // STEP 1: Update PortalPages with in-page feature definitions
  console.log('[Step 1] 📄 Registering feature definitions on PortalPages...');
  const allPages = await PortalPage.find();
  const pageMap: Record<string, any> = {};

  for (const page of allPages) {
    const code = page.moduleCode.trim().toUpperCase();
    pageMap[code] = page;
    const defFeatures = MODULE_FEATURE_DEFINITIONS[code];

    if (defFeatures && defFeatures.length > 0) {
      page.features = defFeatures;
      await page.save();
      console.log(`  ✓ Updated PortalPage "${page.title}" (${code}) with ${defFeatures.length} features.`);
    }
  }

  // STEP 2: In-place update of DynamicRoles with dataScope and features
  console.log('\n[Step 2] 🛡️ Upgrading Dynamic Roles in-place (Preserving all ObjectIds & User Links)...');
  const roles = await DynamicRole.find().sort({ name: 1 });
  console.log(`  Found ${roles.length} dynamic roles in database.`);

  let updatedRolesCount = 0;

  for (const role of roles) {
    const roleCode = (role.code || '').trim().toUpperCase();
    const isSuper = role.isSuperadminWildcard || roleCode === 'SUPER_ADMIN';
    const isAdmin = isSuper || roleCode === 'ADMIN' || roleCode === 'OPERATIONS' || roleCode === 'OPERATIONS_HEAD';
    const isHr = roleCode === 'HR';
    const isTeamLead = roleCode === 'TEAM_LEAD' || roleCode.includes('TEAM_LEAD') || roleCode.includes('LEAD');
    const isAccountant = roleCode === 'ACCOUNTANT' || roleCode === 'CFO';

    let roleModified = false;

    for (const perm of role.permissions) {
      if (!perm.page) continue;
      const pageDoc = allPages.find((p) => p._id.toString() === perm.page.toString());
      if (!pageDoc) continue;

      const moduleCode = pageDoc.moduleCode.trim().toUpperCase();
      const availableFeatures = (MODULE_FEATURE_DEFINITIONS[moduleCode] || []).map((f) => f.key);

      // 1. Determine baseline DataScope
      let defaultScope: DataScope = 'OWN';
      if (isSuper || isAdmin) {
        defaultScope = 'ALL';
      } else if (isHr) {
        defaultScope = ['ATTENDANCE', 'LEAVES', 'EMPLOYEES', 'TASKS', 'REPORTS', 'ANNOUNCEMENTS'].includes(moduleCode) ? 'ALL' : 'OWN';
      } else if (isTeamLead) {
        if (['TASKS', 'ATTENDANCE', 'LEAVES', 'TRACKING', 'EMPLOYEE_TRACKING'].includes(moduleCode)) {
          defaultScope = 'TEAM';
        } else if (moduleCode === 'EMPLOYEES') {
          defaultScope = 'DEPARTMENT';
        } else {
          defaultScope = 'OWN';
        }
      } else if (isAccountant) {
        defaultScope = ['ACCOUNTING', 'SALARY_SLIPS', 'ATTENDANCE', 'REPORTS'].includes(moduleCode) ? 'ALL' : 'OWN';
      } else {
        defaultScope = 'OWN';
      }

      // Preserve existing dataScope if already assigned, otherwise backfill default
      if (!perm.dataScope) {
        perm.dataScope = defaultScope;
        roleModified = true;
      }

      // 2. Determine baseline Features
      const currentFeatures = new Set(perm.features || []);

      if (isSuper) {
        // Super admin gets all features
        for (const feat of availableFeatures) currentFeatures.add(feat);
      } else if (isAdmin) {
        for (const feat of availableFeatures) {
          if (feat !== 'delete_records' || isSuper) currentFeatures.add(feat);
        }
      } else if (isHr) {
        if (moduleCode === 'ATTENDANCE') {
          currentFeatures.add('view_register');
          currentFeatures.add('manual_entry');
          currentFeatures.add('reports_export');
        }
        if (moduleCode === 'LEAVES') {
          currentFeatures.add('apply_leave');
          currentFeatures.add('review_leave');
          currentFeatures.add('manage_holidays');
        }
        if (moduleCode === 'EMPLOYEES') {
          currentFeatures.add('add_employee');
          currentFeatures.add('edit_employee');
          currentFeatures.add('manage_documents');
        }
        if (moduleCode === 'TASKS') {
          currentFeatures.add('create_task');
          currentFeatures.add('review_tasks');
        }
        if (moduleCode === 'TRACKING' || moduleCode === 'EMPLOYEE_TRACKING') {
          currentFeatures.add('live_map');
        }
      } else if (isTeamLead) {
        if (moduleCode === 'TASKS') {
          currentFeatures.add('create_task');
          currentFeatures.add('review_tasks');
        }
        if (moduleCode === 'ATTENDANCE') {
          currentFeatures.add('view_register');
          currentFeatures.add('reports_export');
        }
        if (moduleCode === 'LEAVES') {
          currentFeatures.add('apply_leave');
          currentFeatures.add('review_leave');
        }
        if (moduleCode === 'TRACKING' || moduleCode === 'EMPLOYEE_TRACKING') {
          currentFeatures.add('live_map');
          currentFeatures.add('record_location');
        }
      } else if (isAccountant) {
        if (moduleCode === 'ACCOUNTING') {
          currentFeatures.add('create_invoice');
          currentFeatures.add('record_expense');
        }
        if (moduleCode === 'ATTENDANCE') {
          currentFeatures.add('view_register');
          currentFeatures.add('reports_export');
        }
      } else {
        // Standard Employee / BDE / BDO
        if (moduleCode === 'LEAVES') currentFeatures.add('apply_leave');
        if (moduleCode === 'TRACKING' || moduleCode === 'EMPLOYEE_TRACKING') currentFeatures.add('record_location');
      }

      // If canCreate is true, automatically enable standard creation features
      if (perm.canCreate) {
        if (availableFeatures.includes('create_task')) currentFeatures.add('create_task');
        if (availableFeatures.includes('manual_entry')) currentFeatures.add('manual_entry');
        if (availableFeatures.includes('apply_leave')) currentFeatures.add('apply_leave');
      }

      const nextFeatures = Array.from(currentFeatures);
      if (JSON.stringify(perm.features) !== JSON.stringify(nextFeatures)) {
        perm.features = nextFeatures;
        roleModified = true;
      }
    }

    if (roleModified) {
      await role.save();
      updatedRolesCount++;
      console.log(`  ✓ Upgraded Role "${role.name}" (${role.code}): in-place dataScope and features backfilled.`);
    } else {
      console.log(`  - Role "${role.name}" (${role.code}): already up to date.`);
    }
  }

  console.log(`\n[Summary] Successfully updated ${updatedRolesCount} of ${roles.length} Dynamic Roles in-place.`);
  console.log('✅ PRODUCTION RBAC V2 MIGRATION COMPLETE WITH ZERO DOWNTIME.\n');
}

migrateDynamicRbacV2()
  .then(() => {
    console.log('Migration completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
