import { connectDB } from '../config/db.js';
import { PortalPage } from '../models/PortalPage.js';
import { DynamicRole } from '../models/DynamicRole.js';
import { Department } from '../models/Department.js';
import { User, UserRoleType } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { AttendanceCorrection } from '../models/AttendanceCorrection.js';
import { CompanyHoliday } from '../models/CompanyHoliday.js';
import { SalaryHead } from '../models/SalaryHead.js';
import { SalarySlip } from '../models/SalarySlip.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { PayrollRecord } from '../models/PayrollRecord.js';
import { PayrollSetting } from '../models/PayrollSetting.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';
import { ClientWorkShareLink } from '../models/ClientWorkShareLink.js';
import { Meeting } from '../models/Meeting.js';
import { MeetingMessage } from '../models/MeetingMessage.js';
import { Notification } from '../models/Notification.js';
import { Announcement } from '../models/Announcement.js';
import { AuditLog } from '../models/AuditLog.js';
import { EmployeeDocument } from '../models/EmployeeDocument.js';
import { EmployeeKPIRating } from '../models/EmployeeKPIRating.js';

async function seed() {
  await connectDB();
  console.log('================================================================================');
  console.log('=== STARTING 100% CLEAN FLUMENX BOS DATABASE PURGE & ENTERPRISE SEED ===');
  console.log('================================================================================');

  // 0. COMPLETE DATABASE PURGE (Clean Slate)
  console.log('[Seed] 🧹 Wiping all existing collections for a 100% fresh, clean database state...');
  await Promise.all([
    User.deleteMany({}),
    Employee.deleteMany({}),
    Department.deleteMany({}),
    PortalPage.deleteMany({}),
    DynamicRole.deleteMany({}),
    CompanyHoliday.deleteMany({}),
    AttendancePolicy.deleteMany({}),
    AttendanceRecord.deleteMany({}),
    AttendanceCorrection.deleteMany({}),
    EmployeeSalaryStructure.deleteMany({}),
    LeaveLedger.deleteMany({}),
    LeaveRequest.deleteMany({}),
    PayrollRecord.deleteMany({}),
    PayrollSetting.deleteMany({}),
    SalaryHead.deleteMany({}),
    SalarySlip.deleteMany({}),
    WorkAssignment.deleteMany({}),
    Client.deleteMany({}),
    ClientWorkShareLink.deleteMany({}),
    Meeting.deleteMany({}),
    MeetingMessage.deleteMany({}),
    Notification.deleteMany({}),
    Announcement.deleteMany({}),
    AuditLog.deleteMany({}),
    EmployeeDocument.deleteMany({}),
    EmployeeKPIRating.deleteMany({}),
  ]);
  console.log('[Seed] ✅ Database completely purged. 0 leftover documents.');

  // 1. Seed 19 Portal Pages
  const pagesData = [
    { moduleCode: 'COMMAND_CENTER', title: 'Command Center', routePath: '/work?view=command-center', icon: 'Sparkles', sidebarOrder: 1 },
    { moduleCode: 'TASKS', title: 'Task Board', routePath: '/work?view=kanban', icon: 'Kanban', sidebarOrder: 2 },
    { moduleCode: 'TIMER', title: 'Time Tracker', routePath: '/timer', icon: 'Clock3', sidebarOrder: 3 },
    { moduleCode: 'TEAM_WORK', title: 'Team Work', routePath: '/team-work', icon: 'Users', sidebarOrder: 4 },
    { moduleCode: 'CLIENTS', title: 'Clients Master', routePath: '/clients', icon: 'BriefcaseBusiness', sidebarOrder: 5 },
    { moduleCode: 'TIMELINE', title: 'Timeline & Phases', routePath: '/work?view=timeline', icon: 'Layers', sidebarOrder: 6 },
    { moduleCode: 'KPI', title: 'KPI Performance', routePath: '/kpi', icon: 'TrendingUp', sidebarOrder: 7 },
    { moduleCode: 'EMPLOYEES', title: 'Employees Directory', routePath: '/employees', icon: 'Users', sidebarOrder: 8 },
    { moduleCode: 'ATTENDANCE', title: 'Attendance', routePath: '/attendance', icon: 'CalendarCheck', sidebarOrder: 9 },
    { moduleCode: 'LEAVES', title: 'Leave Requests', routePath: '/leaves', icon: 'CalendarDays', sidebarOrder: 10 },
    { moduleCode: 'MEETINGS', title: 'Meetings', routePath: '/meetings', icon: 'UserRound', sidebarOrder: 11 },
    { moduleCode: 'REPORTS', title: 'Reports Center', routePath: '/reports', icon: 'FileSpreadsheet', sidebarOrder: 12 },
    { moduleCode: 'ROLES', title: 'Dynamic Roles', routePath: '/admin/roles', icon: 'ShieldAlert', sidebarOrder: 13 },
    { moduleCode: 'SUPER_ADMIN_USERS', title: 'User Management', routePath: '/admin/users', icon: 'UserCheck', sidebarOrder: 14 },
    { moduleCode: 'PAGE_MANAGEMENT', title: 'Page Management', routePath: '/pages', icon: 'FileCode', sidebarOrder: 15 },
    { moduleCode: 'SALARY_SLIPS', title: 'Salary & Payroll', routePath: '/admin/salary-slips', icon: 'Receipt', sidebarOrder: 16 },
    { moduleCode: 'ANNOUNCEMENTS', title: 'Announcements', routePath: '/admin/announcements', icon: 'Megaphone', sidebarOrder: 17 },
    { moduleCode: 'AUDIT_LOGS', title: 'Audit Logs', routePath: '/admin/audit-logs', icon: 'History', sidebarOrder: 18 },
    { moduleCode: 'SETTINGS_ACCESS', title: 'Settings & Access', routePath: '/settings', icon: 'Settings', sidebarOrder: 19 },
  ];

  const pageDocMap: Record<string, any> = {};

  for (const p of pagesData) {
    const pageObj = new PortalPage({ ...p, isActive: true });
    await pageObj.save();
    pageDocMap[p.moduleCode] = pageObj;
  }
  console.log(`[Seed] ✅ Seeded ${Object.keys(pageDocMap).length} Portal Pages.`);

  // 2. Seed 9 Dynamic Roles with Granular Page Permissions
  const rolesData = [
    { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full wildcard access to all modules and settings', isSuperadminWildcard: true, isSystemRole: true },
    { code: 'ADMIN', name: 'Administrator', description: 'Full operational management access', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'HR', name: 'Human Resources', description: 'HR Manager with employee, leave, attendance, holiday, and payroll access', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'ACCOUNTANT', name: 'Accountant', description: 'Accountant with financial, statutory, and salary/payroll access', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'TEAM_LEAD', name: 'Team Lead', description: 'Team Leader managing assignments, attendance, and reviews', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'EMPLOYEE', name: 'Employee', description: 'Regular employee with self-service portal and payslip access', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'BDE', name: 'Business Development', description: 'BDM managing clients, leads, and proposals', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'OPERATIONS', name: 'Operations', description: 'Operations Specialist managing daily deliverables', isSuperadminWildcard: false, isSystemRole: true },
    { code: 'OPERATIONS_HEAD', name: 'Operations Head', description: 'Head of Operations overseeing team deliverables', isSuperadminWildcard: false, isSystemRole: true },
  ];

  const roleDocMap: Record<string, any> = {};

  for (const r of rolesData) {
    const ROLE_MODULE_MAP: Record<string, string[]> = {
      SUPER_ADMIN: Object.keys(pageDocMap),
      ADMIN: Object.keys(pageDocMap),
      OPERATIONS: Object.keys(pageDocMap),
      OPERATIONS_HEAD: Object.keys(pageDocMap),
      HR: ['COMMAND_CENTER', 'TASKS', 'TIMER', 'TEAM_WORK', 'CLIENTS', 'TIMELINE', 'KPI', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'SALARY_SLIPS', 'ANNOUNCEMENTS', 'REPORTS'],
      ACCOUNTANT: ['TASKS', 'TIMER', 'CLIENTS', 'ATTENDANCE', 'LEAVES', 'SALARY_SLIPS', 'MEETINGS', 'ANNOUNCEMENTS', 'REPORTS'],
      TEAM_LEAD: ['COMMAND_CENTER', 'TASKS', 'TIMER', 'TEAM_WORK', 'CLIENTS', 'TIMELINE', 'KPI', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'REPORTS', 'SALARY_SLIPS'],
      BDE: ['COMMAND_CENTER', 'TASKS', 'TIMER', 'CLIENTS', 'TIMELINE', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'SALARY_SLIPS'],
      EMPLOYEE: ['TASKS', 'TIMER', 'KPI', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'ANNOUNCEMENTS', 'SALARY_SLIPS'],
    };

    const allowed = ROLE_MODULE_MAP[r.code] || ['TASKS', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'SALARY_SLIPS'];
    const permissions = allowed
      .map((mod) => pageDocMap[mod])
      .filter(Boolean)
      .map((page) => {
        const mod = page.moduleCode;
        const role = r.code;
        let canCreate = false;
        let canEdit = false;
        let canDelete = false;

        if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'OPERATIONS_HEAD') {
          canCreate = true;
          canEdit = true;
          canDelete = true;
        } else if (role === 'HR') {
          canCreate = ['EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'SALARY_SLIPS', 'KPI', 'TASKS', 'ANNOUNCEMENTS'].includes(mod);
          canEdit = ['EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'SALARY_SLIPS', 'KPI', 'TASKS', 'ANNOUNCEMENTS'].includes(mod);
          canDelete = false;
        } else if (role === 'ACCOUNTANT') {
          canCreate = ['SALARY_SLIPS'].includes(mod);
          canEdit = ['SALARY_SLIPS'].includes(mod);
          canDelete = ['SALARY_SLIPS'].includes(mod);
        } else if (role === 'TEAM_LEAD') {
          canCreate = ['TASKS', 'TEAM_WORK', 'LEAVES'].includes(mod);
          canEdit = ['TASKS', 'TEAM_WORK', 'LEAVES', 'KPI'].includes(mod);
          canDelete = false;
        } else if (role === 'EMPLOYEE' || role === 'BDE') {
          canCreate = ['LEAVES', 'ATTENDANCE'].includes(mod);
          canEdit = ['TASKS'].includes(mod);
          canDelete = false;
        }

        return {
          page: page._id,
          canView: true,
          canCreate,
          canEdit,
          canDelete,
        };
      });

    const roleObj = new DynamicRole({
      code: r.code,
      name: r.name,
      description: r.description,
      isSuperadminWildcard: r.isSuperadminWildcard,
      isSystemRole: r.isSystemRole,
      permissions,
    });

    await roleObj.save();
    roleDocMap[r.code] = roleObj;
  }
  console.log(`[Seed] ✅ Seeded ${Object.keys(roleDocMap).length} Dynamic Roles with granular page access.`);

  // 3. Seed 8 Departments
  const deptData = [
    { code: 'OPERATIONS', name: 'Operations', description: 'Core agency operations and deliverable management', displayOrder: 1 },
    { code: 'WEB_DEV', name: 'Web Development', description: 'Frontend, backend, and full stack web solutions', displayOrder: 2 },
    { code: 'VIDEO_EDITING', name: 'Video Editing', description: 'Video post-production, motion graphics, and content editing', displayOrder: 3 },
    { code: 'DESIGN', name: 'Design', description: 'UI/UX design, branding, and graphics design', displayOrder: 4 },
    { code: 'DIGITAL_MARKETING', name: 'Digital Marketing', description: 'SEO, social media marketing, and growth campaigns', displayOrder: 5 },
    { code: 'HR', name: 'Human Resources', description: 'Human resources, talent management, and employee welfare', displayOrder: 6 },
    { code: 'ACCOUNTANT', name: 'Accounts', description: 'Financial management, payroll, and billing', displayOrder: 7 },
    { code: 'BDM', name: 'Business Development', description: 'Sales, client partnerships, and business development', displayOrder: 8 },
  ];

  const deptDocMap: Record<string, any> = {};
  for (const d of deptData) {
    const deptObj = new Department({ ...d, isActive: true });
    await deptObj.save();
    deptDocMap[d.name] = deptObj;
    deptDocMap[d.code] = deptObj;
  }
  console.log('[Seed] ✅ Seeded 8 Departments.');

  // 4. Seed Super Admin User & Employee profile
  const superAdminRole = roleDocMap['SUPER_ADMIN'];
  const superAdminUser = new User({
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

  const superAdminEmp = new Employee({
    user: superAdminUser._id,
    employeeCode: 'FX-001',
    name: 'Super Admin',
    email: 'admin@flumenx.com',
    phone: '+91 9876543210',
    department: 'Operations',
    departmentRef: deptDocMap['Operations']?._id,
    designation: 'Super Administrator',
    joiningDate: new Date('2024-01-01'),
    status: 'Active',
    employmentStatus: 'Permanent',
  });
  await superAdminEmp.save();
  console.log('[Seed] ✅ Seeded Super Admin User & Employee profile.');

  // 5. Seed 13 Official Employees
  const employeesToSeed = [
    {
      name: 'Dhishunjith k',
      email: 'dhishunjith@flumenx.com',
      designation: 'DM Team Lead',
      department: 'Digital Marketing',
      role: 'TEAM_LEAD',
      code: 'FX-002',
      status: 'Permanent',
      salary: { gross: 45000, basic: 22500, hra: 11250, conveyance: 3000, special: 8250 },
    },
    {
      name: 'Nidhin KG',
      email: 'nidhinkgflumenx@gmail.com',
      designation: 'Junior web developer',
      department: 'Web Development',
      role: 'EMPLOYEE',
      code: 'FX-003',
      status: 'Permanent',
      leadEmail: 'najilrahmanflumenx@gmail.com',
      salary: { gross: 25000, basic: 12500, hra: 6250, conveyance: 2000, special: 4250 },
    },
    {
      name: 'Ebi Lawrence',
      email: 'ebilawrenceflumenx@gmail.com',
      designation: 'Junior Graphic Designer',
      department: 'Design',
      role: 'EMPLOYEE',
      code: 'FX-004',
      status: 'Permanent',
      leadEmail: 'dhishunjith@flumenx.com',
      salary: { gross: 22000, basic: 11000, hra: 5500, conveyance: 2000, special: 3500 },
    },
    {
      name: 'Abeyson p mathew',
      email: 'abeysonpmathewflumenx@gmail.com',
      designation: 'HR',
      department: 'Human Resources',
      role: 'HR',
      code: 'FX-005',
      status: 'Permanent',
      salary: { gross: 35000, basic: 17500, hra: 8750, conveyance: 2500, special: 6250 },
    },
    {
      name: 'Anurag J S',
      email: 'anuragjsflumenx@gmail.com',
      designation: 'BDM',
      department: 'Business Development',
      role: 'BDE',
      code: 'FX-006',
      status: 'Permanent',
      salary: { gross: 35000, basic: 17500, hra: 8750, conveyance: 2500, special: 6250 },
    },
    {
      name: 'Shrijith',
      email: 'shreejithspillaiflumencopia@gmail.com',
      designation: 'Senior Graphic Designer',
      department: 'Design',
      role: 'EMPLOYEE',
      code: 'FX-007',
      status: 'Permanent',
      leadEmail: 'dhishunjith@flumenx.com',
      salary: { gross: 32000, basic: 16000, hra: 8000, conveyance: 2500, special: 5500 },
    },
    {
      name: 'Anandhu R S',
      email: 'anandhursflumenx@gmail.com',
      designation: 'Accountant',
      department: 'Accounts',
      role: 'ACCOUNTANT',
      code: 'FX-008',
      status: 'Permanent',
      salary: { gross: 32000, basic: 16000, hra: 8000, conveyance: 2500, special: 5500 },
    },
    {
      name: 'Najil Rahman P.M.',
      email: 'najilrahmanflumenx@gmail.com',
      designation: 'Senior web developer',
      department: 'Web Development',
      role: 'TEAM_LEAD',
      code: 'FX-009',
      status: 'Permanent',
      salary: { gross: 48000, basic: 24000, hra: 12000, conveyance: 3000, special: 9000 },
    },
    {
      name: 'Anandu anil',
      email: 'ananduanilflumenx@gmail.com',
      designation: 'Video editor',
      department: 'Video Editing',
      role: 'EMPLOYEE',
      code: 'FX-010',
      status: 'Permanent',
      leadEmail: 'dhishunjith@flumenx.com',
      salary: { gross: 24000, basic: 12000, hra: 6000, conveyance: 2000, special: 4000 },
    },
    {
      name: 'Gowtham Vijay',
      email: 'gowthamvijayflumenx@gmail.com',
      designation: 'Digital Marketing Executive',
      department: 'Digital Marketing',
      role: 'EMPLOYEE',
      code: 'FX-011',
      status: 'Permanent',
      leadEmail: 'dhishunjith@flumenx.com',
      salary: { gross: 24000, basic: 12000, hra: 6000, conveyance: 2000, special: 4000 },
    },
    {
      name: 'NiKhil A. V.',
      email: 'nikhilavflumenx@gmail.com',
      designation: 'Digital Marketing Executive',
      department: 'Digital Marketing',
      role: 'EMPLOYEE',
      code: 'FX-012',
      status: 'Permanent',
      leadEmail: 'dhishunjith@flumenx.com',
      salary: { gross: 24000, basic: 12000, hra: 6000, conveyance: 2000, special: 4000 },
    },
    {
      name: 'Akhil S. S.',
      email: 'akhilsflumencopia@gmail.com',
      designation: 'Junior web developer',
      department: 'Web Development',
      role: 'EMPLOYEE',
      code: 'FX-013',
      status: 'Permanent',
      leadEmail: 'najilrahmanflumenx@gmail.com',
      salary: { gross: 22000, basic: 11000, hra: 5500, conveyance: 2000, special: 3500 },
    },
    {
      name: 'Rahul B Chandran',
      email: 'rahulchandran883@gmail.com',
      designation: 'Digital marketing intern',
      department: 'Digital Marketing',
      role: 'EMPLOYEE',
      code: 'FX-014',
      status: 'Probation',
      leadEmail: 'dhishunjith@flumenx.com',
      salary: { gross: 12000, basic: 6000, hra: 3000, conveyance: 1500, special: 1500 },
    },
  ];

  const empDocMap: Record<string, any> = {};

  // First pass: Create Users, Employees, Leave Ledgers, and Salary Structures
  for (const item of employeesToSeed) {
    const cleanEmail = item.email.trim().toLowerCase();
    const parts = item.name.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';
    const username = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
    const matchedRole = roleDocMap[item.role] || roleDocMap['EMPLOYEE'];

    const u = new User({
      username,
      email: cleanEmail,
      password: 'password123',
      firstName,
      lastName,
      role: item.role as UserRoleType,
      dynamicRole: matchedRole ? matchedRole._id : null,
      isStaff: ['TEAM_LEAD', 'HR', 'ACCOUNTANT', 'SUPER_ADMIN'].includes(item.role),
      isActive: true,
    });
    await u.save();

    const deptObj = deptDocMap[item.department] || deptDocMap['OPERATIONS'];

    const emp = new Employee({
      user: u._id,
      employeeCode: item.code,
      name: item.name.trim(),
      email: cleanEmail,
      phone: '+91 9876543210',
      department: item.department,
      departmentRef: deptObj ? deptObj._id : null,
      designation: item.designation,
      joiningDate: new Date('2025-01-01'),
      status: 'Active',
      employmentStatus: item.status as any,
    });
    await emp.save();

    empDocMap[cleanEmail] = emp;

    // Seed Employee Salary Structure
    const struct = new EmployeeSalaryStructure({
      employee: emp._id,
      effectiveDate: new Date('2025-01-01'),
      grossSalary: item.salary.gross,
      basicSalary: item.salary.basic,
      hra: item.salary.hra,
      conveyance: item.salary.conveyance,
      specialAllowance: item.salary.special,
      pfEnabled: true,
      pfEmployeePercent: 12,
      pfEmployerPercent: 12,
      pfWageCeiling: 15000,
      esiEnabled: item.salary.gross <= 21000,
      esiEmployeePercent: 0.75,
      esiEmployerPercent: 3.25,
      esiGrossCeiling: 21000,
      professionalTax: 200,
      tds: 0,
      isActive: true,
    });
    await struct.save();

    // Seed Leave Ledger balance for Permanent employees
    if (item.status === 'Permanent') {
      await new LeaveLedger({
        employee: emp._id,
        leaveType: 'Sick',
        transactionType: 'OpeningBalance',
        quantity: 1,
        balanceAfter: 1,
        earnedMonth: 8,
        earnedYear: 2026,
        notes: 'Initial monthly sick leave balance',
      }).save();

      await new LeaveLedger({
        employee: emp._id,
        leaveType: 'Casual',
        transactionType: 'OpeningBalance',
        quantity: 1,
        balanceAfter: 1,
        earnedMonth: 8,
        earnedYear: 2026,
        notes: 'Initial monthly casual leave balance',
      }).save();
    }
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

  console.log(`[Seed] ✅ Seeded ${employeesToSeed.length} master employees with salary structures & leave ledgers.`);

  // 6. Seed Company Holidays (Kerala / India Calendar)
  const holidaysData = [
    { name: 'Republic Day', date: new Date('2026-01-26T00:00:00.000+05:30'), holiday_type: 'Public', is_paid: true, description: 'National Holiday' },
    { name: 'May Day', date: new Date('2026-05-01T00:00:00.000+05:30'), holiday_type: 'Public', is_paid: true, description: 'International Workers Day' },
    { name: 'Eid-ul-Fitr', date: new Date('2026-03-20T00:00:00.000+05:30'), holiday_type: 'Public', is_paid: true, description: 'Eid Holiday' },
    { name: 'Independence Day', date: new Date('2026-08-15T00:00:00.000+05:30'), holiday_type: 'Public', is_paid: true, description: 'Indian Independence Day' },
    { name: 'Thiruvonam (Onam)', date: new Date('2026-08-27T00:00:00.000+05:30'), holiday_type: 'Company', is_paid: true, description: 'Kerala State Festival' },
    { name: 'Gandhi Jayanti', date: new Date('2026-10-02T00:00:00.000+05:30'), holiday_type: 'Public', is_paid: true, description: 'Mahatma Gandhi Birthday' },
    { name: 'Deepavali', date: new Date('2026-11-08T00:00:00.000+05:30'), holiday_type: 'Public', is_paid: true, description: 'Festival of Lights' },
    { name: 'Christmas', date: new Date('2026-12-25T00:00:00.000+05:30'), holiday_type: 'Public', is_paid: true, description: 'Christmas Day' },
  ];

  for (const h of holidaysData) {
    const dStr = h.date.toISOString().split('T')[0];
    const hObj = new CompanyHoliday({
      name: h.name,
      date: h.date,
      dateStr: dStr,
      holidayType: h.holiday_type,
      isPaid: h.is_paid,
      year: h.date.getFullYear(),
      description: h.description,
      isActive: true,
    });
    await hObj.save();
  }
  console.log(`[Seed] ✅ Seeded ${holidaysData.length} Company Holidays.`);

  // 7. Seed Enterprise Attendance Policy
  const policy = new AttendancePolicy({
    officeLatitude: 8.5213442,
    officeLongitude: 76.97848305555556,
    allowedRadiusMeters: 200,
    officeStartTime: '09:30',
    officeEndTime: '18:30',
    gracePeriodMinutes: 5,
    earlyCheckoutHalfDayCutoff: '18:00',
    halfDayHours: 4,
    fullDayHours: 8,
  });
  await policy.save();
  console.log('[Seed] ✅ Created HQ Attendance Policy.');

  // 8. Seed Enterprise Payroll Setting
  const payrollSetting = new PayrollSetting({
    companyTimezone: 'Asia/Kolkata',
    cycleStartDay: 26,
    cycleEndDay: 25,
    salaryBasis: 'CalendarDays',
    officeStartTime: '09:30',
    gracePeriodMinutes: 5,
    lateThresholdMinutes: 5,
    lateArrivalsLimit: 3,
    latePenalty: 'HalfDay',
    noonCutoffTime: '12:00',
    pfEnabled: true,
    pfEmployeePercent: 12,
    pfEmployerPercent: 12,
    pfWageCeiling: 15000,
    esiEnabled: true,
    esiEmployeePercent: 0.75,
    esiEmployerPercent: 3.25,
    esiGrossCeiling: 21000,
    probationPaidLeaveAllowed: false,
    permanentMonthlySickLeave: 1,
    permanentMonthlyCasualLeave: 1,
    unusedLeaveConversionMonths: 3,
    isActive: true,
  });
  await payrollSetting.save();
  console.log('[Seed] ✅ Created Enterprise Payroll & Statutory Setting.');

  console.log('================================================================================');
  console.log('=== FLUMENX BOS CLEAN SYSTEM SEEDING COMPLETED SUCCESSFULLY ===');
  console.log('================================================================================');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
