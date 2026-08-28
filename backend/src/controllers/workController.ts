import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { ClientWorkShareLink } from '../models/ClientWorkShareLink.js';
import { syncQuantityState, syncFromDeliverables, syncParentTaskProgression, calculateClientKPIHealth } from '../services/workSyncEngine.js';
import { createShareLink, generateShareToken, getValidShareLink } from '../services/shareLinkService.js';

// --- Client Endpoints ---
export async function getClients(req: Request, res: Response): Promise<void> {
  const clients = await Client.find().sort({ name: 1 });
  const formatted = clients.map((c) => ({
    id: c._id,
    name: c.name,
    is_active: true,
  }));
  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function createClient(req: Request, res: Response): Promise<void> {
  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ detail: 'Client name is required.' });
    return;
  }
  const client = new Client({ name: name.trim() });
  await client.save();
  res.status(201).json({
    id: client._id,
    name: client.name,
    is_active: true,
  });
}

export async function updateClient(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  const client = await Client.findById(req.params.id);
  if (!client) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  if (req.body.name) client.name = req.body.name.trim();
  await client.save();
  res.json({
    id: client._id,
    name: client.name,
    is_active: true,
  });
}

export async function deleteClient(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  await Client.findByIdAndDelete(req.params.id);
  res.status(204).send();
}

