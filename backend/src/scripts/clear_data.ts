import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';
import { ClientWorkShareLink } from '../models/ClientWorkShareLink.js';
import { Employee } from '../models/Employee.js';
import { EmployeeDocument } from '../models/EmployeeDocument.js';
import { EmployeeKPIRating } from '../models/EmployeeKPIRating.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { AttendanceCorrection } from '../models/AttendanceCorrection.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Meeting } from '../models/Meeting.js';
import { MeetingMessage } from '../models/MeetingMessage.js';
import { SalarySlip } from '../models/SalarySlip.js';
import { Announcement } from '../models/Announcement.js';
import { AuditLog } from '../models/AuditLog.js';
import { Notification } from '../models/Notification.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { DynamicRole } from '../models/DynamicRole.js';
import { PortalPage } from '../models/PortalPage.js';

async function clearData() {
  await connectDB();
  console.log('[Clear DB] Starting database cleanup (preserving Users, DynamicRoles, and PortalPages)...');

  const resultWorkAssignment = await WorkAssignment.deleteMany({});
  console.log(`- WorkAssignments deleted: ${resultWorkAssignment.deletedCount}`);

  const resultClient = await Client.deleteMany({});
  console.log(`- Clients deleted: ${resultClient.deletedCount}`);

  const resultShareLink = await ClientWorkShareLink.deleteMany({});
  console.log(`- ClientWorkShareLinks deleted: ${resultShareLink.deletedCount}`);

  const resultEmployee = await Employee.deleteMany({});
  console.log(`- Employees deleted: ${resultEmployee.deletedCount}`);

  const resultEmpDoc = await EmployeeDocument.deleteMany({});
  console.log(`- EmployeeDocuments deleted: ${resultEmpDoc.deletedCount}`);

  const resultKPI = await EmployeeKPIRating.deleteMany({});
  console.log(`- EmployeeKPIRatings deleted: ${resultKPI.deletedCount}`);

  const resultAttRec = await AttendanceRecord.deleteMany({});
  console.log(`- AttendanceRecords deleted: ${resultAttRec.deletedCount}`);

  const resultAttCorr = await AttendanceCorrection.deleteMany({});
  console.log(`- AttendanceCorrections deleted: ${resultAttCorr.deletedCount}`);

  const resultAttPol = await AttendancePolicy.deleteMany({});
  console.log(`- AttendancePolicies deleted: ${resultAttPol.deletedCount}`);

  const resultLeave = await LeaveRequest.deleteMany({});
  console.log(`- LeaveRequests deleted: ${resultLeave.deletedCount}`);

  const resultMeeting = await Meeting.deleteMany({});
  console.log(`- Meetings deleted: ${resultMeeting.deletedCount}`);

  const resultMsg = await MeetingMessage.deleteMany({});
  console.log(`- MeetingMessages deleted: ${resultMsg.deletedCount}`);

  const resultSalary = await SalarySlip.deleteMany({});
  console.log(`- SalarySlips deleted: ${resultSalary.deletedCount}`);

  const resultAnn = await Announcement.deleteMany({});
  console.log(`- Announcements deleted: ${resultAnn.deletedCount}`);

  const resultAudit = await AuditLog.deleteMany({});
  console.log(`- AuditLogs deleted: ${resultAudit.deletedCount}`);

  const resultNotif = await Notification.deleteMany({});
  console.log(`- Notifications deleted: ${resultNotif.deletedCount}`);

  const resultDept = await Department.deleteMany({});
  console.log(`- Departments deleted: ${resultDept.deletedCount}`);

  const userCount = await User.countDocuments();
  const roleCount = await DynamicRole.countDocuments();
  const pageCount = await PortalPage.countDocuments();

  console.log(`\n[Clear DB] Completed successfully! Preserved:`);
  console.log(`- Users: ${userCount}`);
  console.log(`- Dynamic Roles: ${roleCount}`);
  console.log(`- Portal Pages: ${pageCount}`);

  await mongoose.disconnect();
  process.exit(0);
}

clearData().catch((err) => {
  console.error('[Clear DB] Error clearing database:', err);
  process.exit(1);
});
