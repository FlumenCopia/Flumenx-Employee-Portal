import mongoose from 'mongoose';

async function analyze() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_portal';
  console.log(`Connecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);

  const db = mongoose.connection.db;
  if (!db) {
    console.error('No db handle');
    process.exit(1);
  }

  const collections = await db.listCollections().toArray();
  console.log('\n================================================================');
  console.log(`📦 TOTAL COLLECTIONS IN PRODUCTION BACKUP: ${collections.length}`);
  console.log('================================================================');

  const collCounts: Record<string, number> = {};
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    collCounts[c.name] = count;
  }

  // Sort by name
  const sortedNames = Object.keys(collCounts).sort();
  for (const name of sortedNames) {
    console.log(`  - ${name.padEnd(30)} : ${collCounts[name]} documents`);
  }

  // 1. Inspect Users
  console.log('\n================================================================');
  console.log('👥 USERS IN PRODUCTION BACKUP');
  console.log('================================================================');
  const users = await db.collection('users').find({}).toArray();
  console.log(`Total users: ${users.length}`);

  const roleDistribution: Record<string, number> = {};
  for (const u of users) {
    const r = u.portal_role || u.role || 'NO_ROLE';
    roleDistribution[r] = (roleDistribution[r] || 0) + 1;
  }
  console.log('Role distribution in users collection:');
  console.dir(roleDistribution);

  console.log('\nSample users:');
  for (const u of users.slice(0, 10)) {
    console.log(`  - [${u.email}] role="${u.role}" portal_role="${u.portal_role}" custom_role_id="${u.custom_role_id}" isActive=${u.is_active ?? u.isActive}`);
  }

  // 2. Inspect DynamicRoles
  console.log('\n================================================================');
  console.log('🛡️ DYNAMIC ROLES IN PRODUCTION BACKUP');
  console.log('================================================================');
  if (collections.some(c => c.name === 'dynamicroles')) {
    const dynamicRoles = await db.collection('dynamicroles').find({}).toArray();
    console.log(`Total dynamic roles: ${dynamicRoles.length}`);
    for (const r of dynamicRoles) {
      console.log(`  - Code: [${r.code}] Name: "${r.name}" SystemRole: ${r.isSystemRole} Status: ${r.status} PermissionsCount: ${r.permissions?.length || 0}`);
    }
  } else {
    console.log('  ⚠️ dynamicroles collection DOES NOT EXIST in production backup!');
  }

  // 3. Inspect PortalPages / Pages
  console.log('\n================================================================');
  console.log('📄 PORTAL PAGES IN PRODUCTION BACKUP');
  console.log('================================================================');
  if (collections.some(c => c.name === 'portalpages')) {
    const pages = await db.collection('portalpages').find({}).toArray();
    console.log(`Total portalpages: ${pages.length}`);
    for (const p of pages) {
      console.log(`  - Slug: [${p.slug}] ModuleCode: [${p.module_code}] Path: [${p.canonical_path || p.path}]`);
    }
  } else if (collections.some(c => c.name === 'pages')) {
    const pages = await db.collection('pages').find({}).toArray();
    console.log(`Total pages: ${pages.length}`);
    for (const p of pages) {
      console.log(`  - Slug: [${p.slug}] Title: "${p.title}" Module: [${p.module_code}]`);
    }
  } else {
    console.log('  ⚠️ Neither portalpages nor pages collection exists in production backup!');
  }

  // 4. Inspect RolePermissions / Permissions
  console.log('\n================================================================');
  console.log('🔑 ROLE PERMISSIONS IN PRODUCTION BACKUP');
  console.log('================================================================');
  if (collections.some(c => c.name === 'rolepermissions')) {
    const count = await db.collection('rolepermissions').countDocuments();
    console.log(`Total rolepermissions: ${count}`);
  } else {
    console.log('  ⚠️ rolepermissions collection DOES NOT EXIST in production backup!');
  }

  // 5. Inspect Attendance, Tasks, Leaves, Salaries, Invoices
  console.log('\n================================================================');
  console.log('📊 CORE BUSINESS DATA COUNTS');
  console.log('================================================================');
  const checkColls = ['attendances', 'tasks', 'leaves', 'salaries', 'salaryslips', 'invoices', 'projects', 'clients', 'chatmessages'];
  for (const c of checkColls) {
    if (collections.some(col => col.name === c)) {
      const cnt = await db.collection(c).countDocuments();
      console.log(`  - ${c}: ${cnt} records`);
    }
  }

  await mongoose.disconnect();
}

analyze().catch(console.error);
