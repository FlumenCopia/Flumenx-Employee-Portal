import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { Client } from '../models/Client.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { ClientWorkShareLink } from '../models/ClientWorkShareLink.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Client definition constants from production
const EXPO_CLIENT = {
  _id: new mongoose.Types.ObjectId('6a925ac35238da59afe9cbb1'),
  name: 'Expo',
  industry: 'General',
  isActive: true,
  notes: '',
  contactPerson: {
    name: '',
    email: '',
    phone: '',
    designation: '',
  },
  website: '',
  address: '',
  retainerMonthlyFee: 0,
  documents: [],
  proposals: [],
  brandAssets: [],
  servicesProvided: [],
};

const SUSRUTHA_CLIENT = {
  _id: new mongoose.Types.ObjectId('6a9507320a79601b366ce107'),
  name: 'Susrutha',
  industry: 'General',
  isActive: true, // Ensured active so it appears in portal views
  notes: '',
  contactPerson: {
    name: '',
    email: '',
    phone: '',
    designation: '',
  },
  website: '',
  address: '',
  retainerMonthlyFee: 0,
  documents: [],
  proposals: [],
  brandAssets: [],
  servicesProvided: [],
};

const statusMap: Record<string, string> = {
  published: 'Published',
  approved: 'Approved',
  progress: 'In Progress',
  assigned: 'Assigned',
  backlog: 'Backlog',
  review: 'In Review',
};

const priorityMap: Record<string, string> = {
  p0: 'Urgent',
  p1: 'High',
  p2: 'Normal',
};

const deptMap: Record<string, string> = {
  dev: 'Development',
  it: 'Development',
  design: 'Design',
  video: 'Video Editing',
  ads: 'Digital Marketing',
  seo: 'Digital Marketing',
  content: 'Digital Marketing',
  qc: 'General',
  ops: 'General',
  client: 'General',
};

const unitMap: Record<string, string> = {
  video: 'Videos',
  design: 'Creatives',
  ads: 'Ad Sets',
  seo: 'Articles',
  content: 'Articles',
  dev: 'Modules',
  it: 'Modules',
};

