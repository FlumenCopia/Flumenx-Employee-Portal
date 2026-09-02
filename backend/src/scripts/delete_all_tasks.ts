import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import { WorkAssignment } from '../models/WorkAssignment.js';

async function deleteAllTasks() {
  await connectDB();
  console.log('[Delete All Tasks] Connecting to database...');

  const initialCount = await WorkAssignment.countDocuments();
  console.log(`[Delete All Tasks] Current total tasks in database: ${initialCount}`);

  const deleteResult = await WorkAssignment.deleteMany({});
  console.log(`[Delete All Tasks] Successfully deleted ${deleteResult.deletedCount} tasks.`);

  const finalCount = await WorkAssignment.countDocuments();
  console.log(`[Delete All Tasks] Remaining tasks in database: ${finalCount}`);

  await mongoose.disconnect();
  console.log('[Delete All Tasks] Database disconnected.');
  process.exit(0);
}

deleteAllTasks().catch((err) => {
  console.error('[Delete All Tasks] Error deleting tasks:', err);
  process.exit(1);
});
