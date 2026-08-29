import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { TimeEntry } from '../models/TimeEntry.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Employee } from '../models/Employee.js';
import { AuditLog } from '../models/AuditLog.js';

function getTodayDateString(d: Date = new Date()): string {
  return d.toISOString().split('T')[0];
}

async function recalculateTaskActualHours(taskId: mongoose.Types.ObjectId | string): Promise<number> {
  const timeEntries = await TimeEntry.find({
    task: taskId,
    status: 'STOPPED',
  });

  const totalSeconds = timeEntries.reduce((sum, te) => sum + (te.durationSeconds || 0), 0);
  const actualHours = Number((totalSeconds / 3600).toFixed(2));

  const task = await WorkAssignment.findById(taskId);
  if (task) {
    task.totalTimeSpentSeconds = totalSeconds;
    task.actualHours = actualHours;
    const est = task.estimatedHours || 0;
    if (est > 0 && actualHours > est) {
      task.isOverrun = true;
      task.overrunHours = Number((actualHours - est).toFixed(2));
    } else {
      task.isOverrun = false;
      task.overrunHours = 0;
    }
    await task.save();
  }

  return actualHours;
}

export async function getActiveTimer(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    const ownEmp = await Employee.findOne({ user: req.user._id });
    if (!ownEmp) {
      res.json(null);
      return;
    }

    const activeEntry = await TimeEntry.findOne({
      employee: ownEmp._id,
      status: { $in: ['RUNNING', 'PAUSED'] },
    })
      .populate({
        path: 'task',
        populate: [
          { path: 'client', select: 'name' },
          { path: 'project', select: 'name' },
        ],
      })
      .populate('client', 'name')
      .populate('project', 'name');

    if (!activeEntry) {
      res.json(null);
      return;
    }

    res.json(activeEntry);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to fetch active timer.' });
  }
}

export async function startTimer(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    const taskId = req.params.id || req.body.taskId || req.body.task_id;
    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      res.status(400).json({ detail: 'Valid task ID is required.' });
      return;
    }

    const task = await WorkAssignment.findById(taskId);
    if (!task) {
      res.status(404).json({ detail: 'Task not found.' });
      return;
    }

    const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
    const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;

    if (!isSuper) {
      if (!ownEmp || !task.employee || String(task.employee) !== String(ownEmp._id)) {
        res.status(403).json({ detail: 'Permission denied. You can only start timers for tasks assigned to you.' });
        return;
      }
    }

    if (!ownEmp) {
      res.status(400).json({ detail: 'Employee profile not linked to account.' });
      return;
    }

    // 1. Single Active Timer Rule: Auto-pause any existing RUNNING timer for this employee
    const existingRunning = await TimeEntry.findOne({
      employee: ownEmp._id,
      status: 'RUNNING',
    });

    if (existingRunning) {
      existingRunning.status = 'PAUSED';
      existingRunning.pauseIntervals.push({
        pausedAt: new Date(),
        resumedAt: null,
        durationSeconds: 0,
      });
      await existingRunning.save();

      // Clear running state on previous task activeTimer
      await WorkAssignment.findByIdAndUpdate(existingRunning.task, { activeTimer: null });
    }

    // 2. Check if there is already a PAUSED timer for THIS EXACT TASK -> Resume it!
    const existingPausedForThisTask = await TimeEntry.findOne({
      employee: ownEmp._id,
      task: task._id,
      status: 'PAUSED',
    });

    if (existingPausedForThisTask) {
      const now = new Date();
      const intervals = existingPausedForThisTask.pauseIntervals || [];
      if (intervals.length > 0) {
        const lastPause = intervals[intervals.length - 1];
        if (!lastPause.resumedAt) {
          lastPause.resumedAt = now;
          lastPause.durationSeconds = Math.max(0, Math.round((now.getTime() - new Date(lastPause.pausedAt).getTime()) / 1000));
        }
      }

      existingPausedForThisTask.status = 'RUNNING';
      await existingPausedForThisTask.save();

      task.activeTimer = {
        startedAt: existingPausedForThisTask.startTime,
        startedBy: req.user._id,
      };
      if (['Assigned', 'Pending', 'Backlog'].includes(task.status)) {
        task.status = 'In Progress';
      }
      await task.save();

      res.json(existingPausedForThisTask);
      return;
    }

    // 3. Create NEW TimeEntry
    const now = new Date();
    const timeEntry = new TimeEntry({
      employee: ownEmp._id,
      user: req.user._id,
      client: task.client || null,
      project: task.project || null,
      task: task._id,
      startTime: now,
      status: 'RUNNING',
      description: req.body.description || '',
      isBillable: req.body.isBillable !== undefined ? Boolean(req.body.isBillable) : true,
      entryDate: getTodayDateString(now),
    });

    await timeEntry.save();

    task.activeTimer = {
      startedAt: now,
      startedBy: req.user._id,
    };
    if (['Assigned', 'Pending', 'Backlog'].includes(task.status)) {
      task.status = 'In Progress';
    }
    await task.save();

    await AuditLog.create({
      actor: req.user._id,
      action: 'TIMER_STARTED',
      entityType: 'TimeEntry',
      entityId: String(timeEntry._id),
      details: { taskTitle: task.title, taskId: task._id },
    });

    res.status(201).json(timeEntry);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to start timer.' });
  }
}