async function seedClientTasks() {
  console.log('====================================================');
  console.log('🚀 [Seed Client Tasks] Starting Seeding Process...');
  console.log('====================================================');

  await connectDB();

  // 1. Locate Super Admin or Admin user for audit attribution if needed
  const adminUser = await User.findOne({ role: 'SUPER_ADMIN' }) || await User.findOne({});
  const adminId = adminUser ? adminUser._id : null;

  // 2. Ensure Clients Exist with Exact IDs
  console.log('\n[1/4] Ensuring Expo and Susrutha client records exist...');
  for (const clientData of [EXPO_CLIENT, SUSRUTHA_CLIENT]) {
    const existingById = await Client.findById(clientData._id);
    const existingByName = await Client.findOne({ name: clientData.name });

    if (existingById) {
      existingById.name = clientData.name;
      existingById.industry = clientData.industry;
      existingById.isActive = clientData.isActive;
      await existingById.save();
      console.log(`  ✓ Client "${clientData.name}" verified (ID: ${clientData._id})`);
    } else if (existingByName) {
      // If name exists with different ID, update ID or use existing
      existingByName.isActive = clientData.isActive;
      await existingByName.save();
      console.log(`  ✓ Client "${clientData.name}" found by name (ID: ${existingByName._id})`);
    } else {
      const newClient = new Client(clientData);
      await newClient.save();
      console.log(`  ✓ Client "${clientData.name}" created fresh with ID: ${clientData._id}`);
    }
  }

  // 3. Remove ALL client tasks, employee tasks, timers, share links, and related records
  console.log('\n[2/4] Removing all existing client tasks, employee tasks, timers, and task-related records...');
  const currentTasks = await WorkAssignment.countDocuments();
  const currentTimers = await TimeEntry.countDocuments();
  const currentShareLinks = await ClientWorkShareLink.countDocuments();
  console.log(`  • Found ${currentTasks} tasks, ${currentTimers} timers, ${currentShareLinks} task share links before purge.`);

  const deleteTasks = await WorkAssignment.deleteMany({});
  const deleteTimers = await TimeEntry.deleteMany({});
  const deleteShareLinks = await ClientWorkShareLink.deleteMany({});
  const deleteAuditLogs = await AuditLog.deleteMany({ entityType: { $in: ['WorkAssignment', 'TimeEntry', 'Task', 'Timer'] } });

  console.log(`  ✓ Purged ${deleteTasks.deletedCount} tasks (all client & employee tasks).`);
  console.log(`  ✓ Purged ${deleteTimers.deletedCount} timers / time entries.`);
  console.log(`  ✓ Purged ${deleteShareLinks.deletedCount} client work share links.`);
  console.log(`  ✓ Purged ${deleteAuditLogs.deletedCount} task/timer audit logs.`);

  // 4. Load Raw Task JSON Files
  console.log('\n[3/4] Loading and transforming task source data...');
  // Find project root directory
  const rootDir = path.resolve(__dirname, '../../../');
  const expoFilePath = path.join(rootDir, 'masters_command_center.tasks.json');
  const susruthaFilePath = path.join(rootDir, 'susrutha_command_master.tasks.json');

  if (!fs.existsSync(expoFilePath) || !fs.existsSync(susruthaFilePath)) {
    throw new Error(`Task source files not found at ${expoFilePath} or ${susruthaFilePath}`);
  }

  const rawExpoTasks: any[] = JSON.parse(fs.readFileSync(expoFilePath, 'utf8'));
  const rawSusTasks: any[] = JSON.parse(fs.readFileSync(susruthaFilePath, 'utf8'));

  console.log(`  • Loaded ${rawExpoTasks.length} tasks from masters_command_center.tasks.json (Expo)`);
  console.log(`  • Loaded ${rawSusTasks.length} tasks from susrutha_command_master.tasks.json (Susrutha)`);

  function buildWorkAssignment(raw: any, clientId: mongoose.Types.ObjectId, clientName: string) {
    const rawStatus = (raw.status || '').toLowerCase();
    const status = statusMap[rawStatus] || 'Assigned';
    const rawPriority = (raw.priority || '').toLowerCase();
    const priority = priorityMap[rawPriority] || 'Normal';
    const rawType = (raw.type || '').toLowerCase();
    const deptCategory = deptMap[rawType] || 'General';
    const unit = unitMap[rawType] || 'Deliverables';

    const isDone = status === 'Published' || status === 'Approved';
    const inProgress = status === 'In Progress';
    const assignedQty = 1;
    const completedQty = isDone ? 1 : 0;
    const progress = isDone ? 100 : inProgress ? 50 : 0;
    const estHours = Number(raw.hours) || 0;
    const actHours = isDone ? estHours : 0;

    const createdDate = raw.createdAt && raw.createdAt['$date'] ? new Date(raw.createdAt['$date']) : new Date('2026-07-01');
    const updatedDate = raw.updatedAt && raw.updatedAt['$date'] ? new Date(raw.updatedAt['$date']) : createdDate;
    const dueDate = raw.due ? new Date(raw.due) : new Date(Date.now() + 7 * 86400000);
    const completedDate = isDone ? updatedDate : null;

    const taskId = raw._id && raw._id['$oid'] ? new mongoose.Types.ObjectId(raw._id['$oid']) : new mongoose.Types.ObjectId();

    return {
      _id: taskId,
      client: clientId,
      isMasterClientTask: true,
      code: raw.code || '',
      phase: raw.phase || 'ph1',
      deliverableType: raw.deliverable || '',
      note: raw.note || '',
      departmentCategory: deptCategory,
      title: raw.title,
      description: raw.desc || '',
      priority: priority,
      status: status,
      progress: progress,
      assignedQuantity: assignedQty,
      completedQuantity: completedQty,
      unit: unit,
      estimatedHours: estHours,
      actualHours: actHours,
      overrunHours: 0,
      isOverrun: false,
      assignedDate: createdDate,
      dueDate: dueDate,
      completedAt: completedDate,
      assignedBy: adminId,
      // Client tasks have no employee or reviewer assigned initially
      employee: null,
      reviewer: null,
      reviewerName: '',
      reviewStatus: isDone ? 'OK' : 'PENDING_REVIEW',
      reviewNote: '',
      departmentData: {
        code: raw.code || '',
        phase: raw.phase || 'ph1',
        rawType: raw.type,
        deliverableCode: raw.deliverable || null,
        estimatedHours: estHours,
        notes: raw.note || '',
      },
      deliverables: [
        {
          title: raw.title,
          name: raw.title,
          workType: deptCategory,
          dueDate: dueDate,
          status: status,
          contracted: 1,
          delivered: completedQty,
          client: clientId,
        },
      ],
      attachments: [],
      createdAt: createdDate,
      updatedAt: updatedDate,
    };
  }

  const expoDocuments = rawExpoTasks.map((t) => buildWorkAssignment(t, EXPO_CLIENT._id, EXPO_CLIENT.name));
  const susDocuments = rawSusTasks.map((t) => buildWorkAssignment(t, SUSRUTHA_CLIENT._id, SUSRUTHA_CLIENT.name));
  const allDocuments = [...expoDocuments, ...susDocuments];

  // 5. Insert All Transformed Client Tasks
  console.log('\n[4/4] Inserting transformed client master tasks into database...');
  await WorkAssignment.insertMany(allDocuments, { ordered: false });
  console.log(`  ✓ Successfully inserted ${allDocuments.length} client master tasks.`);

  // 6. Verification Summary
  console.log('\n====================================================');
  console.log('📊 [Seed Summary & Verification]');
  console.log('====================================================');
  const expoCount = await WorkAssignment.countDocuments({ client: EXPO_CLIENT._id, isMasterClientTask: true });
  const susCount = await WorkAssignment.countDocuments({ client: SUSRUTHA_CLIENT._id, isMasterClientTask: true });
  const totalClientTasks = await WorkAssignment.countDocuments({ isMasterClientTask: true });
  const totalTasks = await WorkAssignment.countDocuments();

  console.log(`  • Expo Client Master Tasks: ${expoCount} / 59`);
  console.log(`  • Susrutha Client Master Tasks: ${susCount} / 107`);
  console.log(`  • Total Master Client Tasks: ${totalClientTasks}`);
  console.log(`  • Total Database Tasks: ${totalTasks}`);
  console.log(`  • Non-master Tasks remaining: ${totalTasks - totalClientTasks} (should be 0)`);
  console.log('====================================================');
  console.log('✨ Seeding completed successfully!');
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

seedClientTasks().catch((err) => {
  console.error('❌ Error during seeding:', err);
  process.exit(1);
});