// --- WorkAssignment Endpoints ---
export async function getWorkAssignments(req: Request, res: Response): Promise<void> {
  const { employee_id, client_id, status, priority, assigned_to_me } = req.query;

  const filter: any = {};
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  if (!isSuper && !isManagement) {
    // Regular employees and BDEs can ONLY view their own assigned tasks
    const ownEmployee = req.user ? await Employee.findOne({ user: req.user._id }) : null;
    if (!ownEmployee) {
      res.json([]);
      return;
    }

    if (isTeamLead) {
      // Team lead sees their own tasks + tasks assigned to team members in their department
      const deptRegex = ownEmployee.department ? new RegExp(`^${ownEmployee.department.trim()}$`, 'i') : null;
      const teamEmployees = deptRegex ? await Employee.find({ department: deptRegex }).select('_id') : [];
      const teamEmpIds = [ownEmployee._id, ...teamEmployees.map((e) => e._id)];

      if (assigned_to_me === 'true' || employee_id === 'me') {
        filter.employee = ownEmployee._id;
      } else if (employee_id && mongoose.Types.ObjectId.isValid(employee_id as string)) {
        if (teamEmpIds.some((id) => id.toString() === String(employee_id))) {
          filter.employee = employee_id;
        } else {
          // Cross-department access blocked
          res.json({ count: 0, next: null, previous: null, results: [] });
          return;
        }
      } else {
        filter.$or = [
          { employee: { $in: teamEmpIds } },
          { assignedBy: req.user?._id },
          { reviewer: ownEmployee._id },
        ];
      }
    } else {
      // Standard EMPLOYEE or BDE strictly sees only own tasks
      filter.employee = ownEmployee._id;
    }
  } else {
    // SuperAdmin / Admin / HR / Operations
    if (assigned_to_me === 'true' || employee_id === 'me') {
      const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;
      if (ownEmp) filter.employee = ownEmp._id;
    } else if (employee_id && mongoose.Types.ObjectId.isValid(employee_id as string)) {
      filter.employee = employee_id;
    }
  }

  if (client_id && mongoose.Types.ObjectId.isValid(client_id as string)) {
    filter.client = client_id;
  }
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const { is_master_client_task } = req.query;
  if (is_master_client_task === 'true') {
    filter.isMasterClientTask = true;
  } else if (is_master_client_task === 'all') {
    // No filter on isMasterClientTask
  } else {
    filter.isMasterClientTask = { $ne: true };
  }

  const assignments = await WorkAssignment.find(filter)
    .populate('employee client assignedBy reviewer reviewedBy parentTask')
    .sort({ dueDate: 1 });

  const formatted = assignments.map((a) => {
    const emp = a.employee as any;
    const clientObj = a.client as any;
    const reviewerObj = a.reviewer as any;
    const parentObj = a.parentTask as any;
    const progressPct = a.assignedQuantity ? Math.round(((a.completedQuantity || 0) / a.assignedQuantity) * 100) : 0;

    return {
      id: a._id,
      title: a.title,
      description: a.description,
      priority: a.priority,
      status: a.status,
      assigned_date: a.assignedDate.toISOString().split('T')[0],
      due_date: a.dueDate.toISOString().split('T')[0],
      assigned_quantity: a.assignedQuantity,
      completed_quantity: a.completedQuantity,
      progress_percentage: progressPct,
      unit: a.unit,
      employee: emp ? emp._id : null,
      employee_name: emp ? emp.name : 'Unassigned',
      client: clientObj ? clientObj._id : null,
      client_name: clientObj ? clientObj.name : 'General',
      parent_task: parentObj ? parentObj._id : null,
      parent_task_title: parentObj ? parentObj.title : '',
      is_master_client_task: Boolean(a.isMasterClientTask),
      reviewer: reviewerObj ? reviewerObj._id : null,
      reviewer_name: reviewerObj ? `${reviewerObj.firstName} ${reviewerObj.lastName}`.trim() || reviewerObj.username : '',
      review_status: a.reviewStatus,
      review_note: a.reviewNote,
      total_time_spent_seconds: a.totalTimeSpentSeconds || 0,
      active_timer: a.activeTimer && a.activeTimer.startedAt ? {
        started_at: a.activeTimer.startedAt.toISOString(),
        started_by: a.activeTimer.startedBy,
      } : null,
      time_logs: a.timeLogs || [],
      deliverables: (a.deliverables || []).map((d: any) => ({
        id: d._id,
        name: d.name || d.title,
        title: d.title || d.name,
        brief: d.brief,
        work_type: d.workType,
        contracted: d.contracted || 1,
        delivered: d.delivered || (d.status === 'Completed' || d.status === 'Published' ? 1 : 0),
        due_date: d.dueDate ? new Date(d.dueDate).toISOString().split('T')[0] : '',
        status: d.status,
        client: d.client,
      })),
    };
  });

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function startTaskTimer(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;

  // Strictly enforce that only the assigned employee can start the timer
  if (!isSuper) {
    if (!ownEmp || !assignment.employee || String(assignment.employee) !== String(ownEmp._id)) {
      res.status(403).json({ detail: 'Permission denied. You can only start the timer for tasks assigned to you.' });
      return;
    }
  }

  if (assignment.activeTimer && assignment.activeTimer.startedAt) {
    res.status(400).json({ detail: 'Timer is already running for this task.' });
    return;
  }

  assignment.activeTimer = {
    startedAt: new Date(),
    startedBy: req.user ? req.user._id : null,
  };

  if (assignment.status === 'Assigned' || assignment.status === 'Pending' || assignment.status === 'Backlog') {
    assignment.status = 'In Progress';
  }

  await assignment.save();
  res.json(assignment);
}

export async function stopTaskTimer(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  if (!assignment.activeTimer || !assignment.activeTimer.startedAt) {
    res.status(400).json({ detail: 'No active timer found for this task.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;

  // Enforce that only the assigned employee or the user who started it can stop it
  if (!isSuper) {
    const isAssignee = ownEmp && assignment.employee && String(assignment.employee) === String(ownEmp._id);
    const isStarter = assignment.activeTimer.startedBy && req.user && String(assignment.activeTimer.startedBy) === String(req.user._id);
    if (!isAssignee && !isStarter) {
      res.status(403).json({ detail: 'Permission denied. You can only stop timers for your own tasks.' });
      return;
    }
  }

  const startedAt = new Date(assignment.activeTimer.startedAt);
  const now = new Date();
  const durationSeconds = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 1000));

  assignment.timeLogs.push({
    startTime: startedAt,
    endTime: now,
    durationSeconds,
    loggedBy: req.user ? req.user._id : null,
  });

  assignment.totalTimeSpentSeconds = (assignment.totalTimeSpentSeconds || 0) + durationSeconds;
  assignment.activeTimer = null;

  await assignment.save();
  res.json(assignment);
}

export async function getWorkAssignmentsSummary(req: Request, res: Response): Promise<void> {
  const { employee, client, priority, is_master_client_task } = req.query;

  const filter: any = {};
  if (employee) filter.employee = employee;
  if (client) filter.client = client;
  if (priority) filter.priority = priority;

  if (is_master_client_task === 'true') {
    filter.isMasterClientTask = true;
  } else if (is_master_client_task === 'all') {
    // No filter
  } else {
    filter.isMasterClientTask = { $ne: true };
  }

  const assignments = await WorkAssignment.find(filter);

  let total = assignments.length;
  let pending = 0;
  let in_progress = 0;
  let blocked = 0;
  let completed = 0;
  let overdue = 0;
  let review_pending = 0;
  let review_ok = 0;
  let review_correction = 0;

  const todayStr = new Date().toISOString().slice(0, 10);

  for (const a of assignments) {
    if (a.status === 'Pending' || a.status === 'Assigned' || a.status === 'Backlog') pending++;
    else if (a.status === 'In Progress' || a.status === 'Ongoing') in_progress++;
    else if (a.status === 'Blocked') blocked++;
    else if (a.status === 'Completed' || a.status === 'Approved' || a.status === 'Published') completed++;

    const dueDateStr = a.dueDate ? (a.dueDate instanceof Date ? a.dueDate.toISOString().slice(0, 10) : String(a.dueDate)) : '';
    if (dueDateStr && dueDateStr < todayStr && !['Completed', 'Approved', 'Published'].includes(a.status)) {
      overdue++;
    }

    if (a.reviewStatus === 'PENDING_REVIEW') review_pending++;
    else if (a.reviewStatus === 'OK') review_ok++;
    else if (a.reviewStatus === 'CORRECTION_NEEDED') review_correction++;
  }

  res.json({
    total,
    pending,
    in_progress,
    blocked,
    completed,
    overdue,
    review_pending,
    review_ok,
    review_correction,
    overall_progress: total ? Math.round((completed / total) * 100) : 0,
  });
}

async function findWorkAssignmentByIdOrLegacy(id: string): Promise<any> {
  if (mongoose.Types.ObjectId.isValid(id)) {
    const doc = await WorkAssignment.findById(id);
    if (doc) return doc;
  }
  const num = Number(id);
  if (!isNaN(num)) {
    const doc = await WorkAssignment.findOne({ legacyId: num });
    if (doc) return doc;
  }
  return null;
}

export async function getWorkAssignmentById(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }
  await assignment.populate('employee client assignedBy reviewer reviewedBy');
  res.json(assignment);
}

export async function createWorkAssignment(req: Request, res: Response): Promise<void> {
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagementOrLead = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR', 'TEAM_LEAD', 'BDE'].includes(req.user?.role || '');

  if (!isSuper && !isManagementOrLead) {
    res.status(403).json({ detail: 'Permission denied. Only Team Leads and Management can create work assignments.' });
    return;
  }

  const {
    employee,
    client,
    parent_task,
    parentTask,
    is_master_client_task,
    title,
    description,
    priority,
    assigned_date,
    due_date,
    status,
    assigned_quantity,
    unit,
    reviewer,
  } = req.body;

  if (!isSuper && req.user?.role === 'TEAM_LEAD' && employee && req.user) {
    const ownEmp = await Employee.findOne({ user: req.user._id });
    if (ownEmp && ownEmp.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      const targetEmp = await Employee.findById(employee);
      if (targetEmp && targetEmp.department && !deptRegex.test(targetEmp.department) && String(targetEmp._id) !== String(ownEmp._id)) {
        res.status(403).json({ detail: 'Permission denied. Team Leads can only assign tasks to members in their own department.' });
        return;
      }
    }
  }

  if (!title) {
    res.status(400).json({ detail: 'Task title is required.' });
    return;
  }

  const parentId = parent_task || parentTask;

  const rawDeliverables = Array.isArray(req.body.deliverables) ? req.body.deliverables : [];
  const sanitizedDeliverables = rawDeliverables.map((d: any) => {
    const rawStatus = String(d.status || 'Assigned');
    const capStatus = rawStatus === 'assigned' ? 'Assigned' : rawStatus === 'completed' ? 'Completed' : rawStatus === 'in_progress' ? 'In Progress' : rawStatus;
    return {
      id: d.id || String(Math.random()),
      title: (d.title || d.name || 'Deliverable').trim(),
      name: (d.name || d.title || 'Deliverable').trim(),
      type: d.type || d.work_type || '',
      workType: d.workType || d.work_type || 'General',
      contracted: Number(d.contracted || d.assigned_quantity || 1),
      delivered: Number(d.delivered || d.completed_quantity || 0),
      dueDate: d.dueDate || d.due_date ? new Date(d.dueDate || d.due_date) : new Date(Date.now() + 7 * 86400000),
      status: capStatus,
    };
  });

  const assignment = new WorkAssignment({
    employee: employee && mongoose.Types.ObjectId.isValid(employee) ? employee : null,
    client: client && mongoose.Types.ObjectId.isValid(client) ? client : null,
    parentTask: parentId && mongoose.Types.ObjectId.isValid(parentId) ? parentId : null,
    isMasterClientTask: Boolean(is_master_client_task),
    title: title.trim(),
    description: description || '',
    priority: priority || 'Normal',
    assignedDate: assigned_date ? new Date(assigned_date) : new Date(),
    dueDate: due_date ? new Date(due_date) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
    status: status || 'Assigned',
    assignedQuantity: assigned_quantity || 1,
    unit: unit || 'tasks',
    deliverables: sanitizedDeliverables,
    assignedBy: req.user ? req.user._id : null,
    reviewer: reviewer && mongoose.Types.ObjectId.isValid(reviewer) ? reviewer : null,
  });

  syncQuantityState(assignment);
  await assignment.save();

  if (assignment.parentTask) {
    await syncParentTaskProgression(assignment);
  }

  res.status(201).json(assignment);
}

export async function bulkCreateWorkAssignments(req: Request, res: Response): Promise<void> {
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagementOrLead = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR', 'TEAM_LEAD', 'BDE'].includes(req.user?.role || '');

  if (!isSuper && !isManagementOrLead) {
    res.status(403).json({ detail: 'Permission denied. Only Team Leads and Management can create work assignments.' });
    return;
  }

  const { employee, reviewer, priority, tasks } = req.body;

  const tasksList = Array.isArray(tasks) ? tasks : Array.isArray(req.body) ? req.body : [req.body];

  if (!tasksList || tasksList.length === 0) {
    res.status(400).json({ detail: 'Tasks list is required.' });
    return;
  }

  const createdDocs = [];

  for (const t of tasksList) {
    const empId = t.employee || employee;
    const revId = t.reviewer || reviewer;
    const rawClient = t.client || req.body.client;
    const clientVal = rawClient && mongoose.Types.ObjectId.isValid(rawClient) ? rawClient : null;
    const rawParent = t.parent_task || t.parentTask || req.body.parent_task || req.body.parentTask;
    const parentVal = rawParent && mongoose.Types.ObjectId.isValid(rawParent) ? rawParent : null;
    const isMasterTask = Boolean(t.is_master_client_task ?? req.body.is_master_client_task);

    const rawDeliverables = Array.isArray(t.deliverables) ? t.deliverables : Array.isArray(req.body.deliverables) ? req.body.deliverables : [];
    const sanitizedDeliverables = rawDeliverables.map((d: any) => {
      const rawStatus = String(d.status || 'Assigned');
      const capStatus = rawStatus === 'assigned' ? 'Assigned' : rawStatus === 'completed' ? 'Completed' : rawStatus === 'in_progress' ? 'In Progress' : rawStatus;
      return {
        id: d.id || String(Math.random()),
        title: (d.title || d.name || 'Deliverable').trim(),
        name: (d.name || d.title || 'Deliverable').trim(),
        type: d.type || d.work_type || '',
        workType: d.workType || d.work_type || 'General',
        contracted: Number(d.contracted || d.assigned_quantity || 1),
        delivered: Number(d.delivered || d.completed_quantity || 0),
        dueDate: d.dueDate || d.due_date ? new Date(d.dueDate || d.due_date) : new Date(Date.now() + 7 * 86400000),
        status: capStatus,
      };
    });

    const assignment = new WorkAssignment({
      employee: empId && mongoose.Types.ObjectId.isValid(empId) ? empId : null,
      client: clientVal,
      parentTask: parentVal,
      isMasterClientTask: isMasterTask,
      title: (t.title || 'Task').trim(),
      description: t.description || req.body.description || '',
      priority: t.priority || priority || 'Normal',
      assignedDate: t.assigned_date ? new Date(t.assigned_date) : new Date(),
      dueDate: t.due_date ? new Date(t.due_date) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
      status: t.status || 'Assigned',
      assignedQuantity: t.assigned_quantity || req.body.assigned_quantity || 1,
      unit: t.unit || req.body.unit || 'tasks',
      deliverables: sanitizedDeliverables,
      assignedBy: req.user ? req.user._id : null,
      reviewer: revId && mongoose.Types.ObjectId.isValid(revId) ? revId : null,
    });

    syncQuantityState(assignment);
    await assignment.save();

    if (assignment.parentTask) {
      await syncParentTaskProgression(assignment);
    }

    createdDocs.push(assignment);
  }

  res.status(201).json(createdDocs);
}

export async function updateWorkAssignment(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  if (!isSuper && !isManagement) {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp) {
      res.status(403).json({ detail: 'No employee profile found.' });
      return;
    }

    const isAssignee = assignment.employee && String(assignment.employee) === String(ownEmp._id);
    const isReviewer = (assignment.reviewer && String(assignment.reviewer) === String(ownEmp._id)) ||
                       (assignment.reviewer && req.user && String(assignment.reviewer) === String(req.user._id));

    if (isTeamLead) {
      // Check if task belongs to own employee or someone in team lead's department or is reviewer
      const taskEmp = assignment.employee ? await Employee.findById(assignment.employee) : null;
      if (!isReviewer && taskEmp && taskEmp.department !== ownEmp.department && String(assignment.employee) !== String(ownEmp._id)) {
        res.status(403).json({ detail: 'Permission denied. You can only manage tasks within your department or assigned for review.' });
        return;
      }
    } else {
      // Standard employee can update tasks assigned to them OR assigned to them as reviewer
      if (!isAssignee && !isReviewer) {
        res.status(403).json({ detail: 'Permission denied. You can only update tasks assigned to you or assigned to you for review.' });
        return;
      }
    }
  }

  const fields = req.body;
  if (isSuper || isManagement || isTeamLead) {
    if (fields.title) assignment.title = fields.title.trim();
    if (fields.description !== undefined) assignment.description = fields.description;
    if (fields.priority) assignment.priority = fields.priority;
    if (fields.assigned_date) assignment.assignedDate = new Date(fields.assigned_date);
    if (fields.due_date) assignment.dueDate = new Date(fields.due_date);
    if (fields.assigned_quantity) assignment.assignedQuantity = fields.assigned_quantity;
    if (fields.unit) assignment.unit = fields.unit;
    if (fields.parent_task !== undefined || fields.parentTask !== undefined) {
      const parentVal = fields.parent_task || fields.parentTask;
      assignment.parentTask = parentVal && mongoose.Types.ObjectId.isValid(parentVal) ? parentVal : null;
    }
    if (fields.is_master_client_task !== undefined) {
      assignment.isMasterClientTask = Boolean(fields.is_master_client_task);
    }
    if (fields.employee !== undefined || fields.employee_id !== undefined) {
      const empVal = fields.employee || fields.employee_id;
      assignment.employee = empVal && mongoose.Types.ObjectId.isValid(empVal) ? empVal : null;
    }
    if (fields.client !== undefined || fields.client_id !== undefined) {
      const clientVal = fields.client || fields.client_id;
      assignment.client = clientVal && mongoose.Types.ObjectId.isValid(clientVal) ? clientVal : null;
    }
  }

  if (fields.status) {
    assignment.status = fields.status;
    if (['Completed', 'Approved', 'Published'].includes(fields.status)) {
      if (assignment.assignedQuantity && assignment.assignedQuantity > 0) {
        assignment.completedQuantity = assignment.assignedQuantity;
        assignment.progress = 100;
      }
      if (!assignment.completedAt) {
        assignment.completedAt = new Date();
      }
    }
  }
  if (fields.completed_quantity !== undefined) assignment.completedQuantity = Math.max(0, fields.completed_quantity);
  if (fields.deliverables && Array.isArray(fields.deliverables)) {
    assignment.deliverables = fields.deliverables;
  }
  if (fields.employee !== undefined || fields.employee_id !== undefined) {
    const empVal = fields.employee || fields.employee_id;
    assignment.employee = empVal && mongoose.Types.ObjectId.isValid(empVal) ? empVal : null;
  }
  if (fields.client !== undefined || fields.client_id !== undefined) {
    const clientVal = fields.client || fields.client_id;
    assignment.client = clientVal && mongoose.Types.ObjectId.isValid(clientVal) ? clientVal : null;
  }
  if (fields.review_status) assignment.reviewStatus = fields.review_status;
  if (fields.review_note !== undefined) assignment.reviewNote = fields.review_note;
  if (fields.reviewer !== undefined) assignment.reviewer = mongoose.Types.ObjectId.isValid(fields.reviewer) ? fields.reviewer : null;

  if (assignment.deliverables && assignment.deliverables.length > 0) {
    syncFromDeliverables(assignment);
  } else {
    const hasManualQuantity = fields.completed_quantity !== undefined || (assignment.completedQuantity > 0 && !['Completed', 'Published', 'Approved'].includes(fields.status || ''));
    if (hasManualQuantity && assignment.assignedQuantity && assignment.assignedQuantity > 0) {
      assignment.progress = Math.min(100, Math.round((assignment.completedQuantity / assignment.assignedQuantity) * 100));
      if (assignment.completedQuantity >= assignment.assignedQuantity && assignment.status !== 'Completed') {
        assignment.status = 'Completed';
      }
    } else {
      syncQuantityState(assignment);
    }
  }

  await assignment.save();

  if (assignment.parentTask) {
    await syncParentTaskProgression(assignment);
  }

  res.json(assignment);
}