export async function pauseTimer(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }
    const taskId = req.params.id || req.body.taskId;
    const ownEmp = await Employee.findOne({ user: req.user._id });
    if (!ownEmp) {
      res.status(401).json({ detail: 'Employee account required.' });
      return;
    }

    const filter: any = { employee: ownEmp._id, status: 'RUNNING' };
    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      filter.task = taskId;
    }

    const timeEntry = await TimeEntry.findOne(filter);
    if (!timeEntry) {
      res.status(400).json({ detail: 'No active running timer found to pause.' });
      return;
    }

    const now = new Date();
    timeEntry.status = 'PAUSED';
    timeEntry.pauseIntervals.push({
      pausedAt: now,
      resumedAt: null,
      durationSeconds: 0,
    });

    await timeEntry.save();

    await WorkAssignment.findByIdAndUpdate(timeEntry.task, { activeTimer: null });

    await AuditLog.create({
      actor: req.user._id,
      action: 'TIMER_PAUSED',
      entityType: 'TimeEntry',
      entityId: String(timeEntry._id),
      details: { taskId: timeEntry.task },
    });

    res.json(timeEntry);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to pause timer.' });
  }
}

export async function resumeTimer(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }
    const taskId = req.params.id || req.body.taskId;
    const ownEmp = await Employee.findOne({ user: req.user._id });
    if (!ownEmp) {
      res.status(401).json({ detail: 'Employee account required.' });
      return;
    }

    const filter: any = { employee: ownEmp._id, status: 'PAUSED' };
    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      filter.task = taskId;
    }

    const timeEntry = await TimeEntry.findOne(filter);
    if (!timeEntry) {
      res.status(400).json({ detail: 'No paused timer found to resume.' });
      return;
    }

    const now = new Date();
    if (timeEntry.pauseIntervals && timeEntry.pauseIntervals.length > 0) {
      const lastPause = timeEntry.pauseIntervals[timeEntry.pauseIntervals.length - 1];
      if (!lastPause.resumedAt) {
        lastPause.resumedAt = now;
        lastPause.durationSeconds = Math.max(0, Math.round((now.getTime() - new Date(lastPause.pausedAt).getTime()) / 1000));
      }
    }

    timeEntry.status = 'RUNNING';
    await timeEntry.save();

    await WorkAssignment.findByIdAndUpdate(timeEntry.task, {
      activeTimer: { startedAt: timeEntry.startTime, startedBy: req.user._id },
    });

    await AuditLog.create({
      actor: req.user._id,
      action: 'TIMER_RESUMED',
      entityType: 'TimeEntry',
      entityId: String(timeEntry._id),
      details: { taskId: timeEntry.task },
    });

    res.json(timeEntry);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to resume timer.' });
  }
}

