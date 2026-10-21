import mongoose from 'mongoose';
import { ClientDeliverableTracker } from '../models/ClientDeliverableTracker.js';
import { Client } from '../models/Client.js';
import { IWorkAssignment } from '../models/WorkAssignment.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Classify a task into a deliverable category (poster vs video)
 */
export function classifyTaskDeliverable(task: {
  title?: string;
  unit?: string;
  departmentCategory?: string;
  deliverableType?: string;
}): { category: 'poster' | 'video'; type: 'poster' | 'video' | 'reel'; qty: number } {
  const title = (task.title || '').toLowerCase();
  const unit = (task.unit || '').toLowerCase();
  const dept = (task.departmentCategory || '').toLowerCase();

  // Video / Reel detection
  if (
    dept.includes('video') ||
    unit.includes('video') ||
    unit.includes('reel') ||
    unit.includes('short') ||
    title.includes('video') ||
    title.includes('reel') ||
    title.includes('motion') ||
    title.includes('bts') ||
    title.includes('teaser') ||
    title.includes('animation')
  ) {
    const isReel = unit.includes('reel') || title.includes('reel');
    return { category: 'video', type: isReel ? 'reel' : 'video', qty: 1 };
  }

  // Poster / Creative detection (Posters, Creatives, Graphics, Banners, Photos, Flyers, Ad Sets)
  return { category: 'poster', type: 'poster', qty: 1 };
}

/**
 * Main entry point: Check whether task status changed to or from 'Approved'
 */
export async function syncTaskApprovalToDeliverables(
  task: IWorkAssignment,
  previousStatus?: string
): Promise<void> {
  try {
    if (!task.client) return;

    const isApprovedNow = ['Approved', 'Completed', 'Published'].includes(task.status);
    const wasApprovedBefore = previousStatus
      ? ['Approved', 'Completed', 'Published'].includes(previousStatus)
      : false;

    // 1. Task became Approved from a non-approved state -> increment deliverable
    if (isApprovedNow && !wasApprovedBefore) {
      await applyTaskApproval(task);
    }
    // 2. Task was reverted from Approved to a non-approved state -> decrement deliverable
    else if (!isApprovedNow && wasApprovedBefore) {
      await revertTaskApproval(task);
    }
  } catch (err: any) {
    console.error('Error in syncTaskApprovalToDeliverables:', err?.message || err);
  }
}

/**
 * Apply deliverable increment and log item for an approved task
 */
export async function applyTaskApproval(task: IWorkAssignment): Promise<void> {
  if (!task.client) return;

  const clientDoc = await Client.findById(task.client);
  if (!clientDoc) return;

  const date = task.completedAt || new Date();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();

  // Find or create monthly deliverable tracker for client
  let tracker = await ClientDeliverableTracker.findOne({
    $or: [
      { client: clientDoc._id, month, year },
      { clientName: new RegExp(`^${escapeRegex(clientDoc.name.trim())}$`, 'i'), month, year },
    ],
  });

  if (!tracker) {
    tracker = new ClientDeliverableTracker({
      client: clientDoc._id,
      clientName: clientDoc.name.trim(),
      month,
      year,
      cycleLabel: `${month.slice(0, 3).toUpperCase()}-01 TO ${month.slice(0, 3).toUpperCase()}-30`,
      posters: { target: 0, delivered: 0, pending: 0 },
      videos: { target: 0, delivered: 0, pending: 0 },
      yearlyTargetPosters: 0,
      yearlyTargetVideos: 0,
      deliveredItems: [],
      status: 'ACTIVE',
    });
  } else if (!tracker.client) {
    tracker.client = clientDoc._id;
  }

  // Check if already logged for this task
  const alreadyLogged = (tracker.deliveredItems || []).some(
    (item) => item.sourceTaskId && String(item.sourceTaskId) === String(task._id)
  );
  if (alreadyLogged) return;

  const { category, type } = classifyTaskDeliverable(task);
  const qty = Math.max(1, Math.round(Number(task.completedQuantity || task.assignedQuantity || 1)));

  if (category === 'video') {
    tracker.videos.delivered = (tracker.videos.delivered || 0) + qty;
    tracker.videos.pending = Math.max(0, (tracker.videos.target || 0) - tracker.videos.delivered);
  } else {
    tracker.posters.delivered = (tracker.posters.delivered || 0) + qty;
    tracker.posters.pending = Math.max(0, (tracker.posters.target || 0) - tracker.posters.delivered);
  }

  // Auto-extract any link or attachment URL from the task
  let detectedUrl = '';
  if (task.attachments && Array.isArray(task.attachments) && task.attachments.length > 0) {
    const lastAtt = task.attachments[task.attachments.length - 1];
    if (lastAtt && lastAtt.url && lastAtt.url !== '#' && lastAtt.url.startsWith('http')) {
      detectedUrl = lastAtt.url;
    }
  }

  if (!detectedUrl && task.description) {
    const urlMatch = task.description.match(/https?:\/\/[^\s<>"')]+/i);
    if (urlMatch) {
      detectedUrl = urlMatch[0];
    }
  }

  if (!detectedUrl && task.reviewNote) {
    const urlMatch = task.reviewNote.match(/https?:\/\/[^\s<>"')]+/i);
    if (urlMatch) {
      detectedUrl = urlMatch[0];
    }
  }

  tracker.deliveredItems.push({
    id: crypto.randomUUID(),
    deliverableType: type,
    title: task.title || 'Completed Task',
    postUrl: detectedUrl,
    publishedDate: date,
    notes: `Auto-logged via Task Approval: ${task.title} (${task.unit || 'task'})`,
    sourceTaskId: task._id as mongoose.Types.ObjectId,
    sourceTaskTitle: task.title,
    autoSynced: true,
    createdAt: new Date(),
  });

  await tracker.save();
}

/**
 * Revert deliverable count and remove log item if task approval is reverted or task deleted
 */
export async function revertTaskApproval(task: IWorkAssignment): Promise<void> {
  const trackers = await ClientDeliverableTracker.find({
    'deliveredItems.sourceTaskId': task._id,
  });

  for (const tracker of trackers) {
    const matchingItems = tracker.deliveredItems.filter(
      (item) => item.sourceTaskId && String(item.sourceTaskId) === String(task._id)
    );
    if (matchingItems.length === 0) continue;

    const qty = Math.max(1, Math.round(Number(task.completedQuantity || task.assignedQuantity || 1)));

    for (const item of matchingItems) {
      if (item.deliverableType === 'video' || item.deliverableType === 'reel') {
        tracker.videos.delivered = Math.max(0, (tracker.videos.delivered || 0) - qty);
        tracker.videos.pending = Math.max(0, (tracker.videos.target || 0) - tracker.videos.delivered);
      } else {
        tracker.posters.delivered = Math.max(0, (tracker.posters.delivered || 0) - qty);
        tracker.posters.pending = Math.max(0, (tracker.posters.target || 0) - tracker.posters.delivered);
      }
    }

    // Filter out reverted items
    tracker.deliveredItems = tracker.deliveredItems.filter(
      (item) => !item.sourceTaskId || String(item.sourceTaskId) !== String(task._id)
    );

    await tracker.save();
  }
}