export async function reviewWorkAssignment(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR', 'TEAM_LEAD'].includes(req.user?.role || '');
  const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;

  const isReviewer = (assignment.reviewer && ownEmp && String(assignment.reviewer) === String(ownEmp._id)) ||
                     (assignment.reviewer && req.user && String(assignment.reviewer) === String(req.user._id));

  if (!isSuper && !isManagement && !isReviewer) {
    res.status(403).json({ detail: 'Permission denied. You are not authorized as reviewer for this task.' });
    return;
  }

  const { review_status, review_note, reviewStatus, reviewNote } = req.body;
  const statusToSet = review_status || reviewStatus;
  const noteToSet = review_note !== undefined ? review_note : reviewNote;

  if (!statusToSet || !['OK', 'CORRECTION_NEEDED', 'PENDING_REVIEW'].includes(statusToSet)) {
    res.status(400).json({ detail: 'Invalid review status. Must be OK, CORRECTION_NEEDED, or PENDING_REVIEW.' });
    return;
  }

  assignment.reviewStatus = statusToSet as any;
  if (noteToSet !== undefined) assignment.reviewNote = String(noteToSet).trim();
  assignment.reviewedBy = req.user ? req.user._id : null;
  assignment.reviewedAt = new Date();

  if (statusToSet === 'OK') {
    assignment.status = 'Approved';
    if (assignment.assignedQuantity && assignment.assignedQuantity > 0) {
      assignment.completedQuantity = assignment.assignedQuantity;
      assignment.progress = 100;
    }
    assignment.completedAt = new Date();
  } else if (statusToSet === 'CORRECTION_NEEDED') {
    assignment.status = 'In Progress';
    assignment.completedAt = null;
  }

  await assignment.save();

  if (assignment.parentTask) {
    await syncParentTaskProgression(assignment);
  }

  res.json(assignment);
}

