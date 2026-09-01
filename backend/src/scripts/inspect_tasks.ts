import mongoose from 'mongoose';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';
import { Employee } from '../models/Employee.js';

async function inspectWork() {
  await mongoose.connect('mongodb://127.0.0.1:27017/flumenx_portal');
  console.log('Inspecting all tasks in DB...');

  const allTasks = await WorkAssignment.find({})
    .populate('client employee')
    .sort({ createdAt: -1 });

  console.log(`Total WorkAssignments in DB: ${allTasks.length}`);

  for (const t of allTasks) {
    console.log({
      id: t._id,
      title: t.title,
      isMasterClientTask: t.isMasterClientTask,
      client: (t.client as any)?.name || t.client,
      employee: (t.employee as any)?.name || t.employee,
      parentTask: t.parentTask,
      dueDate: t.dueDate,
    });
  }

  await mongoose.disconnect();
}

inspectWork().catch(console.error);
