import { Request, Response } from 'express';
import { Employee } from '../models/Employee.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { LeaveRequest } from '../models/LeaveRequest.js';

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const totalEmployees = await Employee.countDocuments({ status: 'Active' });
  const pendingLeaves = await LeaveRequest.countDocuments({ status: 'Pending' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const presentToday = await AttendanceRecord.countDocuments({
    attendanceDate: { $gte: today, $lte: endOfDay },
    attendanceStatus: {
      $in: ['Present', 'Present (Late)', 'Present (Early Exit)', 'Present (Late + Early Exit)'],
    },
  });

  const activeTasks = await WorkAssignment.countDocuments({
    status: { $in: ['In Progress', 'Assigned', 'Ongoing', 'In Review'] },
  });

  const completedTasks = await WorkAssignment.countDocuments({
    status: { $in: ['Completed', 'Published'] },
  });

  res.json({
    total_employees: totalEmployees,
    present_today: presentToday,
    pending_leaves: pendingLeaves,
    active_tasks: activeTasks,
    completed_tasks: completedTasks,
  });
}