export async function getClientKPIHealthHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid Client ID.' });
    return;
  }
  const health = await calculateClientKPIHealth(id);
  res.json(health);
}

export async function deleteWorkAssignment(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }
  await WorkAssignment.findByIdAndDelete(assignment._id);
  res.status(204).send();
}

// --- Work Deliverables ---
export async function getWorkDeliverables(req: Request, res: Response): Promise<void> {
  const { assignment_id } = req.query;
  if (assignment_id && mongoose.Types.ObjectId.isValid(assignment_id as string)) {
    const assignment = await WorkAssignment.findById(assignment_id).populate('deliverables.client');
    res.json(assignment ? assignment.deliverables : []);
    return;
  }

  const assignments = await WorkAssignment.find({}, 'deliverables');
  const allDeliverables = assignments.flatMap((a) => a.deliverables);
  res.json(allDeliverables);
}

export async function createWorkDeliverable(req: Request, res: Response): Promise<void> {
  const { assignment_id, client_id, title, brief, work_type, due_date, status } = req.body;

  if (!assignment_id || !mongoose.Types.ObjectId.isValid(assignment_id)) {
    res.status(404).json({ detail: 'Parent work assignment not found.' });
    return;
  }

  const assignment = await WorkAssignment.findById(assignment_id);
  if (!assignment) {
    res.status(404).json({ detail: 'Parent work assignment not found.' });
    return;
  }

  const deliverable = {
    client: client_id || assignment.client,
    title: title.trim(),
    brief: brief || '',
    workType: work_type || 'General',
    dueDate: new Date(due_date),
    status: status || 'Assigned',
    completedAt: ['Completed', 'Approved', 'Published'].includes(status) ? new Date() : null,
  };

  assignment.deliverables.push(deliverable as any);
  syncFromDeliverables(assignment);
  await assignment.save();

  res.status(201).json(assignment.deliverables[assignment.deliverables.length - 1]);
}

