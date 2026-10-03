import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Employee } from '../models/Employee.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { AuditLog } from '../models/AuditLog.js';
import { getEmployeeLeaveBalance } from '../services/leaveEngine.js';
import { getEmployeeForUser } from '../utils/employeeResolver.js';
import { getRoleDataScope } from '../services/scopeResolver.js';
import { resolveUserPermissions } from '../services/permissionResolver.js';
import { sendLeaveApplicationEmail, sendLeaveDecisionEmail } from '../utils/mailer.js';
import { Notification } from '../models/Notification.js';
import { broadcastNotificationToUser } from '../services/chatSocket.js';

export async function getLeaves(req: Request, res: Response): Promise<void> {
  const { employee_id, status } = req.query;

  const filter: any = {};
  if (status) filter.status = status;

  const leaveScope = await getRoleDataScope(req.user, 'LEAVES');
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = isSuper || leaveScope === 'ALL';
  const isTeamLead = leaveScope === 'TEAM' || leaveScope === 'DEPARTMENT';

  if (!isSuper && !isManagement) {
    const ownEmployee = await getEmployeeForUser(req.user);
    if (!ownEmployee) {
      res.json({ count: 0, next: null, previous: null, results: [] });
      return;
    }

    if (isTeamLead) {
      const deptRegex = ownEmployee.department ? new RegExp(`^${ownEmployee.department.trim()}$`, 'i') : null;
      const teamEmployees = deptRegex ? await Employee.find({ department: deptRegex }).select('_id') : [];
      const teamEmpIds = [ownEmployee._id, ...teamEmployees.map((e) => e._id)];

      if (employee_id && mongoose.Types.ObjectId.isValid(employee_id as string)) {
        if (teamEmpIds.some((id) => id.toString() === String(employee_id))) {
          filter.employee = employee_id;
        } else {
          res.json({ count: 0, next: null, previous: null, results: [] });
          return;
        }
      } else {
        filter.employee = { $in: teamEmpIds };
      }
    } else {
      // Standard employee strictly sees only own leaves
      filter.employee = ownEmployee._id;
    }
  } else if (employee_id) {
    filter.employee = employee_id;
  }

  const leaves = await LeaveRequest.find(filter).populate('employee').sort({ createdAt: -1 });

  const formatted = leaves.map((l) => {
    const emp = l.employee as any;
    const isHalf = Boolean(l.isHalfDay);
    const calculatedDays = l.startDate && l.endDate
      ? Math.ceil((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / (1000 * 3600 * 24)) + 1
      : 1;
    const effectiveDays = isHalf ? 0.5 : (l.daysCount || calculatedDays);

    return {
      id: l._id,
      employee: emp ? emp._id : null,
      employee_name: emp ? emp.name : 'Employee',
      employee_code: emp ? emp.employeeCode : 'N/A',
      leave_type: l.leaveType,
      start_date: l.startDate ? l.startDate.toISOString().split('T')[0] : '',
      end_date: l.endDate ? l.endDate.toISOString().split('T')[0] : '',
      is_half_day: isHalf,
      half_day_period: l.halfDayPeriod || null,
      days_count: effectiveDays,
      days: effectiveDays,
      reason: l.reason,
      status: l.status,
      admin_note: l.adminNote,
    };
  });

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function createLeave(req: Request, res: Response): Promise<void> {
  const { employee_id, leave_type, start_date, end_date, reason, is_half_day, half_day_period } = req.body;

  let empId = employee_id;
  const leaveScope = await getRoleDataScope(req.user, 'LEAVES');
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const canApplyForOthers = isSuper || leaveScope === 'ALL' || leaveScope === 'DEPARTMENT';

  if (!canApplyForOthers || !empId) {
    const emp = await getEmployeeForUser(req.user);
    if (emp) empId = emp._id;
  }

  if (!leave_type || !start_date || !reason) {
    res.status(400).json({ detail: 'Leave type, start date, and reason are required.' });
    return;
  }

  const isHalfDayBool = Boolean(is_half_day);
  const startDate = new Date(start_date);
  const endDate = isHalfDayBool ? new Date(start_date) : new Date(end_date || start_date);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
    res.status(400).json({ detail: 'Invalid leave date range. Start date must be on or before end date.' });
    return;
  }

  const daysCount = isHalfDayBool
    ? 0.5
    : Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;

  if (empId) {
    const targetEmp = await Employee.findById(empId);
    if (targetEmp) {
      const isProbation =
        targetEmp.employmentStatus === 'Probation' ||
        (targetEmp.probationEndDate && new Date(targetEmp.probationEndDate) > new Date() && targetEmp.employmentStatus !== 'Permanent');

      if (isProbation) {
        const typeLower = (leave_type || '').toLowerCase();
        if (typeLower.includes('sick') || typeLower.includes('casual')) {
          res.status(400).json({
            detail: `Employees on Probation (${targetEmp.name}) are not eligible for Sick or Casual leave. Only Unpaid (Loss of Pay) or Emergency leave is permitted during probation.`,
          });
          return;
        }
      }
    }

    const existingOverlap = await LeaveRequest.findOne({
      employee: empId,
      status: { $ne: 'Rejected' },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });
    if (existingOverlap) {
      // If it's a half-day and overlapping record is also a half-day with different periods (First Half vs Second Half), allow it
      if (
        isHalfDayBool &&
        existingOverlap.isHalfDay &&
        existingOverlap.halfDayPeriod &&
        half_day_period &&
        existingOverlap.halfDayPeriod !== half_day_period
      ) {
        // Allowed: one morning half day, one afternoon half day
      } else {
        res.status(400).json({ detail: 'An active or pending leave request already overlaps with the requested date range.' });
        return;
      }
    }
  }

  const leave = new LeaveRequest({
    employee: empId || null,
    leaveType: leave_type,
    startDate,
    endDate,
    isHalfDay: isHalfDayBool,
    halfDayPeriod: isHalfDayBool ? (half_day_period || 'First Half') : null,
    daysCount,
    reason: reason.trim(),
    status: 'Pending',
  });

  await leave.save();

  const emp = empId ? await Employee.findById(empId) : null;

  // Asynchronously dispatch email notification to HR, CEO, CC, and Employee
  sendLeaveApplicationEmail({
    employeeName: emp?.name || 'Employee',
    employeeCode: emp?.employeeCode || 'EMP',
    employeeEmail: emp?.email,
    department: emp?.department,
    leaveType: leave.leaveType,
    startDate: leave.startDate.toISOString().split('T')[0],
    endDate: leave.endDate.toISOString().split('T')[0],
    isHalfDay: leave.isHalfDay,
    halfDayPeriod: leave.halfDayPeriod,
    daysCount: leave.daysCount,
    reason: leave.reason,
  }).catch((err) => console.error('[Leave Email Dispatch Error]', err));

  res.status(201).json({
    id: leave._id,
    employee: emp ? emp._id : null,
    employee_name: emp ? emp.name : 'Employee',
    leave_type: leave.leaveType,
    start_date: leave.startDate ? leave.startDate.toISOString().split('T')[0] : '',
    end_date: leave.endDate ? leave.endDate.toISOString().split('T')[0] : '',
    is_half_day: leave.isHalfDay,
    half_day_period: leave.halfDayPeriod,
    days_count: leave.daysCount,
    days: leave.daysCount,
    reason: leave.reason,
    status: leave.status,
    admin_note: leave.adminNote,
  });
}

export async function updateLeave(req: Request, res: Response): Promise<void> {
  const leave = await LeaveRequest.findById(req.params.id).populate('employee');
  if (!leave) {
    res.status(404).json({ detail: 'Leave request not found.' });
    return;
  }

  const leaveScope = await getRoleDataScope(req.user, 'LEAVES');
  const userPerms = req.user ? await resolveUserPermissions(req.user) : {};
  const leavePerm = userPerms.LEAVES;
  const userFeatures = leavePerm?.features || [];
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = isSuper || leaveScope === 'ALL';
  const isScopedReviewer = leaveScope === 'TEAM' || leaveScope === 'DEPARTMENT';
  const canReview = isManagement || userFeatures.includes('review_leave') || userFeatures.includes('*') || leavePerm?.canEdit;

  if (!isManagement) {
    if (isScopedReviewer || canReview) {
      const ownEmp = await getEmployeeForUser(req.user);
      const targetEmp = leave.employee as any;
      if (!ownEmp || !targetEmp || targetEmp.department !== ownEmp.department) {
        res.status(403).json({ detail: 'Permission denied. You can only decide leaves for your department or team.' });
        return;
      }
    } else {
      res.status(403).json({ detail: 'Permission denied. You do not have permission to decide leave requests.' });
      return;
    }
  }

  const previousStatus = leave.status;
  const { status, admin_note } = req.body;
  if (status) leave.status = status;
  if (admin_note !== undefined) leave.adminNote = admin_note;

  await leave.save();

  const emp = leave.employee as any;

  // If approved and was not previously approved: deduct days from LeaveLedger
  if (status === 'Approved' && previousStatus !== 'Approved' && emp) {
    if (['Sick', 'Casual', 'Annual'].includes(leave.leaveType) && emp.employmentStatus === 'Permanent') {
      const deductQuantity = leave.daysCount || (leave.isHalfDay ? 0.5 : 1.0);
      const currentBal = await getEmployeeLeaveBalance(emp._id);
      const primaryType = leave.leaveType === 'Annual' ? 'Casual' : (leave.leaveType as 'Sick' | 'Casual');

      await new LeaveLedger({
        employee: emp._id,
        leaveType: primaryType,
        transactionType: 'Availed',
        quantity: -deductQuantity,
        balanceAfter: Math.max(0, currentBal.totalPaidLeaveBalance - deductQuantity),
        transactionDate: new Date(),
        notes: `Leave availed: ${deductQuantity} day(s) ${leave.leaveType} (${leave.startDate ? leave.startDate.toISOString().split('T')[0] : ''})`,
        createdBy: req.user?._id || null,
      }).save();
    }
  }

  // If previously approved and now unapproved/rejected: restore days to LeaveLedger
  if (previousStatus === 'Approved' && status && status !== 'Approved' && emp) {
    if (['Sick', 'Casual', 'Annual'].includes(leave.leaveType) && emp.employmentStatus === 'Permanent') {
      const restoreQuantity = leave.daysCount || (leave.isHalfDay ? 0.5 : 1.0);
      const currentBal = await getEmployeeLeaveBalance(emp._id);
      const primaryType = leave.leaveType === 'Annual' ? 'Casual' : (leave.leaveType as 'Sick' | 'Casual');

      await new LeaveLedger({
        employee: emp._id,
        leaveType: primaryType,
        transactionType: 'ManualAdjustment',
        quantity: restoreQuantity,
        balanceAfter: currentBal.totalPaidLeaveBalance + restoreQuantity,
        transactionDate: new Date(),
        notes: `Leave revoked/unapproved: ${restoreQuantity} day(s) ${leave.leaveType} restored (status changed from Approved to ${status})`,
        createdBy: req.user?._id || null,
      }).save();
    }
  }

  // Asynchronously dispatch decision email to Employee, HR, CEO, and CC
  if (status && status !== previousStatus) {
    if (emp?.user) {
      Notification.create({
        user: emp.user,
        title: `Leave ${status}: ${leave.leaveType} Leave`,
        message: `Your leave request for ${leave.startDate ? leave.startDate.toISOString().split('T')[0] : ''} has been ${status.toLowerCase()}.${leave.adminNote ? ` Note: ${leave.adminNote}` : ''}`,
        category: 'leave',
        isRead: false,
        link: '/leaves',
      }).then((notif) => {
        broadcastNotificationToUser(emp.user.toString(), {
          id: notif._id,
          title: notif.title,
          message: notif.message,
          category: notif.category,
          is_read: false,
          created_at: notif.createdAt,
          link: notif.link,
        });
      }).catch(() => {});
    }

    sendLeaveDecisionEmail({
      employeeName: emp?.name || 'Employee',
      employeeCode: emp?.employeeCode || 'EMP',
      employeeEmail: emp?.email,
      department: emp?.department,
      leaveType: leave.leaveType,
      startDate: leave.startDate ? leave.startDate.toISOString().split('T')[0] : '',
      endDate: leave.endDate ? leave.endDate.toISOString().split('T')[0] : '',
      isHalfDay: Boolean(leave.isHalfDay),
      halfDayPeriod: leave.halfDayPeriod,
      daysCount: leave.daysCount || (leave.isHalfDay ? 0.5 : 1),
      reason: leave.reason,
      status: leave.status,
      adminNote: leave.adminNote,
      reviewerName: (req.user as any)?.username || (req.user as any)?.email,
    }).catch((err) => console.error('[Leave Decision Email Error]', err));
  }

  res.json({
    id: leave._id,
    employee: emp ? emp._id : null,
    employee_name: emp ? emp.name : 'Employee',
    leave_type: leave.leaveType,
    start_date: leave.startDate ? leave.startDate.toISOString().split('T')[0] : '',
    end_date: leave.endDate ? leave.endDate.toISOString().split('T')[0] : '',
    is_half_day: Boolean(leave.isHalfDay),
    half_day_period: leave.halfDayPeriod,
    days_count: leave.daysCount || (leave.isHalfDay ? 0.5 : 1),
    days: leave.daysCount || (leave.isHalfDay ? 0.5 : 1),
    reason: leave.reason,
    status: leave.status,
    admin_note: leave.adminNote,
  });
}

export async function decideLeave(req: Request, res: Response): Promise<void> {
  return updateLeave(req, res);
}

export async function getLeaveBalances(req: Request, res: Response): Promise<void> {
  const { employee_id, all } = req.query;

  if (all === 'true') {
    const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
    const leaveScope = await getRoleDataScope(req.user, 'LEAVES');
    const hasGlobalScope = isSuper || leaveScope === 'ALL';

    const filter: any = { status: { $ne: 'Inactive' } };
    if (!hasGlobalScope) {
      const ownEmp = await getEmployeeForUser(req.user);
      if (ownEmp) filter._id = ownEmp._id;
    }

    const employees = await Employee.find(filter).sort({ employeeCode: 1, name: 1 });
    const results = await Promise.all(
      employees.map(async (emp) => {
        const bal = await getEmployeeLeaveBalance(emp._id);
        return {
          employee_id: emp._id,
          employee_name: emp.name,
          employee_code: emp.employeeCode,
          department: emp.department,
          designation: emp.designation,
          ...bal,
        };
      })
    );
    res.json({ count: results.length, results });
    return;
  }

  let targetEmpId = employee_id;

  if (!targetEmpId) {
    const ownEmp = await getEmployeeForUser(req.user);
    if (ownEmp) targetEmpId = ownEmp._id.toString();
  }

  if (!targetEmpId || !mongoose.Types.ObjectId.isValid(targetEmpId as string)) {
    res.status(400).json({ detail: 'Valid employee ID is required.' });
    return;
  }

  const balance = await getEmployeeLeaveBalance(new mongoose.Types.ObjectId(targetEmpId as string));
  res.json(balance);
}

export async function deleteLeave(req: Request, res: Response): Promise<void> {
  const leave = await LeaveRequest.findById(req.params.id);
  if (!leave) {
    res.status(404).json({ detail: 'Leave request not found.' });
    return;
  }

  const leaveScope = await getRoleDataScope(req.user, 'LEAVES');
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isSuperOrAdmin = isSuper || leaveScope === 'ALL';
  if (!isSuperOrAdmin) {
    const ownEmp = await getEmployeeForUser(req.user);
    if (!ownEmp || String(leave.employee) !== String(ownEmp._id) || leave.status !== 'Pending') {
      res.status(403).json({ detail: 'You can only cancel your own pending leave requests.' });
      return;
    }
  }

  if (leave.status === 'Approved' && leave.employee) {
    const emp = await Employee.findById(leave.employee);
    if (emp && ['Sick', 'Casual', 'Annual'].includes(leave.leaveType) && emp.employmentStatus === 'Permanent') {
      const restoreQuantity = leave.daysCount || (leave.isHalfDay ? 0.5 : 1.0);
      const currentBal = await getEmployeeLeaveBalance(emp._id);
      const primaryType = leave.leaveType === 'Annual' ? 'Casual' : (leave.leaveType as 'Sick' | 'Casual');

      await new LeaveLedger({
        employee: emp._id,
        leaveType: primaryType,
        transactionType: 'ManualAdjustment',
        quantity: restoreQuantity,
        balanceAfter: currentBal.totalPaidLeaveBalance + restoreQuantity,
        transactionDate: new Date(),
        notes: `Leave cancelled/deleted: ${restoreQuantity} day(s) ${leave.leaveType} restored`,
        createdBy: req.user?._id || null,
      }).save();
    }
  }

  await LeaveRequest.findByIdAndDelete(req.params.id);
  res.status(204).send();
}

export async function setCarryForwardBalance(req: Request, res: Response): Promise<void> {
  try {
    const { employee_id, carry_forward_days, notes } = req.body;
    if (!employee_id || carry_forward_days === undefined) {
      res.status(400).json({ detail: 'Employee ID and carry_forward_days are required.' });
      return;
    }

    const emp = await Employee.findById(employee_id);
    if (!emp) {
      res.status(404).json({ detail: 'Employee not found.' });
      return;
    }

    if (emp.employmentStatus === 'Probation') {
      res.status(400).json({ detail: 'Cannot set carry-forward leaves for employees on Probation. Only Permanent employees are eligible.' });
      return;
    }

    const targetCarryForward = Math.max(0, Math.round(Number(carry_forward_days) * 10) / 10);
    const currentBal = await getEmployeeLeaveBalance(emp._id);
    const remainingMonthQuota = Math.max(0, 2 - currentBal.availedThisMonth);
    const targetTotalPaid = targetCarryForward + remainingMonthQuota;
    const delta = Math.round((targetTotalPaid - currentBal.totalPaidLeaveBalance) * 10) / 10;

    if (delta !== 0) {
      await new LeaveLedger({
        employee: emp._id,
        leaveType: 'Casual',
        transactionType: 'ManualAdjustment',
        quantity: delta,
        balanceAfter: Math.max(0, currentBal.totalPaidLeaveBalance + delta),
        notes: notes ? String(notes).trim() : `Admin set carry forward to ${targetCarryForward} days (delta: ${delta > 0 ? '+' : ''}${delta})`,
        createdBy: req.user?._id,
      }).save();
    }

    const updatedBal = await getEmployeeLeaveBalance(emp._id);

    try {
      await AuditLog.create({
        user: req.user?._id,
        action: 'UPDATE_CARRY_FORWARD',
        module: 'LEAVES',
        details: `Updated carry forward for ${emp.name} (${emp.employeeCode}) to ${targetCarryForward} days (prev: ${currentBal.carriedForwardBalance})`,
      });
    } catch (err) {}

    res.json({
      message: `Carry forward balance for ${emp.name} successfully set to ${targetCarryForward} days`,
      balance: updatedBal,
    });
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to update carry forward balance.' });
  }
}

