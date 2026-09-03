import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { ClientWorkShareLink } from '../models/ClientWorkShareLink.js';
import { AuditLog } from '../models/AuditLog.js';

async function deleteAllTasks() {
  await connectDB();
  console.log('[Delete All Tasks] Connecting to database...');

  const initialTasks = await WorkAssignment.countDocuments();
  const initialTimers = await TimeEntry.countDocuments();
  const initialShareLinks = await ClientWorkShareLink.countDocuments();
  console.log(`[Delete All Tasks] Current total tasks: ${initialTasks}, timers: ${initialTimers}, share links: ${initialShareLinks}`);

  const deleteTasks = await WorkAssignment.deleteMany({});
  const deleteTimers = await TimeEntry.deleteMany({});
  const deleteShareLinks = await ClientWorkShareLink.deleteMany({});
  const deleteAuditLogs = await AuditLog.deleteMany({ entityType: { $in: ['WorkAssignment', 'TimeEntry', 'Task', 'Timer'] } });

  console.log(`[Delete All Tasks] Successfully deleted ${deleteTasks.deletedCount} tasks.`);
  console.log(`[Delete All Tasks] Successfully deleted ${deleteTimers.deletedCount} timers / time entries.`);
  console.log(`[Delete All Tasks] Successfully deleted ${deleteShareLinks.deletedCount} client work share links.`);
  console.log(`[Delete All Tasks] Successfully deleted ${deleteAuditLogs.deletedCount} task/timer audit logs.`);

  const finalTasks = await WorkAssignment.countDocuments();
  const finalTimers = await TimeEntry.countDocuments();
  console.log(`[Delete All Tasks] Remaining tasks: ${finalTasks}, remaining timers: ${finalTimers}`);

  await mongoose.disconnect();
  console.log('[Delete All Tasks] Database disconnected.');
  process.exit(0);
}

deleteAllTasks().catch((err) => {
  console.error('[Delete All Tasks] Error deleting tasks:', err);
  process.exit(1);
});