// --- Work Options & Share Links ---
export async function getWorkEmployeeOptions(req: Request, res: Response): Promise<void> {
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  const empFilter: any = { status: { $ne: 'Inactive' } };

  if (!isSuper && !isManagement && isTeamLead && req.user) {
    const ownEmp = await Employee.findOne({ user: req.user._id });
    if (ownEmp && ownEmp.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      empFilter.$or = [
        { department: deptRegex },
        { _id: ownEmp._id },
      ];
    }
  }

  const employees = await Employee.find(empFilter, '_id name employeeCode department').sort({ name: 1 });
  const userFilter: any = { isActive: true };
  if (isTeamLead && !isSuper && !isManagement) {
    userFilter.role = { $in: ['TEAM_LEAD', 'EMPLOYEE'] };
  }
  const users = await User.find(userFilter, '_id email firstName lastName username role').sort({ firstName: 1 });

  const map = new Map<string, { id: any; name: string; display_name: string; employee_code: string; department: string }>();

  for (const e of employees) {
    map.set(e._id.toString(), {
      id: e._id,
      name: e.name,
      display_name: e.name || e.employeeCode || 'Employee',
      employee_code: e.employeeCode || '',
      department: e.department || 'General',
    });
  }

  for (const u of users) {
    const fullName = `${u.firstName} ${u.lastName}`.trim() || u.username || u.email;
    const existing = Array.from(map.values()).find((emp) => emp.name === fullName);
    if (!existing) {
      map.set(u._id.toString(), {
        id: u._id,
        name: fullName,
        display_name: fullName,
        employee_code: 'USR',
        department: 'Operations',
      });
    }
  }

  res.json(Array.from(map.values()));
}

