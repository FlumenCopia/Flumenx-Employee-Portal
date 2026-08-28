import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PayrollRecord } from '../models/PayrollRecord.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { Employee } from '../models/Employee.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { AuditLog } from '../models/AuditLog.js';
import { getAttendanceCycleForMonth, getAttendanceCycleForDate, getISTParts } from '../utils/tzUtils.js';
import { calculateAttendanceForCycle, computePayroll } from '../services/payrollEngine.js';

export async function getPayrollRecords(req: Request, res: Response): Promise<void> {
  const { month, year, department, employee_id, status } = req.query;

  const filter: any = {};
  if (month) filter.month = parseInt(month as string, 10);
  if (year) filter.year = parseInt(year as string, 10);
  if (status) filter.status = status;

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isAccountantOrHR = ['ADMIN', 'HR', 'ACCOUNTANT'].includes(req.user?.role || '');

  // Scope check for regular employees
  if (!isSuper && !isAccountantOrHR) {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp) {
      res.json({ count: 0, results: [] });
      return;
    }
    filter.employee = ownEmp._id;
  } else if (employee_id && mongoose.Types.ObjectId.isValid(employee_id as string)) {
    filter.employee = employee_id;
  }

  if (department && isAccountantOrHR) {
    const deptEmployees = await Employee.find({ department }).select('_id');
    filter.employee = { $in: deptEmployees.map((e) => e._id) };
  }

  const records = await PayrollRecord.find(filter)
    .populate('employee', 'name employeeCode department designation employmentStatus')
    .populate('calculatedBy', 'username')
    .populate('approvedBy', 'username')
    .sort({ year: -1, month: -1, createdAt: -1 });

  res.json({
    count: records.length,
    results: records,
  });
}

export async function getPayrollRecordById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid payroll ID format.' });
    return;
  }

  const record = await PayrollRecord.findById(id)
    .populate('employee', 'name employeeCode department designation phone email joiningDate employmentStatus')
    .populate('calculatedBy', 'username')
    .populate('approvedBy', 'username');

  if (!record) {
    res.status(404).json({ detail: 'Payroll record not found.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isAccountantOrHR = ['ADMIN', 'HR', 'ACCOUNTANT'].includes(req.user?.role || '');

  if (!isSuper && !isAccountantOrHR) {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp || ownEmp._id.toString() !== (record.employee as any)._id?.toString()) {
      res.status(403).json({ detail: 'You do not have permission to view this payroll record.' });
      return;
    }
  }

  res.json(record);
}

export async function calculateEmployeePayrollPreview(req: Request, res: Response): Promise<void> {
  const { employee_id, month, year } = req.body;

  if (!employee_id || !month || !year || !mongoose.Types.ObjectId.isValid(employee_id)) {
    res.status(400).json({ detail: 'Valid employee ID, month (1-12), and year are required.' });
    return;
  }

  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const emp = await Employee.findById(employee_id);
  if (!emp) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }

  const structure = await EmployeeSalaryStructure.findOne({ employee: emp._id, isActive: true });
  if (!structure) {
    res.status(400).json({ detail: `Salary structure not configured for employee ${emp.name} (${emp.employeeCode}). Please configure salary structure first.` });
    return;
  }

  const cycle = getAttendanceCycleForMonth(y, m);
  const attendance = await calculateAttendanceForCycle(emp._id as any, cycle);
  const calculation = await computePayroll(structure, attendance, m, y);

  res.json({
    employee: {
      id: emp._id,
      name: emp.name,
      employee_code: emp.employeeCode,
      department: emp.department,
      designation: emp.designation,
      employment_status: emp.employmentStatus,
    },
    ...calculation,
  });
}

