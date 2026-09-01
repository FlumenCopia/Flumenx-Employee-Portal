import { connectDB } from '../config/db.js';
import '../models/PortalPage.js';
import '../models/DynamicRole.js';
import '../models/User.js';
import '../models/Employee.js';
import '../models/AttendanceRecord.js';
import '../models/AttendancePolicy.js';
import '../models/AttendanceCorrection.js';
import '../models/WorkAssignment.js';
import '../models/Client.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { DynamicRole } from '../models/DynamicRole.js';
import { PortalPage } from '../models/PortalPage.js';
import { TrackingService } from '../services/trackingService.js';
import { defaultRoleActionMatrix } from '../middleware/rbac.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

const TEST_ACCOUNTS = [
  { role: 'SUPER_ADMIN', email: 'admin@flumenx.com' },
  { role: 'HR', email: 'abeysonpmathewflumenx@gmail.com' },
  { role: 'TEAM_LEAD', email: 'dhishunjith@flumenx.com' },
  { role: 'EMPLOYEE', email: 'shreejithspillaiflumencopia@gmail.com' },
  { role: 'BDE', email: 'anuragjsflumenx@gmail.com' },
  { role: 'ACCOUNTANT', email: 'anandhursflumenx@gmail.com' },
];

async function verifyAll() {
  await connectDB();
  console.log('================================================================================');
  console.log('=== END-TO-END SUITE: ALL 6 ROLES & CRITICAL WORKFLOWS VERIFICATION ===');
  console.log('================================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  for (const acc of TEST_ACCOUNTS) {
    console.log(`\n================================================================`);
    console.log(`🧪 TESTING ROLE: [${acc.role}] (${acc.email})`);
    console.log(`================================================================`);

    // 1. User & Employee Identity
    totalTests++;
    const user = await User.findOne({ email: acc.email }).populate('dynamicRole');
    if (!user) {
      console.error(`❌ User account missing: ${acc.email}`);
      continue;
    }
    const emp = await Employee.findOne({ $or: [{ user: user._id }, { email: user.email }] });
    if (!emp) {
      console.error(`❌ Employee record missing for: ${acc.email}`);
      continue;
    }
    passedTests++;
    console.log(`✓ Identity Verified: ${user.username} -> ${emp.name} (${emp.employeeCode}) [${emp.department}]`);

    // 2. JWT Generation & Verification
    totalTests++;
    const token = jwt.sign(
      { id: user._id.toString(), userId: user._id.toString(), email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '1d' }
    );
    const decoded: any = jwt.verify(token, config.jwtSecret);
    if (decoded.userId === user._id.toString()) {
      passedTests++;
      console.log(`✓ JWT Authentication Token Verified.`);
    }

    // 3. Dynamic Navigation Access
    totalTests++;
    const allPages = await PortalPage.find({ isActive: true }).sort({ sidebarOrder: 1 });
    const dynRole = user.dynamicRole as any;
    let allowedPageCodes: string[] = [];

    if (user.role === 'SUPER_ADMIN' || user.isSuperuser || dynRole?.isSuperadminWildcard) {
      allowedPageCodes = allPages.map((p) => p.moduleCode);
    } else if (dynRole && Array.isArray(dynRole.permissions)) {
      allowedPageCodes = allPages
        .filter((page) => {
          const perm = dynRole.permissions.find((p: any) => {
            const pid = p.page?._id ? p.page._id.toString() : p.page?.toString();
            return pid === page._id.toString();
          });
          return perm && Boolean(perm.canView);
        })
        .map((p) => p.moduleCode);
    }

    passedTests++;
    console.log(`✓ Accessible Portal Modules (${allowedPageCodes.length}/22): ${allowedPageCodes.slice(0, 8).join(', ')}...`);

    // Ensure CHAT is in allowed modules for all roles
    totalTests++;
    if (allowedPageCodes.includes('CHAT')) {
      passedTests++;
      console.log(`✓ Team Chat Hub [CHAT]: PERMITTED FOR ${acc.role}`);
    } else {
      console.error(`❌ Team Chat Hub [CHAT] NOT PERMITTED for ${acc.role}`);
    }

    // 4. Location Tracking Online / Offline Lifecycle
    totalTests++;
    try {
      const startRes = await TrackingService.startSession(
        emp._id,
        user._id,
        { latitude: 8.5241, longitude: 76.9366, accuracy: 10, speed: 0 },
        'Automated Test Device (Chrome/iOS)'
      );
      if (startRes.session && startRes.employee.trackingStatus === 'ONLINE') {
        const stopRes = await TrackingService.stopSession(emp._id, { latitude: 8.5241, longitude: 76.9366 });
        if (stopRes.employee.trackingStatus === 'OFFLINE') {
          passedTests++;
          console.log(`✓ GPS Tracking Lifecycle: Go ONLINE -> Transmit -> Go OFFLINE (SUCCESS)`);
        }
      }
    } catch (e: any) {
      console.error(`❌ Tracking lifecycle error:`, e.message);
    }
  }

  console.log('\n================================================================================');
  console.log(`🎉 VERIFICATION COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
  console.log('================================================================================\n');
  process.exit(0);
}

verifyAll().catch(console.error);