export async function getWorkReviewerOptions(req: Request, res: Response): Promise<void> {
  const reviewers = await User.find({ isActive: true }, '_id username firstName lastName role').sort({ username: 1 });
  const formatted = reviewers.map((u) => ({
    id: u._id,
    username: u.username,
    name: `${u.firstName} ${u.lastName}`.trim() || u.username,
    display_name: `${u.firstName} ${u.lastName}`.trim() || u.username,
    role: u.role,
  }));
  res.json(formatted);
}

function formatShareLinkDoc(link: any) {
  const doc = link.toObject ? link.toObject() : link;
  const isExpired = doc.expiresAt ? new Date(doc.expiresAt).getTime() < Date.now() : false;
  const isRevoked = Boolean(doc.isRevoked);
  const isValid = !isRevoked && !isExpired;

  return {
    ...doc,
    id: doc._id ? doc._id.toString() : doc.id,
    assignment_title: link.assignment?.title || doc.assignment_title || '',
    client_name: link.client?.name || doc.client_name || '',
    is_revoked: isRevoked,
    is_valid: isValid,
  };
}

export async function getShareLinks(req: Request, res: Response): Promise<void> {
  const filter: any = {};
  if (req.query.client_id) {
    filter.client = req.query.client_id;
  }
  const links = await ClientWorkShareLink.find(filter).populate('client assignment createdBy').sort({ createdAt: -1 });
  const formatted = links.map(formatShareLinkDoc);
  res.json(formatted);
}