export async function processPayrollCycleHandler(req: Request, res: Response): Promise<void> {
  const { month, year, department } = req.body;

  if (!month || !year) {
    res.status(400).json({ detail: 'Month (1-12) and year are required.' });
    return;
  }

  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  const cycle = getAttendanceCycleForMonth(y, m);

  let empQuery: any = { status: 'Active' };
  if (department) {
    empQuery.department = department;
  }

  const employees = await Employee.find(empQuery);
  if (employees.length === 0) {
    res.status(400).json({ detail: 'No active employees found for the selected criteria.' });
    return;
  }

  const processedRecords: any[] = [];
  const errors: any[] = [];

  for (const emp of employees) {
    try {
      const structure = await EmployeeSalaryStructure.findOne({ employee: emp._id, isActive: true });
      if (!structure) {
        errors.push({ employee: emp.name, code: emp.employeeCode, reason: 'Missing salary structure' });
        continue;
      }

      // Check if already approved/paid (immutable once approved)
      const existing = await PayrollRecord.findOne({ employee: emp._id, month: m, year: y });
      if (existing && ['Approved', 'Paid'].includes(existing.status)) {
        processedRecords.push(existing);
        continue;
      }

      const attendance = await calculateAttendanceForCycle(emp._id as any, cycle);
      const calc = await computePayroll(structure, attendance, m, y);

      if (existing) {
        existing.attendanceCycle = calc.attendanceCycle;
        existing.salarySnapshot = calc.salarySnapshot;
        existing.grossSalary = calc.grossSalary;
        existing.totalEarnings = calc.totalEarnings;
        existing.attendanceDeduction = calc.attendanceDeduction;
        existing.pfEmployee = calc.pfEmployee;
        existing.pfEmployer = calc.pfEmployer;
        existing.esiEmployee = calc.esiEmployee;
        existing.esiEmployer = calc.esiEmployer;
        existing.professionalTax = calc.professionalTax;
        existing.tds = calc.tds;
        existing.totalDeductions = calc.totalDeductions;
        existing.netSalary = calc.netSalary;
        existing.status = 'Calculated';
        existing.calculatedAt = new Date();
        existing.calculatedBy = req.user?._id;
        await existing.save();
        processedRecords.push(existing);
      } else {
        const newRecord = new PayrollRecord({
          employee: emp._id,
          month: m,
          year: y,
          attendanceCycle: calc.attendanceCycle,
          salarySnapshot: calc.salarySnapshot,
          grossSalary: calc.grossSalary,
          totalEarnings: calc.totalEarnings,
          attendanceDeduction: calc.attendanceDeduction,
          pfEmployee: calc.pfEmployee,
          pfEmployer: calc.pfEmployer,
          esiEmployee: calc.esiEmployee,
          esiEmployer: calc.esiEmployer,
          professionalTax: calc.professionalTax,
          tds: calc.tds,
          totalDeductions: calc.totalDeductions,
          netSalary: calc.netSalary,
          status: 'Calculated',
          calculatedAt: new Date(),
          calculatedBy: req.user?._id,
        });
        await newRecord.save();
        processedRecords.push(newRecord);
      }
    } catch (err: any) {
      errors.push({ employee: emp.name, code: emp.employeeCode, reason: err.message });
    }
  }

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'PROCESS_PAYROLL_CYCLE',
      module: 'PAYROLL',
      details: `Processed payroll cycle ${cycle.cycleName}: ${processedRecords.length} records computed, ${errors.length} errors.`,
    });
  } catch (err) {}

  res.json({
    message: `Payroll processed successfully for ${cycle.cycleName}`,
    cycle: cycle.cycleName,
    total_processed: processedRecords.length,
    errors,
    results: processedRecords,
  });
}

export async function approvePayrollRecord(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid payroll ID format.' });
    return;
  }

  const record = await PayrollRecord.findById(id).populate('employee', 'name employeeCode');
  if (!record) {
    res.status(404).json({ detail: 'Payroll record not found.' });
    return;
  }

  record.status = 'Approved';
  record.approvedAt = new Date();
  record.approvedBy = req.user?._id;
  await record.save();

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'APPROVE_PAYROLL',
      module: 'PAYROLL',
      details: `Approved payroll for employee ${(record.employee as any)?.name} (${record.attendanceCycle.cycleName}) - Net Pay: ₹${record.netSalary}`,
    });
  } catch (err) {}

  res.json(record);
}

