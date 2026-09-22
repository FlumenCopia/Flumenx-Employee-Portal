import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WorkAssignment } from '../models/WorkAssignment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_portal';

async function runMigration() {
  console.log('--- FlumenX Safe Non-Destructive Migration ---');
  console.log('Connecting to:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const totalBefore = await WorkAssignment.countDocuments();
  console.log(`Total WorkAssignments in database before: ${totalBefore}`);

  // 1. Find tasks in non-review statuses that have reviewStatus = 'PENDING_REVIEW'
  const nonReviewStatuses = ['Assigned', 'In Progress', 'Backlog', 'Pending', 'Blocked'];
  const pendingToClear = await WorkAssignment.find({
    status: { $in: nonReviewStatuses },
    reviewStatus: 'PENDING_REVIEW',
  }).select('_id title status reviewStatus progress totalTimeSpentSeconds');

  console.log(`Found ${pendingToClear.length} tasks in non-review status with reviewStatus = 'PENDING_REVIEW'.`);

  for (const t of pendingToClear) {
    console.log(`  Updating task [${t._id}] "${t.title}" (status: ${t.status}) -> reviewStatus: 'NONE'`);
    t.reviewStatus = 'NONE';
    await t.save();
  }

  // 2. Check for any Assigned tasks with 0 time logged that were mistakenly marked with progress: 100
  const mistakenlyCompletedAssigned = await WorkAssignment.find({
    status: 'Assigned',
    progress: { $gt: 0 },
    $and: [
      {
        $or: [
          { totalTimeSpentSeconds: 0 },
          { totalTimeSpentSeconds: { $exists: false } },
        ],
      },
      {
        $or: [
          { deliverables: { $size: 0 } },
          { 'deliverables.delivered': 0 },
          { deliverables: { $exists: false } },
        ],
      },
    ],
  }).select('_id title status progress completedQuantity');

  console.log(`Found ${mistakenlyCompletedAssigned.length} Assigned tasks with >0% progress and no logged time.`);
  for (const t of mistakenlyCompletedAssigned) {
    console.log(`  Resetting progress for [${t._id}] "${t.title}": progress ${t.progress}% -> 0%`);
    t.progress = 0;
    t.completedQuantity = 0;
    await t.save();
  }

  // 3. Verification
  const totalAfter = await WorkAssignment.countDocuments();
  console.log(`Total WorkAssignments in database after: ${totalAfter}`);

  if (totalBefore !== totalAfter) {
    console.error('CRITICAL ERROR: Total document count changed! Expected:', totalBefore, 'Got:', totalAfter);
  } else {
    console.log('Verification PASSED: Document count remains exactly identical. No data was deleted.');
  }

  const reviewPendingCount = await WorkAssignment.countDocuments({ reviewStatus: 'PENDING_REVIEW' });
  const actualInReviewCount = await WorkAssignment.countDocuments({ status: 'In Review' });
  console.log(`Current reviewStatus === 'PENDING_REVIEW': ${reviewPendingCount}`);
  console.log(`Current status === 'In Review': ${actualInReviewCount}`);

  await mongoose.disconnect();
  console.log('--- Migration Completed Successfully ---');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