export async function stopTimer(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }
    const taskId = req.params.id || req.body.taskId;
    const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;
    const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;

    const filter: any = { status: { $in: ['RUNNING', 'PAUSED'] } };
    if (!isSuper) {
      if (!ownEmp) {
        res.status(401).json({ detail: 'Employee account required.' });
        return;
      }
      filter.employee = ownEmp._id;
    }
    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      filter.task = taskId;
    }

    let timeEntry = await TimeEntry.findOne(filter);

    if (!timeEntry) {
      // Fallback: Check if WorkAssignment itself has an activeTimer or stuck state
      let taskToClean: any = null;
      if (taskId) {
        if (mongoose.Types.ObjectId.isValid(taskId)) {
          taskToClean = await WorkAssignment.findById(taskId);
        } else {
          taskToClean = await WorkAssignment.findOne({ legacy_id: String(taskId) });
        }
      } else if (ownEmp) {
        taskToClean = await WorkAssignment.findOne({ employee: ownEmp._id, 'activeTimer.startedAt': { $ne: null } });
      }

      if (taskToClean) {
        const now = new Date();
        let netSec = 0;
        if (taskToClean.activeTimer && taskToClean.activeTimer.startedAt) {
          const startedAt = new Date(taskToClean.activeTimer.startedAt);
          netSec = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 1000));
          taskToClean.timeLogs = taskToClean.timeLogs || [];
          taskToClean.timeLogs.push({
            startTime: startedAt,
            endTime: now,
            durationSeconds: netSec,
            loggedBy: req.user ? req.user._id : null,
          });
          taskToClean.totalTimeSpentSeconds = (taskToClean.totalTimeSpentSeconds || 0) + netSec;
        }
        taskToClean.activeTimer = null;
        await taskToClean.save();
        const actualHours = await recalculateTaskActualHours(taskToClean._id);
        res.json({
          detail: 'Timer stopped and active state reset successfully.',
          taskActualHours: actualHours,
        });
        return;
      }

      // If no active timer or task state found at all, return status 200 clean confirmation so UI unlocks gracefully
      res.json({ detail: 'No active timer found. Timer state cleared.' });
      return;
    }

    const now = new Date();
    timeEntry.endTime = now;
    timeEntry.status = 'STOPPED';

    // Calculate total net seconds: (endTime - startTime) - sum of pause durations
    const grossSeconds = Math.max(0, Math.round((now.getTime() - new Date(timeEntry.startTime).getTime()) / 1000));

    let pauseSeconds = 0;
    if (timeEntry.pauseIntervals) {
      for (const p of timeEntry.pauseIntervals) {
        if (p.resumedAt) {
          pauseSeconds += p.durationSeconds || Math.max(0, Math.round((new Date(p.resumedAt).getTime() - new Date(p.pausedAt).getTime()) / 1000));
        } else {
          // If currently paused when stopped
          pauseSeconds += Math.max(0, Math.round((now.getTime() - new Date(p.pausedAt).getTime()) / 1000));
        }
      }
    }

    const netSeconds = Math.max(1, grossSeconds - pauseSeconds);
    timeEntry.durationSeconds = netSeconds;
    await timeEntry.save();

    // Recalculate WorkAssignment actualHours & overrun
    const actualHours = await recalculateTaskActualHours(timeEntry.task);

    // Clear activeTimer on WorkAssignment
    await WorkAssignment.findByIdAndUpdate(timeEntry.task, { activeTimer: null });

    await AuditLog.create({
      actor: req.user._id,
      action: 'TIMER_STOPPED',
      entityType: 'TimeEntry',
      entityId: String(timeEntry._id),
      details: { netSeconds, actualHours, taskId: timeEntry.task },
    });

    res.json({
      timeEntry,
      taskActualHours: actualHours,
    });
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to stop timer.' });
  }
}

