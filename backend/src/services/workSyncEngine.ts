import { IWorkAssignment, WorkStatusType } from '../models/WorkAssignment.js';

const STATUS_WEIGHT_MAP: Record<string, number> = {
  Backlog: 0.0,
  Assigned: 0.0,
  Pending: 0.0,
  'In Progress': 0.25,
  Ongoing: 0.25,
  'In Review': 0.5,
  'Changes Requested': 0.5,
  Rejected: 0.0,
  Approved: 0.75,
  Completed: 1.0,
  Published: 1.0,
  Blocked: 0.0,
};

export function syncQuantityState(assignment: IWorkAssignment): void {
  const completedStatuses = ['Completed', 'Published'];
  const weight = STATUS_WEIGHT_MAP[assignment.status] ?? 0.0;

  if (assignment.assignedQuantity && assignment.assignedQuantity > 0) {
    assignment.completedQuantity = Math.round(weight * assignment.assignedQuantity * 100) / 100;
    assignment.progress = Math.max(0, Math.min(100, Math.round(weight * 100)));
  } else {
    assignment.completedQuantity = 0;
    assignment.progress = 0;
  }

  if (
    completedStatuses.includes(assignment.status) ||
    (assignment.assignedQuantity && assignment.completedQuantity >= assignment.assignedQuantity)
  ) {
    if (!assignment.completedAt) {
      assignment.completedAt = new Date();
    }
  } else {
    assignment.completedAt = null;
  }
}

export function syncFromDeliverables(assignment: IWorkAssignment): void {
  const rows = assignment.deliverables || [];
  if (rows.length === 0) {
    syncQuantityState(assignment);
    return;
  }

  const assigned = rows.length;
  let sumDelivCompleted = 0;

  for (const row of rows) {
    sumDelivCompleted += STATUS_WEIGHT_MAP[row.status] ?? 0.0;
  }

  const completedStatuses = ['Completed', 'Published'];
  let parentWeight = 0.0;
  if (completedStatuses.includes(assignment.status) && sumDelivCompleted < assigned) {
    parentWeight = 0.0;
  } else {
    parentWeight = STATUS_WEIGHT_MAP[assignment.status] ?? 0.0;
  }

  const parentCompleted = assigned * parentWeight;
  const effectiveCompleted = Math.max(0.0, Math.min(assigned, Math.max(sumDelivCompleted, parentCompleted)));

  assignment.assignedQuantity = assigned;
  assignment.completedQuantity = Math.round(effectiveCompleted * 100) / 100;
  assignment.unit = 'items';
  assignment.progress = assigned > 0 ? Math.max(0, Math.min(100, Math.round((effectiveCompleted / assigned) * 100))) : 0;

  const rowStatuses = new Set(rows.map((r) => r.status));

  if (assigned > 0 && effectiveCompleted >= assigned) {
    if (!completedStatuses.includes(assignment.status)) {
      assignment.status = 'Completed';
    }
    if (!assignment.completedAt) {
      assignment.completedAt = new Date();
    }
  } else {
    if (completedStatuses.includes(assignment.status) && effectiveCompleted < assigned) {
      if (assignment.completedAt) {
        assignment.completedAt = null;
      }
    }

    if (['In Progress', 'In Review', 'Approved', 'Published'].includes(assignment.status)) {
      // Keep state
    } else if (rowStatuses.has('Blocked')) {
      assignment.status = 'Blocked';
    } else if (
      Array.from(rowStatuses).some((s) => ['In Progress', 'Ongoing', 'Completed', 'Approved', 'Published'].includes(s))
    ) {
      assignment.status = 'In Progress';
    } else {
      assignment.status = 'Assigned';
    }
  }
}

