import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import { WorkAssignment, WORK_STATUSES, REVIEW_STATUSES, WORK_PRIORITIES } from '../models/WorkAssignment.js';

interface MigrationStats {
  totalDocs: number;
  updatedDocs: number;
  unchangedDocs: number;
  statusChanges: Record<string, number>;
  reviewStatusChanges: Record<string, number>;
  priorityChanges: Record<string, number>;
}

export async function migrateProductionWorkAssignments(isDryRun: boolean = false): Promise<MigrationStats> {
  console.log(`[Production Migration] Starting WorkAssignment migration... (Dry Run: ${isDryRun})`);
  await connectDB();

  const allAssignments = await WorkAssignment.find({});
  console.log(`[Production Migration] Found ${allAssignments.length} total WorkAssignment documents.`);

  const stats: MigrationStats = {
    totalDocs: allAssignments.length,
    updatedDocs: 0,
    unchangedDocs: 0,
    statusChanges: {},
    reviewStatusChanges: {},
    priorityChanges: {},
  };

  const canonicalStatuses = new Set(WORK_STATUSES);
  const validReviewStatuses = new Set(REVIEW_STATUSES);
  const validPriorities = new Set(WORK_PRIORITIES);

  for (const doc of allAssignments) {
    const rawStatus = (doc.status || '').trim();
    let targetStatus = rawStatus;
    let isModified = false;

    // 1. Map status to canonical 5 statuses
    if (rawStatus === 'Pending') {
      targetStatus = doc.employee ? 'Assigned' : 'Backlog';
    } else if (rawStatus === 'Ongoing' || rawStatus === 'Blocked') {
      targetStatus = 'In Progress';
    } else if (rawStatus === 'Changes Requested' || rawStatus === 'Rejected') {
      targetStatus = 'In Review';
    } else if (rawStatus === 'Published') {
      targetStatus = 'Approved';
    } else if (rawStatus === 'Completed') {
      targetStatus = doc.reviewStatus === 'OK' ? 'Approved' : 'In Review';
    } else if (!canonicalStatuses.has(rawStatus as any)) {
      targetStatus = 'Assigned';
    }

    if (targetStatus !== rawStatus) {
      isModified = true;
      const key = `${rawStatus || 'EMPTY'} -> ${targetStatus}`;
      stats.statusChanges[key] = (stats.statusChanges[key] || 0) + 1;
    }

    // 2. Map reviewStatus
    const rawReviewStatus = doc.reviewStatus;
    let targetReviewStatus = rawReviewStatus;

    if (targetStatus === 'Approved') {
      targetReviewStatus = 'OK';
    } else if (targetStatus === 'In Review') {
      if (rawStatus === 'Changes Requested' || rawReviewStatus === 'CORRECTION_NEEDED') {
        targetReviewStatus = 'CORRECTION_NEEDED';
      } else {
        targetReviewStatus = 'PENDING_REVIEW';
      }
    } else if (!targetReviewStatus || !validReviewStatuses.has(targetReviewStatus as any)) {
      targetReviewStatus = 'PENDING_REVIEW';
    }

    if (targetReviewStatus !== rawReviewStatus) {
      isModified = true;
      const key = `${rawReviewStatus || 'EMPTY'} -> ${targetReviewStatus}`;
      stats.reviewStatusChanges[key] = (stats.reviewStatusChanges[key] || 0) + 1;
    }

    // 3. Map priority
    const rawPriority = (doc.priority || '').trim();
    let targetPriority = rawPriority;

    const lowerP = rawPriority.toLowerCase();
    if (lowerP.includes('urgent') || lowerP.includes('critical') || lowerP === 'p0') {
      targetPriority = 'Urgent';
    } else if (lowerP.includes('high') || lowerP === 'p1') {
      targetPriority = 'High';
    } else if (lowerP.includes('low') || lowerP === 'p3') {
      targetPriority = 'Low';
    } else if (lowerP.includes('normal') || lowerP.includes('medium') || lowerP === 'p2' || !validPriorities.has(rawPriority as any)) {
      targetPriority = 'Normal';
    }

    if (targetPriority !== rawPriority) {
      isModified = true;
      const key = `${rawPriority || 'EMPTY'} -> ${targetPriority}`;
      stats.priorityChanges[key] = (stats.priorityChanges[key] || 0) + 1;
    }

    // 4. Update and save if modified
    if (isModified) {
      stats.updatedDocs++;
      if (!isDryRun) {
        doc.status = targetStatus as any;
        doc.reviewStatus = targetReviewStatus as any;
        doc.priority = targetPriority as any;
        if (targetStatus === 'Approved' && !doc.completedAt) {
          doc.completedAt = new Date();
        }
        await doc.save();
      }
    } else {
      stats.unchangedDocs++;
    }
  }

  console.log('\n====================================================');
  console.log(`[Production Migration] Summary (Dry Run: ${isDryRun})`);
  console.log(`Total Documents Scanned: ${stats.totalDocs}`);
  console.log(`Documents Needing Updates: ${stats.updatedDocs}`);
  console.log(`Already Canonical Documents: ${stats.unchangedDocs}`);
  console.log('\n--- Status Transitions ---');
  console.log(JSON.stringify(stats.statusChanges, null, 2));
  console.log('\n--- Review Status Transitions ---');
  console.log(JSON.stringify(stats.reviewStatusChanges, null, 2));
  console.log('\n--- Priority Transitions ---');
  console.log(JSON.stringify(stats.priorityChanges, null, 2));
  console.log('====================================================\n');

  await mongoose.disconnect();
  console.log('[Production Migration] Migration complete.');
  return stats;
}

// CLI Direct Execution Support
if (process.argv[1]?.endsWith('migrate_production_work_assignments.ts') || process.argv[1]?.endsWith('migrate_production_work_assignments.js')) {
  const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  migrateProductionWorkAssignments(isDryRun).catch((err) => {
    console.error('[Production Migration] Migration failed with error:', err);
    process.exit(1);
  });
}
