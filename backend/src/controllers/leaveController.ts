import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Employee } from '../models/Employee.js';

export async function getLeaves(req: Request, res: Response): Promise<void> {
  const { employee_id, status } = req.query;

  const filter: any = {};
  if (status) filter.status = status;

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'HR', 'OPERATIONS', 'OPERATIONS_HEAD'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  if (!isSuper && !isManagement) {
    const ownEmployee = await Employee.findOne({ user: req.user?._id });
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
    return {
      id: l._id,
      employee: emp ? emp._id : null,
      employee_name: emp ? emp.name : 'Employee',
      employee_code: emp ? emp.employeeCode : 'N/A',
      leave_type: l.leaveType,
      start_date: l.startDate ? l.startDate.toISOString().split('T')[0] : '',
      end_date: l.endDate ? l.endDate.toISOString().split('T')[0] : '',
      reason: l.reason,
      status: l.status,
      admin_note: l.adminNote,
      days: l.startDate && l.endDate ? Math.ceil((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / (1000 * 3600 * 24)) + 1 : 1,
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
  const { employee_id, leave_type, start_date, end_date, reason } = req.body;

  let empId = employee_id;
  const isSuperOrHR = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(req.user?.role || '') || req.user?.isSuperuser;

  if (!isSuperOrHR || !empId) {
    const emp = await Employee.findOne({ user: req.user?._id });
    if (emp) empId = emp._id;
  }

  if (!leave_type || !start_date || !end_date || !reason) {
    res.status(400).json({ detail: 'Leave type, start date, end date, and reason are required.' });
    return;
  }

  const leave = new LeaveRequest({
    employee: empId || null,
    leaveType: leave_type,
    startDate: new Date(start_date),
    endDate: new Date(end_date),
    reason: reason.trim(),
    status: 'Pending',
  });

  await leave.save();

  const emp = empId ? await Employee.findById(empId) : null;
  res.status(201).json({
    id: leave._id,
    employee: emp ? emp._id : null,
    employee_name: emp ? emp.name : 'Employee',
    leave_type: leave.leaveType,
    start_date: leave.startDate ? leave.startDate.toISOString().split('T')[0] : '',
    end_date: leave.endDate ? leave.endDate.toISOString().split('T')[0] : '',
    reason: leave.reason,
    status: leave.status,
    admin_note: leave.adminNote,
    days: Math.ceil((leave.endDate.getTime() - leave.startDate.getTime()) / (1000 * 3600 * 24)) + 1,
  });
}

export async function updateLeave(req: Request, res: Response): Promise<void> {
  const leave = await LeaveRequest.findById(req.params.id).populate('employee');
  if (!leave) {
    res.status(404).json({ detail: 'Leave request not found.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isHRorAdmin = ['ADMIN', 'HR', 'OPERATIONS', 'OPERATIONS_HEAD'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  if (!isSuper && !isHRorAdmin) {
    if (isTeamLead) {
      const ownEmp = await Employee.findOne({ user: req.user?._id });
      const targetEmp = leave.employee as any;
      if (!ownEmp || !targetEmp || targetEmp.department !== ownEmp.department) {
        res.status(403).json({ detail: 'Permission denied. Team leads can only decide leaves for their department.' });
        return;
      }
    } else {
      res.status(403).json({ detail: 'Permission denied. Only HR, Administrators, or Team Leads can decide leave requests.' });
      return;
    }
  }

  const { status, admin_note } = req.body;
  if (status) leave.status = status;
  if (admin_note !== undefined) leave.adminNote = admin_note;

  await leave.save();

  const emp = leave.employee as any;
  res.json({
    id: leave._id,
    employee: emp ? emp._id : null,
    employee_name: emp ? emp.name : 'Employee',
    leave_type: leave.leaveType,
    start_date: leave.startDate ? leave.startDate.toISOString().split('T')[0] : '',
    end_date: leave.endDate ? leave.endDate.toISOString().split('T')[0] : '',
    reason: leave.reason,
    status: leave.status,
    admin_note: leave.adminNote,
    days: Math.ceil((leave.endDate.getTime() - leave.startDate.getTime()) / (1000 * 3600 * 24)) + 1,
  });
}

export async function decideLeave(req: Request, res: Response): Promise<void> {
  return updateLeave(req, res);
}

export async function deleteLeave(req: Request, res: Response): Promise<void> {
  const leave = await LeaveRequest.findById(req.params.id);
  if (!leave) {
    res.status(404).json({ detail: 'Leave request not found.' });
    return;
  }

  const isSuperOrAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR'].includes(req.user?.role || '') || req.user?.isSuperuser;
  if (!isSuperOrAdmin) {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp || String(leave.employee) !== String(ownEmp._id) || leave.status !== 'Pending') {
      res.status(403).json({ detail: 'You can only cancel your own pending leave requests.' });
      return;
    }
  }

  await LeaveRequest.findByIdAndDelete(req.params.id);
  res.status(204).send();
}