export async function createShareLinkHandler(req: Request, res: Response): Promise<void> {
  const { client_id, assignment_id, public_update, expires_in_days, days_valid } = req.body;
  if (!client_id) {
    res.status(400).json({ detail: 'Client ID is required.' });
    return;
  }

  const days = Number(expires_in_days || days_valid || 30);

  const link = await createShareLink({
    clientId: client_id,
    assignmentId: assignment_id,
    publicUpdate: public_update,
    createdById: req.user ? req.user._id.toString() : null,
    expiresInDays: days,
  });

  const populatedLink = await ClientWorkShareLink.findById(link._id).populate('client assignment createdBy');
  res.status(201).json(formatShareLinkDoc(populatedLink || link));
}

export async function revokeShareLink(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Share link not found.' });
    return;
  }
  const link = await ClientWorkShareLink.findById(req.params.id);
  if (!link) {
    res.status(404).json({ detail: 'Share link not found.' });
    return;
  }
  link.isRevoked = true;
  await link.save();
  const populatedLink = await ClientWorkShareLink.findById(link._id).populate('client assignment createdBy');
  res.json(formatShareLinkDoc(populatedLink || link));
}

export async function regenerateShareLink(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Share link not found.' });
    return;
  }
  const link = await ClientWorkShareLink.findById(req.params.id);
  if (!link) {
    res.status(404).json({ detail: 'Share link not found.' });
    return;
  }
  link.token = generateShareToken();
  link.isRevoked = false;
  await link.save();
  const populatedLink = await ClientWorkShareLink.findById(link._id).populate('client assignment createdBy');
  res.json(formatShareLinkDoc(populatedLink || link));
}