export async function reprocessEmployeePayrollRecord(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid payroll ID format.' });
    return;
  }

  const record = await PayrollRecord.findById(id).populate('employee');
  if (!record) {
    res.status(404).json({ detail: 'Payroll record not found.' });
    return;
  }

  const emp = record.employee as any;
  const structure = await EmployeeSalaryStructure.findOne({ employee: emp._id, isActive: true });
  if (!structure) {
    res.status(400).json({ detail: `No active salary structure found for employee ${emp.name}` });
    return;
  }

  const cycle = getAttendanceCycleForMonth(record.year, record.month);
  const attendance = await calculateAttendanceForCycle(emp._id, cycle);
  const calc = await computePayroll(structure, attendance, record.month, record.year);

  const prevNet = record.netSalary;
  record.attendanceCycle = calc.attendanceCycle;
  record.salarySnapshot = calc.salarySnapshot;
  record.grossSalary = calc.grossSalary;
  record.totalEarnings = calc.totalEarnings;
  record.attendanceDeduction = calc.attendanceDeduction;
  record.pfEmployee = calc.pfEmployee;
  record.pfEmployer = calc.pfEmployer;
  record.esiEmployee = calc.esiEmployee;
  record.esiEmployer = calc.esiEmployer;
  record.professionalTax = calc.professionalTax;
  record.tds = calc.tds;
  record.totalDeductions = calc.totalDeductions;
  record.netSalary = calc.netSalary;
  record.status = 'Calculated';
  record.calculatedAt = new Date();
  record.calculatedBy = req.user?._id;
  await record.save();

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'REPROCESS_PAYROLL_RECORD',
      module: 'PAYROLL',
      details: `Reprocessed payroll for employee ${emp.name} (${cycle.cycleName}) - Prev Net: ₹${prevNet}, New Net: ₹${record.netSalary}`,
    });
  } catch (err) {}

  res.json({
    message: `Reprocessed salary for ${emp.name} successfully`,
    record,
  });
}

export async function markPaidPayrollRecord(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid payroll ID format.' });
    return;
  }

  const record = await PayrollRecord.findById(id).populate('employee', 'name employeeCode');
  if (!record) {
    res.status(404).json({ detail: 'Payroll record not found.' });
    return;
  }

  record.status = 'Paid';
  await record.save();

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'MARK_PAYROLL_PAID',
      module: 'PAYROLL',
      details: `Marked payroll as PAID for employee ${(record.employee as any)?.name} (${record.attendanceCycle.cycleName}) - Net Pay: ₹${record.netSalary}`,
    });
  } catch (err) {}

  res.json(record);
}

export async function reopenPayrollRecord(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason } = req.body;

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  if (!isSuper) {
    res.status(403).json({ detail: 'Permission denied. Only Super Admins can unlock protected payroll records.' });
    return;
  }

  if (!reason || String(reason).trim().length < 3) {
    res.status(400).json({ detail: 'A valid reason (minimum 3 characters) is mandatory to unlock a payroll record.' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid payroll ID format.' });
    return;
  }

  const record = await PayrollRecord.findById(id).populate('employee', 'name employeeCode');
  if (!record) {
    res.status(404).json({ detail: 'Payroll record not found.' });
    return;
  }

  const prevStatus = record.status;
  record.status = 'Calculated';
  record.approvedAt = null;
  record.approvedBy = null;
  record.notes = record.notes ? `${record.notes} | Unlocked by Super Admin: ${reason}` : `Unlocked by Super Admin: ${reason}`;
  await record.save();

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'UNLOCK_PAYROLL_RECORD',
      module: 'PAYROLL',
      details: `Unlocked payroll record (was ${prevStatus}) for employee ${(record.employee as any)?.name} (${record.attendanceCycle.cycleName}). Reason: ${reason}`,
    });
  } catch (err) {}

  res.json({
    message: 'Payroll record unlocked and returned to Calculated status.',
    record,
  });
}

// --- Payroll Reports ---

export async function getPayrollSummaryReport(req: Request, res: Response): Promise<void> {
  const { month, year } = req.query;

  const filter: any = {};
  if (month) filter.month = parseInt(month as string, 10);
  if (year) filter.year = parseInt(year as string, 10);

  const records = await PayrollRecord.find(filter).populate('employee', 'name employeeCode department');

  const totalEmployees = records.length;
  const totalGross = records.reduce((sum, r) => sum + r.grossSalary, 0);
  const totalAttendanceDeduction = records.reduce((sum, r) => sum + (r.attendanceDeduction || 0), 0);
  const totalPFEmployee = records.reduce((sum, r) => sum + (r.pfEmployee || 0), 0);
  const totalPFEmployer = records.reduce((sum, r) => sum + (r.pfEmployer || 0), 0);
  const totalESIEmployee = records.reduce((sum, r) => sum + (r.esiEmployee || 0), 0);
  const totalESIEmployer = records.reduce((sum, r) => sum + (r.esiEmployer || 0), 0);
  const totalProfessionalTax = records.reduce((sum, r) => sum + (r.professionalTax || 0), 0);
  const totalTDS = records.reduce((sum, r) => sum + (r.tds || 0), 0);
  const totalDeductions = records.reduce((sum, r) => sum + r.totalDeductions, 0);
  const totalNet = records.reduce((sum, r) => sum + r.netSalary, 0);
  const totalEmployerContribution = totalPFEmployer + totalESIEmployer;
  const totalPayrollCost = totalGross + totalEmployerContribution;

  res.json({
    summary: {
      total_employees: totalEmployees,
      total_gross: Math.round(totalGross * 100) / 100,
      total_attendance_deductions: Math.round(totalAttendanceDeduction * 100) / 100,
      total_pf_employee: totalPFEmployee,
      total_pf_employer: totalPFEmployer,
      total_esi_employee: totalESIEmployee,
      total_esi_employer: totalESIEmployer,
      total_professional_tax: totalProfessionalTax,
      total_tds: totalTDS,
      total_deductions: Math.round(totalDeductions * 100) / 100,
      total_net_payroll: Math.round(totalNet * 100) / 100,
      total_employer_contribution: Math.round(totalEmployerContribution * 100) / 100,
      total_payroll_cost: Math.round(totalPayrollCost * 100) / 100,
    },
    records,
  });
}

