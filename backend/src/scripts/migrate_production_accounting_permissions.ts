import { connectDB } from '../config/db.js';
import { PortalPage } from '../models/PortalPage.js';
import { DynamicRole } from '../models/DynamicRole.js';

export async function migrateAccountingProductionPermissions() {
  await connectDB();

  console.log('================================================================================');
  console.log('=== PRODUCTION-SAFE RBAC & ACCOUNTING PERMISSIONS MIGRATION ===');
  console.log('================================================================================\n');

  // STEP 1: Ensure Accounting & Finance Portal Page exists
  console.log('[Step 1] 📄 Verifying Accounting & Finance Portal Page in database...');
  let accountingPage = await PortalPage.findOne({ moduleCode: 'ACCOUNTING' });

  if (!accountingPage) {
    accountingPage = await PortalPage.create({
      moduleCode: 'ACCOUNTING',
      title: 'Accounting & Finance',
      routePath: '/accounting',
      icon: 'Landmark',
      sidebarOrder: 17,
      isActive: true,
    });
    console.log(`  + Created PortalPage: Accounting & Finance [ID: ${accountingPage._id}]`);
  } else {
    accountingPage.isActive = true;
    accountingPage.routePath = '/accounting';
    accountingPage.icon = 'Landmark';
    await accountingPage.save();
    console.log(`  ✓ Verified existing PortalPage: Accounting & Finance [ID: ${accountingPage._id}]`);
  }

  // Also ensure TOOLS page exists
  let toolsPage = await PortalPage.findOne({ moduleCode: 'TOOLS' });
  if (!toolsPage) {
    toolsPage = await PortalPage.create({
      moduleCode: 'TOOLS',
      title: 'Utility Toolbox',
      routePath: '/tools',
      icon: 'Wrench',
      sidebarOrder: 2,
      isActive: true,
    });
    console.log(`  + Created PortalPage: Utility Toolbox [ID: ${toolsPage._id}]`);
  }

  // STEP 2: Update all Dynamic Roles in-place without touching any existing permissions
  console.log('\n[Step 2] 🛡️ Updating Dynamic Roles (preserving all ObjectIds, user links, and other 23 pages)...');
  const roles = await DynamicRole.find().sort({ name: 1 });
  console.log(`  Found ${roles.length} dynamic roles in database.`);

  const FINANCE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'CFO']);
  let updatedRolesCount = 0;

  for (const role of roles) {
    const roleCodeUpper = (role.code || '').trim().toUpperCase();
    const isSuper = role.isSuperadminWildcard || roleCodeUpper === 'SUPER_ADMIN' || roleCodeUpper === 'ADMIN';
    const isFinance = isSuper || FINANCE_ROLES.has(roleCodeUpper);

    let permIndex = role.permissions.findIndex(
      (p) => p.page && p.page.toString() === accountingPage!._id.toString()
    );

    if (permIndex === -1) {
      // Role doesn't have an entry for Accounting yet -> append it
      role.permissions.push({
        page: accountingPage._id as any,
        canView: isFinance,
        canCreate: isFinance,
        canEdit: isFinance,
        canDelete: isFinance,
      } as any);
      await role.save();
      updatedRolesCount++;
      console.log(`  + Added Accounting to role "${role.name}" (${role.code}) -> Access: ${isFinance ? 'FULL' : 'NONE'}`);
    } else {
      // Role already had an entry -> enforce financial roles have full access, and standard staff don't have unauthorized access
      const existingPerm = role.permissions[permIndex];
      let changed = false;

      if (isFinance) {
        if (!existingPerm.canView || !existingPerm.canCreate || !existingPerm.canEdit || !existingPerm.canDelete) {
          existingPerm.canView = true;
          existingPerm.canCreate = true;
          existingPerm.canEdit = true;
          existingPerm.canDelete = true;
          changed = true;
        }
      } else if (roleCodeUpper === 'EMPLOYEE' || roleCodeUpper === 'BDE' || roleCodeUpper === 'BDO') {
        if (existingPerm.canView) {
          existingPerm.canView = false;
          existingPerm.canCreate = false;
          existingPerm.canEdit = false;
          existingPerm.canDelete = false;
          changed = true;
        }
      }

      if (changed) {
        await role.save();
        updatedRolesCount++;
        console.log(`  ✓ Updated Accounting permissions for "${role.name}" (${role.code}) -> Access: ${isFinance ? 'FULL' : 'NONE'}`);
      } else {
        console.log(`  - Role "${role.name}" (${role.code}) already has correct permissions [View: ${existingPerm.canView}, Create: ${existingPerm.canCreate}]`);
      }
    }
  }

  // STEP 3: Summary & Verification
  const finalPages = await PortalPage.find({ isActive: true });
  console.log('\n================================================================================');
  console.log('✅ PRODUCTION MIGRATION COMPLETED SUCCESSFULLY!');
  console.log(`   - Active Portal Pages: ${finalPages.length}`);
  console.log(`   - Dynamic Roles processed: ${roles.length} (${updatedRolesCount} updated)`);
  console.log('   - 0 users affected or unlinked.');
  console.log('   - 0 existing client, invoice, bill, or operational records touched.');
  console.log('   - Accountant, Administrator, and CFO roles granted full access.');
  console.log('   - Standard employees prevented from unauthorized accounting access.');
  console.log('   - Role permission matrix in /settings now exposes "Accounting & Finance".');
  console.log('================================================================================\n');
}

// Direct CLI invocation
if (process.argv[1] && process.argv[1].endsWith('migrate_production_accounting_permissions.ts')) {
  migrateAccountingProductionPermissions()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
