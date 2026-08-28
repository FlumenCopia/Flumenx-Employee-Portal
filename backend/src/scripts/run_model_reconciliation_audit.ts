import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { DynamicRole } from '../models/DynamicRole.js';
import { Department } from '../models/Department.js';
import { PortalPage } from '../models/PortalPage.js';
import { Employee } from '../models/Employee.js';
import { EmployeeDocument } from '../models/EmployeeDocument.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { AttendanceCorrection } from '../models/AttendanceCorrection.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { CompanyHoliday } from '../models/CompanyHoliday.js';
import { SalaryHead } from '../models/SalaryHead.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { PayrollSetting } from '../models/PayrollSetting.js';
import { PayrollRecord } from '../models/PayrollRecord.js';
import { SalarySlip } from '../models/SalarySlip.js';
import { Client } from '../models/Client.js';
import { ClientWorkShareLink } from '../models/ClientWorkShareLink.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { EmployeeKPIRating } from '../models/EmployeeKPIRating.js';
import { Announcement } from '../models/Announcement.js';
import { Notification } from '../models/Notification.js';
import { Meeting } from '../models/Meeting.js';
import { MeetingMessage } from '../models/MeetingMessage.js';
import { AuditLog } from '../models/AuditLog.js';

console.log('=== AUDITING ALL 26 MONGOOSE MODELS IN FLUMENX BOS ===');

const allModels = [
  { name: 'User', model: User, page: '/admin/users' },
  { name: 'DynamicRole', model: DynamicRole, page: '/admin/roles' },
  { name: 'Department', model: Department, page: '/admin/settings (Departments)' },
  { name: 'PortalPage', model: PortalPage, page: '/admin/pages' },
  { name: 'Employee', model: Employee, page: '/employees (Directory & Profile)' },
  { name: 'EmployeeDocument', model: EmployeeDocument, page: '/employees/[id] (Documents Tab)' },
  { name: 'AttendanceRecord', model: AttendanceRecord, page: '/attendance' },
  { name: 'AttendanceCorrection', model: AttendanceCorrection, page: '/attendance (Corrections)' },
  { name: 'AttendancePolicy', model: AttendancePolicy, page: '/admin/attendance/settings' },
  { name: 'LeaveRequest', model: LeaveRequest, page: '/leaves' },
  { name: 'LeaveLedger', model: LeaveLedger, page: '/leaves (Balances & Ledger)' },
  { name: 'CompanyHoliday', model: CompanyHoliday, page: '/salary-slips (Holidays Tab)' },
  { name: 'SalaryHead', model: SalaryHead, page: '/salary-slips (Salary Heads Tab)' },
  { name: 'EmployeeSalaryStructure', model: EmployeeSalaryStructure, page: '/salary-slips (Structures Tab)' },
  { name: 'PayrollSetting', model: PayrollSetting, page: '/salary-slips (Payroll Engine Settings)' },
  { name: 'PayrollRecord', model: PayrollRecord, page: '/salary-slips (Payroll Cycles & Detail)' },
  { name: 'SalarySlip', model: SalarySlip, page: '/salary-slips (My Payslips)' },
  { name: 'Client', model: Client, page: '/clients' },
  { name: 'ClientWorkShareLink', model: ClientWorkShareLink, page: '/work (Share Links)' },
  { name: 'WorkAssignment', model: WorkAssignment, page: '/work & /timer' },
  { name: 'EmployeeKPIRating', model: EmployeeKPIRating, page: '/kpi' },
  { name: 'Announcement', model: Announcement, page: '/announcements' },
  { name: 'Notification', model: Notification, page: 'Top Navigation Bell' },
  { name: 'Meeting', model: Meeting, page: '/meetings' },
  { name: 'MeetingMessage', model: MeetingMessage, page: '/meet/[code]' },
  { name: 'AuditLog', model: AuditLog, page: '/admin/audit-logs' },
];

console.log(`Found ${allModels.length} models registered in schema.`);
for (const m of allModels) {
  const schemaKeys = Object.keys(m.model.schema.paths);
  console.log(`[MODEL AUDIT] ${m.name}: ${schemaKeys.length} fields -> UI Page: ${m.page}`);
}
console.log('=== MODEL AUDIT COMPLETE ===');
