import { Request, Response } from 'express';
import { Employee } from '../models/Employee.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Meeting } from '../models/Meeting.js';
import { getISTDateRange } from './attendanceController.js';
import { getEmployeeForUser } from '../utils/employeeResolver.js';
import { buildDataScopeFilter } from '../services/scopeResolver.js';

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const empDoc = await getEmployeeForUser(user);
  const employeeId = empDoc?._id;

  // Management counts
  const totalEmployees = await Employee.countDocuments({ status: 'Active' });
  const pendingLeaves = await LeaveRequest.countDocuments({ status: 'Pending' });

  const { startOfDay, endOfDay } = getISTDateRange();

  const presentToday = await AttendanceRecord.countDocuments({
    attendanceDate: { $gte: startOfDay, $lte: endOfDay },
    attendanceStatus: {
      $in: ['Present', 'Present (Late)', 'Present (Early Exit)', 'Present (Late + Early Exit)'],
    },
  });

  // Dynamic scope for work assignments
  const workFilter = user ? await buildDataScopeFilter(user, 'TASKS') : {};

  const activeTasks = await WorkAssignment.countDocuments({
    ...workFilter,
    status: { $in: ['In Progress', 'Assigned', 'Ongoing', 'In Review'] },
  });

  const completedTasks = await WorkAssignment.countDocuments({
    ...workFilter,
    status: { $in: ['Approved', 'Completed', 'Published'] },
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const overdueTasks = await WorkAssignment.countDocuments({
    ...workFilter,
    status: { $nin: ['Approved', 'Completed', 'Published'] },
    dueDate: { $lt: new Date(todayIso) },
  });

  // Scoped recent tasks
  const recentWorkDocs = await WorkAssignment.find(workFilter)
    .sort({ createdAt: -1 })
    .limit(8)
    .populate('employee', 'firstName lastName employeeCode')
    .populate('client', 'name')
    .lean();

  const recent_tasks = recentWorkDocs.map((w: any) => ({
    id: w._id,
    title: w.title,
    client_name: w.client?.name || 'General',
    employee_name: w.employee ? `${w.employee.firstName} ${w.employee.lastName}` : '',
    employee_code: w.employee?.employeeCode || '',
    due_date: w.dueDate ? new Date(w.dueDate).toISOString().slice(0, 10) : '',
    status: w.status,
    priority: w.priority || 'Normal',
  }));

  // Today's attendance for the logged in employee
  let todayRecord: any = null;
  let monthlySummary: any = null;
  if (employeeId) {
    const rec = await AttendanceRecord.findOne({
      employee: employeeId,
      attendanceDate: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    if (rec) {
      todayRecord = {
        id: rec._id,
        attendance_date: rec.attendanceDate,
        attendance_status: rec.attendanceStatus,
        check_in_time: rec.checkInTime,
        check_out_time: rec.checkOutTime,
        working_hours: rec.workingHours || 0,
      };
    }

    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const monthRecords = await AttendanceRecord.find({
      employee: employeeId,
      attendanceDate: { $gte: startOfMonth, $lte: endOfDay },
    }).lean();

    const presentCount = monthRecords.filter((r) => r.attendanceStatus?.startsWith('Present')).length;
    const totalRecorded = monthRecords.length || 1;
    monthlySummary = {
      total_days: monthRecords.length,
      present_days: presentCount,
      attendance_percentage: Math.round((presentCount / totalRecorded) * 100),
    };
  }

  // Upcoming meetings
  let meetings: any[] = [];
  try {
    const upcomingMeetings = await Meeting.find({
      startTime: { $gte: startOfDay },
    })
      .sort({ startTime: 1 })
      .limit(5)
      .lean();

    meetings = upcomingMeetings.map((m: any) => ({
      id: m._id,
      title: m.title,
      date: m.startTime ? new Date(m.startTime).toISOString().slice(0, 10) : '',
      time: m.startTime ? new Date(m.startTime).toTimeString().slice(0, 5) : '',
      location: (m.settings as any)?.roomName || 'Online',
      department: (m.participants?.[0] as any)?.department || 'All Team',
    }));
  } catch (err) {
    console.warn('[dashboardController] Meetings query skipped:', err);
  }

  // Pending leaves
  const leaveFilter = user ? await buildDataScopeFilter(user, 'LEAVES') : { status: 'Pending' };
  const pendingLeaveDocs = await LeaveRequest.find({ ...leaveFilter, status: 'Pending' })
    .limit(5)
    .populate('employee', 'firstName lastName employeeCode')
    .lean();

  const pending_leave_items = pendingLeaveDocs.map((l: any) => ({
    id: l._id,
    employee_name: l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : '',
    employee_code: l.employee?.employeeCode || '',
    leave_type: l.leaveType,
    start_date: l.startDate ? new Date(l.startDate).toISOString().slice(0, 10) : '',
    end_date: l.endDate ? new Date(l.endDate).toISOString().slice(0, 10) : '',
    days: l.totalDays || 1,
    reason: l.reason || '',
  }));

  res.json({
    total_employees: totalEmployees,
    present_today: presentToday,
    pending_leaves: pendingLeaves,
    pending_leave_items,
    active_tasks: activeTasks,
    completed_tasks: completedTasks,
    work_stats: {
      active_tasks: activeTasks,
      completed_tasks: completedTasks,
      overdue_tasks: overdueTasks,
    },
    recent_tasks,
    recent_work_items: recent_tasks,
    attendance: {
      today: todayRecord,
      monthly: monthlySummary,
    },
    upcoming_meetings: meetings,
  });
}