export async function syncParentTaskProgression(childAssignment: IWorkAssignment): Promise<void> {
  if (!childAssignment.parentTask) return;

  const parentId = typeof childAssignment.parentTask === 'object' && '_id' in childAssignment.parentTask
    ? (childAssignment.parentTask as any)._id
    : childAssignment.parentTask;

  if (!parentId) return;

  const { WorkAssignment } = await import('../models/WorkAssignment.js');
  const parentTask = await WorkAssignment.findById(parentId);
  if (!parentTask) return;

  // Find all child assignments linked to this parent task
  const childTasks = await WorkAssignment.find({ parentTask: parentId });

  let sumCompletedQty = 0;
  for (const child of childTasks) {
    sumCompletedQty += child.completedQuantity || 0;
  }

  parentTask.completedQuantity = sumCompletedQty;
  if (parentTask.assignedQuantity && parentTask.assignedQuantity > 0) {
    parentTask.progress = Math.min(100, Math.round((sumCompletedQty / parentTask.assignedQuantity) * 100));
  }

  if (parentTask.assignedQuantity && parentTask.completedQuantity >= parentTask.assignedQuantity) {
    parentTask.status = 'Completed';
    if (!parentTask.completedAt) parentTask.completedAt = new Date();
  } else if (sumCompletedQty > 0 && parentTask.status === 'Assigned') {
    parentTask.status = 'In Progress';
  }

  await parentTask.save();
}

export async function calculateClientKPIHealth(clientId: string): Promise<{
  clientId: string;
  totalTasks: number;
  totalAssignedQuantity: number;
  totalCompletedQuantity: number;
  quotaCompletionPct: number;
  onTimeDeliveryPct: number;
  satisfactionScore: number;
  healthStatus: 'Delighted' | 'On Track' | 'Needs Attention' | 'At Risk';
}> {
  const { WorkAssignment } = await import('../models/WorkAssignment.js');

  const assignments = await WorkAssignment.find({ client: clientId });
  const totalTasks = assignments.length;

  if (totalTasks === 0) {
    return {
      clientId,
      totalTasks: 0,
      totalAssignedQuantity: 0,
      totalCompletedQuantity: 0,
      quotaCompletionPct: 100,
      onTimeDeliveryPct: 100,
      satisfactionScore: 100,
      healthStatus: 'Delighted',
    };
  }

  let totalAssignedQuantity = 0;
  let totalCompletedQuantity = 0;
  let completedCount = 0;
  let onTimeCount = 0;

  const todayStr = new Date().toISOString().slice(0, 10);

  for (const a of assignments) {
    totalAssignedQuantity += a.assignedQuantity || 1;
    totalCompletedQuantity += Math.min(a.assignedQuantity || 1, a.completedQuantity || 0);

    const isCompleted = ['Completed', 'Approved', 'Published'].includes(a.status);
    if (isCompleted) {
      completedCount++;
      const completedStr = a.completedAt ? a.completedAt.toISOString().slice(0, 10) : todayStr;
      const dueStr = a.dueDate ? a.dueDate.toISOString().slice(0, 10) : todayStr;
      if (completedStr <= dueStr) {
        onTimeCount++;
      }
    }
  }

  const quotaCompletionPct = totalAssignedQuantity > 0
    ? Math.min(100, Math.round((totalCompletedQuantity / totalAssignedQuantity) * 100))
    : 100;

  const onTimeDeliveryPct = completedCount > 0
    ? Math.round((onTimeCount / completedCount) * 100)
    : 100;

  // Satisfaction score formula
  const satisfactionScore = Math.min(100, Math.round(quotaCompletionPct * 0.7 + onTimeDeliveryPct * 0.3));

  let healthStatus: 'Delighted' | 'On Track' | 'Needs Attention' | 'At Risk' = 'On Track';
  if (satisfactionScore >= 85) healthStatus = 'Delighted';
  else if (satisfactionScore >= 70) healthStatus = 'On Track';
  else if (satisfactionScore >= 50) healthStatus = 'Needs Attention';
  else healthStatus = 'At Risk';

  return {
    clientId,
    totalTasks,
    totalAssignedQuantity,
    totalCompletedQuantity,
    quotaCompletionPct,
    onTimeDeliveryPct,
    satisfactionScore,
    healthStatus,
  };
}