export async function getStatutoryReport(req: Request, res: Response): Promise<void> {
  const { month, year } = req.query;

  const filter: any = {};
  if (month) filter.month = parseInt(month as string, 10);
  if (year) filter.year = parseInt(year as string, 10);

  const records = await PayrollRecord.find(filter).populate('employee', 'name employeeCode department');

  const statutoryList = records.map((r) => {
    const emp = r.employee as any;
    return {
      employee_id: emp?._id,
      employee_name: emp?.name,
      employee_code: emp?.employeeCode,
      department: emp?.department,
      gross_salary: r.grossSalary,
      basic_salary: r.salarySnapshot?.basicSalary || 0,
      pf_employee: r.pfEmployee || 0,
      pf_employer: r.pfEmployer || 0,
      pf_total: (r.pfEmployee || 0) + (r.pfEmployer || 0),
      esi_employee: r.esiEmployee || 0,
      esi_employer: r.esiEmployer || 0,
      esi_total: (r.esiEmployee || 0) + (r.esiEmployer || 0),
      professional_tax: r.professionalTax || 0,
      tds: r.tds || 0,
    };
  });

  res.json({
    count: statutoryList.length,
    results: statutoryList,
  });
}

export async function getAttendanceImpactReport(req: Request, res: Response): Promise<void> {
  const { month, year } = req.query;

  const filter: any = {};
  if (month) filter.month = parseInt(month as string, 10);
  if (year) filter.year = parseInt(year as string, 10);

  const records = await PayrollRecord.find(filter).populate('employee', 'name employeeCode department');

  const impactList = records.map((r) => {
    const emp = r.employee as any;
    const cyc = r.attendanceCycle;
    return {
      employee_id: emp?._id,
      employee_name: emp?.name,
      employee_code: emp?.employeeCode,
      department: emp?.department,
      total_cycle_days: cyc?.totalCalendarDays || 0,
      working_days: cyc?.workingDays || 0,
      present_days: cyc?.presentDays || 0,
      half_days: cyc?.halfDays || 0,
      paid_leave_days: cyc?.paidLeaveDays || 0,
      unpaid_leave_days: cyc?.unpaidLeaveDays || 0,
      absent_days: cyc?.absentDays || 0,
      late_arrivals_count: cyc?.lateArrivalsCount || 0,
      late_half_day_deductions: cyc?.lateHalfDayDeductions || 0,
      payable_days: cyc?.payableDays || 0,
      unpaid_days: cyc?.unpaidDays || 0,
      attendance_deduction_amount: r.attendanceDeduction || 0,
    };
  });

  res.json({
    count: impactList.length,
    results: impactList,
  });
}

export async function getLeaveConversionReport(req: Request, res: Response): Promise<void> {
  const { employee_id, year } = req.query;

  const filter: any = { transactionType: 'ConversionToSalary' };
  if (employee_id) filter.employee = employee_id;
  if (year) filter.earnedYear = parseInt(year as string, 10);

  const transactions = await LeaveLedger.find(filter)
    .populate('employee', 'name employeeCode department')
    .sort({ transactionDate: -1 });

  res.json({
    count: transactions.length,
    results: transactions.map((t) => {
      const emp = t.employee as any;
      return {
        id: t._id,
        employee_id: emp?._id,
        employee_name: emp?.name,
        employee_code: emp?.employeeCode,
        department: emp?.department,
        leave_type: t.leaveType,
        converted_days: Math.abs(t.quantity),
        conversion_amount: t.conversionAmount || 0,
        transaction_date: t.transactionDate,
        notes: t.notes,
      };
    }),
  });
}