export async function getTimeEntries(req: Request, res: Response): Promise<void> {
  try {
    const { client_id, project_id, task_id, employee_id, start_date, end_date, is_billable, status } = req.query;
    const filter: any = {};

    const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
    const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR'].includes(req.user?.role || '');

    if (!isSuper && !isManagement) {
      const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;
      if (!ownEmp) {
        res.json({ count: 0, results: [] });
        return;
      }
      filter.employee = ownEmp._id;
    } else if (employee_id && mongoose.Types.ObjectId.isValid(employee_id as string)) {
      filter.employee = employee_id;
    }

    if (client_id && mongoose.Types.ObjectId.isValid(client_id as string)) filter.client = client_id;
    if (project_id && mongoose.Types.ObjectId.isValid(project_id as string)) filter.project = project_id;
    if (task_id && mongoose.Types.ObjectId.isValid(task_id as string)) filter.task = task_id;
    if (is_billable !== undefined) filter.isBillable = is_billable === 'true';
    if (status) filter.status = status;

    if (start_date || end_date) {
      filter.entryDate = {};
      if (start_date) filter.entryDate.$gte = String(start_date);
      if (end_date) filter.entryDate.$lte = String(end_date);
    }

    const entries = await TimeEntry.find(filter)
      .populate('employee', 'name employeeCode department')
      .populate('client', 'name')
      .populate('project', 'name')
      .populate('task', 'title status priority estimatedHours actualHours')
      .sort({ startTime: -1 })
      .limit(1000);

    res.json({
      count: entries.length,
      next: null,
      previous: null,
      results: entries,
    });
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to fetch time entries.' });
  }
}

export async function createManualTimeEntry(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }
    const { taskId, task_id, hours, minutes, duration_seconds, entry_date, description, is_billable } = req.body;
    const targetTaskId = taskId || task_id;

    if (!targetTaskId || !mongoose.Types.ObjectId.isValid(targetTaskId)) {
      res.status(400).json({ detail: 'Valid task ID is required.' });
      return;
    }

    const task = await WorkAssignment.findById(targetTaskId);
    if (!task) {
      res.status(404).json({ detail: 'Task not found.' });
      return;
    }

    const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;
    if (!ownEmp) {
      res.status(401).json({ detail: 'Employee account required.' });
      return;
    }

    let seconds = 0;
    if (duration_seconds) {
      seconds = Number(duration_seconds);
    } else {
      const h = Number(hours || 0);
      const m = Number(minutes || 0);
      seconds = h * 3600 + m * 60;
    }

    if (seconds <= 0) {
      res.status(400).json({ detail: 'Manual time duration must be greater than 0.' });
      return;
    }

    const entryDateStr = entry_date ? String(entry_date) : getTodayDateString();
    const entryDateObj = new Date(entryDateStr);

    const timeEntry = new TimeEntry({
      employee: ownEmp._id,
      user: req.user._id,
      client: task.client || null,
      project: task.project || null,
      task: task._id,
      startTime: entryDateObj,
      endTime: new Date(entryDateObj.getTime() + seconds * 1000),
      durationSeconds: seconds,
      status: 'STOPPED',
      isManualEntry: true,
      description: description || 'Manual time log',
      isBillable: is_billable !== undefined ? Boolean(is_billable) : true,
      entryDate: entryDateStr,
    });

    await timeEntry.save();
    const actualHours = await recalculateTaskActualHours(task._id);

    await AuditLog.create({
      actor: req.user._id,
      action: 'MANUAL_TIME_ENTRY_CREATED',
      entityType: 'TimeEntry',
      entityId: String(timeEntry._id),
      details: { seconds, actualHours, taskTitle: task.title },
    });

    res.status(201).json(timeEntry);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to create manual time entry.' });
  }
}