export async function getPublicWorkProgress(req: Request, res: Response): Promise<void> {
  const link = await getValidShareLink(req.params.token);
  if (!link) {
    res.status(404).json({ detail: 'Share link expired or invalid.' });
    return;
  }

  let rawAssignments: any[] = [];
  if (link.assignment) {
    const single = await WorkAssignment.findById(link.assignment).populate('employee deliverables.client');
    if (single) rawAssignments = [single];
  } else {
    // Only return Master Client Tasks / Client Agreement Tasks for the client portal
    rawAssignments = await WorkAssignment.find({
      client: link.client,
      isMasterClientTask: true,
    }).populate('employee deliverables.client');

    // Fallback: If no explicit master tasks exist yet, filter for top-level tasks (parentTask: null)
    if (rawAssignments.length === 0) {
      rawAssignments = await WorkAssignment.find({
        client: link.client,
        parentTask: null,
      }).populate('employee deliverables.client');
    }

    // Final fallback: if no parentTask: null exists either, fallback to all tasks
    if (rawAssignments.length === 0) {
      rawAssignments = await WorkAssignment.find({ client: link.client }).populate('employee deliverables.client');
    }
  }

  const formattedAssignments = rawAssignments.map((a) => {
    const progressPct = a.assignedQuantity ? Math.round(((a.completedQuantity || 0) / a.assignedQuantity) * 100) : 0;
    return {
      id: a._id,
      title: a.title,
      description: a.description,
      status: a.status,
      priority: a.priority,
      assigned_date: a.assignedDate ? a.assignedDate.toISOString().split('T')[0] : '',
      due_date: a.dueDate ? a.dueDate.toISOString().split('T')[0] : '',
      assigned_quantity: a.assignedQuantity || 1,
      completed_quantity: a.completedQuantity || 0,
      progress: Math.min(100, Math.max(0, a.progress || progressPct)),
      unit: a.unit || 'tasks',
      is_master_client_task: Boolean(a.isMasterClientTask),
      deliverables: (a.deliverables || []).map((d: any) => ({
        id: d._id,
        name: d.name || d.title,
        title: d.title || d.name,
        brief: d.brief,
        work_type: d.workType,
        contracted: d.contracted || 1,
        delivered: d.delivered || (d.status === 'Completed' || d.status === 'Published' ? 1 : 0),
        status: d.status,
      })),
    };
  });

  let overallProgress = 0;
  if (formattedAssignments.length > 0) {
    const totalAssigned = formattedAssignments.reduce((sum, a) => sum + a.assigned_quantity, 0);
    const totalCompleted = formattedAssignments.reduce((sum, a) => sum + Math.min(a.assigned_quantity, a.completed_quantity), 0);
    overallProgress = totalAssigned > 0 ? Math.min(100, Math.round((totalCompleted / totalAssigned) * 100)) : 0;
  }

  res.json({
    client_name: (link.client as any).name,
    public_update: link.publicUpdate,
    scope: link.assignment ? 'assignment' : 'client',
    overall_progress: overallProgress,
    assignments: formattedAssignments,
    last_updated: (link as any).updatedAt ? (link as any).updatedAt.toISOString() : new Date().toISOString(),
  });
}

export async function incrementDeliverable(req: Request, res: Response): Promise<void> {
  const { id, deliverableId } = req.params;
  const { delta = 1 } = req.body;

  const assignment = await findWorkAssignmentByIdOrLegacy(id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  if (!assignment.deliverables || assignment.deliverables.length === 0) {
    res.status(404).json({ detail: 'No deliverables found on this assignment.' });
    return;
  }

  const deliverable = assignment.deliverables.find(
    (d: any) =>
      String(d._id) === String(deliverableId) ||
      String(d.id) === String(deliverableId) ||
      String(d.legacyId) === String(deliverableId)
  );

  if (!deliverable) {
    res.status(404).json({ detail: 'Deliverable item not found.' });
    return;
  }

  const contracted = (deliverable as any).contracted || 1;
  const currentDelivered =
    (deliverable as any).delivered !== undefined
      ? (deliverable as any).delivered
      : (deliverable as any).status === 'Completed' || (deliverable as any).status === 'Published'
      ? 1
      : 0;

  const targetDelta = Number(delta);
  let newDelivered = currentDelivered + targetDelta;
  if (targetDelta > 0 && currentDelivered === 0) {
    newDelivered = 1;
  } else if (targetDelta < 0 && currentDelivered > 0) {
    newDelivered = 0;
  }
  newDelivered = Math.max(0, Math.min(contracted, newDelivered));

  (deliverable as any).delivered = newDelivered;

  if (newDelivered >= contracted) {
    (deliverable as any).status = 'Completed';
    (deliverable as any).completedAt = new Date();
  } else if (newDelivered > 0) {
    (deliverable as any).status = 'In Progress';
    (deliverable as any).completedAt = null;
  } else {
    (deliverable as any).status = 'Assigned';
    (deliverable as any).completedAt = null;
  }

  syncFromDeliverables(assignment);
  await assignment.save();

  res.json(assignment);
}
