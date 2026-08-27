import { connectDB } from '../config/db.js';
import { PortalPage } from '../models/PortalPage.js';
import { DynamicRole } from '../models/DynamicRole.js';
import { Department } from '../models/Department.js';
import { User, UserRoleType } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';

async function seed() {
  await connectDB();
  console.log('[Seed] Starting core system seed (Super Admin, Roles, Pages, Departments)...');

  // 1. Seed Portal Pages
  const pagesData = [
    { moduleCode: 'TASKS', title: 'Task Board', routePath: '/work?view=kanban', icon: 'Kanban', sidebarOrder: 1 },
    { moduleCode: 'TIMER', title: 'Time Tracker', routePath: '/timer', icon: 'Clock3', sidebarOrder: 2 },
    { moduleCode: 'TEAM_WORK', title: 'Team Work', routePath: '/team-work', icon: 'Users', sidebarOrder: 3 },
    { moduleCode: 'KPI', title: 'KPI Performance', routePath: '/kpi', icon: 'TrendingUp', sidebarOrder: 4 },
    { moduleCode: 'EMPLOYEES', title: 'Employees Directory', routePath: '/employees', icon: 'Users', sidebarOrder: 5 },
    { moduleCode: 'ATTENDANCE', title: 'Attendance', routePath: '/attendance', icon: 'CalendarCheck', sidebarOrder: 6 },
    { moduleCode: 'LEAVES', title: 'Leave Requests', routePath: '/leaves', icon: 'CalendarDays', sidebarOrder: 7 },
    { moduleCode: 'MEETINGS', title: 'Meetings', routePath: '/meetings', icon: 'UserRound', sidebarOrder: 8 },
    { moduleCode: 'ROLES', title: 'Dynamic Roles', routePath: '/admin/roles', icon: 'ShieldAlert', sidebarOrder: 9 },
    { moduleCode: 'SUPER_ADMIN_USERS', title: 'User Management', routePath: '/admin/users', icon: 'UserCheck', sidebarOrder: 10 },
    { moduleCode: 'PAGE_MANAGEMENT', title: 'Page Management', routePath: '/pages', icon: 'FileCode', sidebarOrder: 11 },
    { moduleCode: 'SALARY_SLIPS', title: 'Salary Slips', routePath: '/admin/salary-slips', icon: 'Receipt', sidebarOrder: 12 },
    { moduleCode: 'ANNOUNCEMENTS', title: 'Announcements', routePath: '/admin/announcements', icon: 'Megaphone', sidebarOrder: 13 },
    { moduleCode: 'AUDIT_LOGS', title: 'Audit Logs', routePath: '/admin/audit-logs', icon: 'History', sidebarOrder: 14 },
    { moduleCode: 'REPORTS', title: 'Reports Center', routePath: '/reports', icon: 'FileSpreadsheet', sidebarOrder: 15 },
    { moduleCode: 'SETTINGS_ACCESS', title: 'Settings & Access', routePath: '/settings', icon: 'Settings', sidebarOrder: 16 },
  ];

  const pageDocMap: Record<string, any> = {};

  for (const p of pagesData) {
    let pageObj = await PortalPage.findOne({ moduleCode: p.moduleCode });
    if (!pageObj) {
      pageObj = new PortalPage({ ...p, isActive: true });
    } else {
      pageObj.title = p.title;
      pageObj.routePath = p.routePath;
      pageObj.icon = p.icon;
      pageObj.sidebarOrder = p.sidebarOrder;
      pageObj.isActive = true;
    }
    await pageObj.save();
    pageDocMap[p.moduleCode] = pageObj;
  }
  console.log(`[Seed] Seeded ${Object.keys(pageDocMap).length} Portal Pages.`);

  // 2. Seed Dynamic Roles
  const rolesData = [
    { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full wildcard access to all pages and settings', isSuperadminWildcard: true, isSystemRole: true },
    { code: 'ADMIN', name: 'Administrator', description: 'Full portal management access', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'HR', name: 'Human Resources', description: 'HR Manager with employee, leave, attendance, and KPI access', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'ACCOUNTANT', name: 'Accountant', description: 'Accountant with financial and salary slip access', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'TEAM_LEAD', name: 'Team Lead', description: 'Team Leader managing tasks and performance', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'EMPLOYEE', name: 'Employee', description: 'Regular employee with self-service portal access', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'BDE', name: 'Business Development', description: 'BDE managing clients and proposals', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'OPERATIONS', name: 'Operations', description: 'Operations Specialist managing daily deliverables', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'OPERATIONS_HEAD', name: 'Operations Head', description: 'Head of Operations overseeing team deliverables', isSuperadminWildcard: false, isSystemRole: true },
  ];

  const roleDocMap: Record<string, any> = {};

  for (const r of rolesData) {
    let roleObj = await DynamicRole.findOne({ code: r.code });
    if (!roleObj) {
      roleObj = new DynamicRole({ ...r, permissions: [] });
    } else {
      roleObj.name = r.name;
      roleObj.description = r.description;
      roleObj.isSuperadminWildcard = r.isSuperadminWildcard;
      roleObj.isSystemRole = r.isSystemRole;
    }

    const ROLE_MODULE_MAP: Record<string, string[]> = {
      SUPER_ADMIN: Object.keys(pageDocMap),
      ADMIN: Object.keys(pageDocMap),
      OPERATIONS: Object.keys(pageDocMap),
      OPERATIONS_HEAD: Object.keys(pageDocMap),
      HR: ['TASKS', 'TIMER', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'KPI', 'SALARY_SLIPS', 'ANNOUNCEMENTS', 'REPORTS'],
      ACCOUNTANT: ['TASKS', 'TIMER', 'ATTENDANCE', 'LEAVES', 'SALARY_SLIPS', 'MEETINGS', 'ANNOUNCEMENTS', 'REPORTS'],
      TEAM_LEAD: ['TASKS', 'TIMER', 'TEAM_WORK', 'KPI', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'REPORTS'],
      BDE: ['TASKS', 'TIMER', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS'],
      EMPLOYEE: ['TASKS', 'TIMER', 'KPI', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS'],
    };

    const allowed = ROLE_MODULE_MAP[r.code] || ['TASKS', 'ATTENDANCE', 'LEAVES', 'MEETINGS'];
    roleObj.permissions = allowed
      .map((mod) => pageDocMap[mod])
      .filter(Boolean)
      .map((page) => ({
        page: page._id,
        canView: true,
        canCreate: r.code === 'ADMIN' || r.code === 'SUPER_ADMIN' || r.code === 'HR',
        canEdit: r.code === 'ADMIN' || r.code === 'SUPER_ADMIN' || r.code === 'HR',
        canDelete: r.code === 'ADMIN' || r.code === 'SUPER_ADMIN',
      }));

    await roleObj.save();
    roleDocMap[r.code] = roleObj;
  }
  console.log(`[Seed] Seeded ${Object.keys(roleDocMap).length} Dynamic Roles.`);

  // 3. Seed Departments
  const deptData = [
    { code: 'OPERATIONS', name: 'Operations', description: 'Core agency operations and deliverable management', displayOrder: 1 },
    { code: 'WEB_DEV', name: 'Web Development', description: 'Frontend, backend, and full stack web solutions', displayOrder: 2 },
    { code: 'VIDEO_EDITING', name: 'Video Editing', description: 'Video post-production, motion graphics, and content editing', displayOrder: 3 },
    { code: 'DESIGN', name: 'Design', description: 'UI/UX design, branding, and graphics design', displayOrder: 4 },
    { code: 'DIGITAL_MARKETING', name: 'Digital Marketing', description: 'SEO, social media marketing, and growth campaigns', displayOrder: 5 },
    { code: 'HR', name: 'HR', description: 'Human resources, talent management, and employee welfare', displayOrder: 6 },
    { code: 'ACCOUNTANT', name: 'Accountant', description: 'Financial management, payroll, and billing', displayOrder: 7 },
  ];

  for (const d of deptData) {
    let deptObj = await Department.findOne({ $or: [{ name: d.name }, { code: d.code }] });
    if (!deptObj) {
      deptObj = new Department({ ...d, isActive: true });
    } else {
      deptObj.name = d.name;
      deptObj.code = d.code;
      deptObj.description = d.description;
      deptObj.displayOrder = d.displayOrder;
      deptObj.isActive = true;
    }
    await deptObj.save();
  }
  console.log('[Seed] Seeded Departments.');

  // 4. Ensure Super Admin User & Employee profile exist
  const superAdminRole = roleDocMap['SUPER_ADMIN'];
  let superAdminUser = await User.findOne({ email: 'admin@flumenx.com' });
  if (!superAdminUser) {
    superAdminUser = new User({
      username: 'admin',
      email: 'admin@flumenx.com',
      password: 'password123',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      dynamicRole: superAdminRole._id,
      isSuperuser: true,
      isStaff: true,
      isActive: true,
    });
    await superAdminUser.save();
    console.log('[Seed] Created default Super Admin user: admin@flumenx.com / password123');
  } else {
    superAdminUser.role = 'SUPER_ADMIN';
    superAdminUser.dynamicRole = superAdminRole._id;
    superAdminUser.isSuperuser = true;
    superAdminUser.isStaff = true;
    await superAdminUser.save();
    console.log('[Seed] Updated Super Admin user permissions.');
  }

  let superAdminEmp = await Employee.findOne({ email: 'admin@flumenx.com' });
  if (!superAdminEmp) {
    superAdminEmp = new Employee({
      user: superAdminUser._id,
      employeeCode: 'FX-001',
      name: 'Super Admin',
      email: 'admin@flumenx.com',
      phone: '+91 9876543210',
      department: 'Operations',
      designation: 'Super Administrator',
      joiningDate: new Date(),
      status: 'Active',
    });
    await superAdminEmp.save();
    console.log('[Seed] Created Super Admin Employee profile.');
  }

  // 5. Seed Employee Team & Team Leads
  const employeesToSeed = [
    {
      name: 'Dhishunjith k',
      email: 'dhishunjith@flumenx.com',
      designation: 'DM Team Lead',
      department: 'Digital Marketing',
      role: 'TEAM_LEAD',
      code: 'FX-002',
    },
    {
      name: 'Najil Rahman P.M.',
      email: 'najilrahmanflumenx@gmail.com',
      designation: 'Senior web developer',
      department: 'Web Development',
      role: 'TEAM_LEAD',
      code: 'FX-003',
    },
    {
      name: 'Nidhin KG',
      email: 'nidhinkgflumenx@gmail.com',
      designation: 'Junior web developer',
      department: 'Web Development',
      role: 'EMPLOYEE',
      code: 'FX-004',
      leadEmail: 'najilrahmanflumenx@gmail.com',
    },
    {
      name: 'Ebi Lawrence',
      email: 'ebilawrenceflumenx@gmail.com',
      designation: 'Junior Graphic Designer',
      department: 'Design',
      role: 'EMPLOYEE',
      code: 'FX-005',
      leadEmail: 'dhishunjith@flumenx.com',
    },
    {
      name: 'Abeyson p mathew',
      email: 'abeysonpmathewflumenx@gmail.com',
      designation: 'HR',
      department: 'Human Resources',
      role: 'HR',
      code: 'FX-006',
    },
    {
      name: 'Anurag J S',
      email: 'anuragjsflumenx@gmail.com',
      designation: 'BDM',
      department: 'Business Development',
      role: 'BDE',
      code: 'FX-007',
    },
    {
      name: 'Shrijith',
      email: 'Shreejithspillaiflumencopia@gmail.com',
      designation: 'Senior Graphic Designer',
      department: 'Design',
      role: 'EMPLOYEE',
      code: 'FX-008',
      leadEmail: 'dhishunjith@flumenx.com',
    },
    {
      name: 'Anandhu R S',
      email: 'anandhursflumenx@gmail.com',
      designation: 'Accountant',
      department: 'Accounts',
      role: 'ACCOUNTANT',
      code: 'FX-009',
    },
    {
      name: 'Anandu anil',
      email: 'ananduanilflumenx@gmail.com',
      designation: 'Video editor',
      department: 'Video Editing',
      role: 'EMPLOYEE',
      code: 'FX-010',
      leadEmail: 'dhishunjith@flumenx.com',
    },
    {
      name: 'Gowtham Vijay',
      email: 'gowthamvijayflumenx@gmail.com',
      designation: 'Digital Marketing Executive',
      department: 'Digital Marketing',
      role: 'EMPLOYEE',
      code: 'FX-011',
      leadEmail: 'dhishunjith@flumenx.com',
    },
    {
      name: 'NiKhil A. V.',
      email: 'nikhilavflumenx@gmail.com',
      designation: 'Digital Marketing Executive',
      department: 'Digital Marketing',
      role: 'EMPLOYEE',
      code: 'FX-012',
      leadEmail: 'dhishunjith@flumenx.com',
    },
    {
      name: 'Akhil S. S.',
      email: 'akhilsflumencopia@gmail.com',
      designation: 'Junior web developer',
      department: 'Web Development',
      role: 'EMPLOYEE',
      code: 'FX-013',
      leadEmail: 'najilrahmanflumenx@gmail.com',
    },
    {
      name: 'Rahul B Chandran',
      email: 'rahulchandran883@gmail.com',
      designation: 'Digital marketing intern',
      department: 'Digital Marketing',
      role: 'EMPLOYEE',
      code: 'FX-014',
      leadEmail: 'dhishunjith@flumenx.com',
    },
  ];

  const empDocMap: Record<string, any> = {};

  // First pass: Create Users & Employees
  for (const item of employeesToSeed) {
    const cleanEmail = item.email.trim().toLowerCase();
    let u = await User.findOne({ email: cleanEmail });
    const matchedRole = roleDocMap[item.role] || roleDocMap['EMPLOYEE'];

    if (!u) {
      const parts = item.name.trim().split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || '';
      const username = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');

      u = new User({
        username,
        email: cleanEmail,
        password: 'password123',
        firstName,
        lastName,
        role: item.role as UserRoleType,
        dynamicRole: matchedRole ? matchedRole._id : null,
        isStaff: item.role === 'TEAM_LEAD' || item.role === 'HR',
        isActive: true,
      });
      await u.save();
    } else {
      u.role = item.role as UserRoleType;
      if (matchedRole) u.dynamicRole = matchedRole._id;
      await u.save();
    }

    let emp = await Employee.findOne({ email: cleanEmail });
    const deptObj = await Department.findOne({ name: item.department });

    if (!emp) {
      emp = new Employee({
        user: u._id,
        employeeCode: item.code,
        name: item.name.trim(),
        email: cleanEmail,
        phone: '+91 9876543210',
        department: item.department,
        departmentRef: deptObj ? deptObj._id : null,
        designation: item.designation,
        joiningDate: new Date(),
        status: 'Active',
      });
      await emp.save();
    } else {
      emp.user = u._id;
      emp.employeeCode = item.code;
      emp.department = item.department;
      if (deptObj) emp.departmentRef = deptObj._id;
      emp.designation = item.designation;
      await emp.save();
    }

    empDocMap[cleanEmail] = emp;
  }

  // Second pass: Assign Team Leads
  for (const item of employeesToSeed) {
    if (item.leadEmail && empDocMap[item.leadEmail.trim().toLowerCase()]) {
      const emp = empDocMap[item.email.trim().toLowerCase()];
      const leadEmp = empDocMap[item.leadEmail.trim().toLowerCase()];
      if (emp && leadEmp) {
        emp.teamLead = leadEmp._id;
        await emp.save();
      }
    }
  }

  console.log(`[Seed] Seeded ${employeesToSeed.length} team members and team leads.`);

  // 6. Update any other existing users to ensure dynamicRole linkage
  const existingUsers = await User.find({ _id: { $ne: superAdminUser._id } });
  for (const u of existingUsers) {
    const matchedRole = roleDocMap[u.role] || roleDocMap['EMPLOYEE'];
    if (matchedRole) {
      u.dynamicRole = matchedRole._id;
    }
    await u.save();
  }

  // 6. Seed Default Attendance Policy
  let policy = await AttendancePolicy.findOne();
  if (!policy) {
    policy = new AttendancePolicy({
      officeLatitude: 9.9312328,
      officeLongitude: 76.2673041,
      allowedRadiusMeters: 500,
      workStartTime: '09:30',
      workEndTime: '18:30',
      gracePeriodMinutes: 5,
      halfDayCutoffLateMinutes: 120,
    });
    await policy.save();
    console.log('[Seed] Attendance Policy created.');
  }

  console.log('[Seed] System seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
