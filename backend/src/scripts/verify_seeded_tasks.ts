import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';

async function verify() {
  await connectDB();

  const total = await WorkAssignment.countDocuments();
  const expoCount = await WorkAssignment.countDocuments({ client: new mongoose.Types.ObjectId('6a925ac35238da59afe9cbb1') });
  const susCount = await WorkAssignment.countDocuments({ client: new mongoose.Types.ObjectId('6a9507320a79601b366ce107') });
  const masterCount = await WorkAssignment.countDocuments({ isMasterClientTask: true });
  const hasAssignee = await WorkAssignment.countDocuments({ employee: { $ne: null } });
  const hasReviewer = await WorkAssignment.countDocuments({ reviewer: { $ne: null } });

  console.log('--- DATABASE VERIFICATION ---');
  console.log('Total tasks in DB:', total);
  console.log('Expo tasks (6a925ac35238da59afe9cbb1):', expoCount);
  console.log('Susrutha tasks (6a9507320a79601b366ce107):', susCount);
  console.log('Master client tasks:', masterCount);
  console.log('Tasks with employee assigned (should be 0):', hasAssignee);
  console.log('Tasks with reviewer assigned (should be 0):', hasReviewer);

  const sampleExpo = await WorkAssignment.findOne({ code: 'EXP-001' }).populate('client');
  console.log('\nSample Expo task (EXP-001):', {
    code: sampleExpo?.code,
    title: sampleExpo?.title,
    clientName: (sampleExpo?.client as any)?.name,
    clientId: (sampleExpo?.client as any)?._id?.toString(),
    isMasterClientTask: sampleExpo?.isMasterClientTask,
    departmentCategory: sampleExpo?.departmentCategory,
    priority: sampleExpo?.priority,
    status: sampleExpo?.status,
    progress: sampleExpo?.progress,
    unit: sampleExpo?.unit,
    deliverablesCount: sampleExpo?.deliverables?.length,
  });

  const sampleSus = await WorkAssignment.findOne({ code: 'SUS-001' }).populate('client');
  console.log('\nSample Susrutha task (SUS-001):', {
    code: sampleSus?.code,
    title: sampleSus?.title,
    clientName: (sampleSus?.client as any)?.name,
    clientId: (sampleSus?.client as any)?._id?.toString(),
    isMasterClientTask: sampleSus?.isMasterClientTask,
    departmentCategory: sampleSus?.departmentCategory,
    priority: sampleSus?.priority,
    status: sampleSus?.status,
    progress: sampleSus?.progress,
    unit: sampleSus?.unit,
    deliverablesCount: sampleSus?.deliverables?.length,
  });

  await mongoose.disconnect();
  process.exit(0);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