export async function deleteTimeEntry(req: Request, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ detail: 'Time entry not found.' });
      return;
    }

    const timeEntry = await TimeEntry.findById(req.params.id);
    if (!timeEntry) {
      res.status(404).json({ detail: 'Time entry not found.' });
      return;
    }

    const taskId = timeEntry.task;
    await TimeEntry.findByIdAndDelete(req.params.id);

    const actualHours = await recalculateTaskActualHours(taskId);

    await AuditLog.create({
      actor: req.user?._id || null,
      action: 'TIME_ENTRY_DELETED',
      entityType: 'TimeEntry',
      entityId: req.params.id,
      details: { taskId, actualHours },
    });

    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to delete time entry.' });
  }
}

export async function updateTimeEntry(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ detail: 'Authentication required.' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ detail: 'Time entry not found.' });
      return;
    }

    const timeEntry = await TimeEntry.findById(req.params.id);
    if (!timeEntry) {
      res.status(404).json({ detail: 'Time entry not found.' });
      return;
    }

    const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
    const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR'].includes(req.user?.role || '');
    const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;

    if (!isSuper && !isManagement) {
      if (!ownEmp || String(timeEntry.employee) !== String(ownEmp._id)) {
        res.status(403).json({ detail: 'You do not have permission to edit this time entry.' });
        return;
      }
    }

    const {
      description,
      is_billable,
      isBillable,
      duration_seconds,
      durationSeconds,
      hours,
      minutes,
      start_time,
      startTime,
      end_time,
      endTime,
      entry_date,
      entryDate,
    } = req.body;

    if (description !== undefined) timeEntry.description = String(description).trim();
    if (is_billable !== undefined) timeEntry.isBillable = Boolean(is_billable);
    if (isBillable !== undefined) timeEntry.isBillable = Boolean(isBillable);

    let startObj = timeEntry.startTime;
    const rawStart = start_time || startTime;
    if (rawStart) {
      const parsedStart = new Date(rawStart);
      if (!isNaN(parsedStart.getTime())) {
        startObj = parsedStart;
        timeEntry.startTime = parsedStart;
      }
    }

    let endObj = timeEntry.endTime;
    const rawEnd = end_time || endTime;
    if (rawEnd) {
      const parsedEnd = new Date(rawEnd);
      if (!isNaN(parsedEnd.getTime())) {
        endObj = parsedEnd;
        timeEntry.endTime = parsedEnd;
      }
    }

    let newDuration = timeEntry.durationSeconds;
    const rawSec = duration_seconds ?? durationSeconds;

    if (rawSec !== undefined && !isNaN(Number(rawSec))) {
      newDuration = Math.max(0, Number(rawSec));
    } else if (hours !== undefined || minutes !== undefined) {
      const h = Number(hours || 0);
      const m = Number(minutes || 0);
      newDuration = Math.max(0, h * 3600 + m * 60);
    } else if (startObj && endObj && endObj.getTime() >= startObj.getTime()) {
      newDuration = Math.max(0, Math.round((endObj.getTime() - startObj.getTime()) / 1000));
    }

    timeEntry.durationSeconds = newDuration;

    if (rawStart && !rawEnd && newDuration > 0) {
      timeEntry.endTime = new Date(new Date(rawStart).getTime() + newDuration * 1000);
    }

    const rawEntryDate = entry_date || entryDate;
    if (rawEntryDate) {
      timeEntry.entryDate = String(rawEntryDate);
    } else if (timeEntry.startTime) {
      timeEntry.entryDate = timeEntry.startTime.toISOString().split('T')[0];
    }

    await timeEntry.save();

    const actualHours = await recalculateTaskActualHours(timeEntry.task);

    await AuditLog.create({
      actor: req.user._id,
      action: 'TIME_ENTRY_UPDATED',
      entityType: 'TimeEntry',
      entityId: String(timeEntry._id),
      details: { newDuration, actualHours, taskId: timeEntry.task },
    });

    const populated = await TimeEntry.findById(timeEntry._id)
      .populate('employee', 'name employeeCode department')
      .populate('client', 'name')
      .populate('project', 'name')
      .populate('task', 'title status priority estimatedHours actualHours');

    res.json(populated || timeEntry);
  } catch (error: any) {
    res.status(500).json({ detail: error.message || 'Failed to update time entry.' });
  }
}
