import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { ChatConversation } from '../models/ChatConversation.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';

async function testChatHub() {
  await connectDB();
  console.log('[Test] Connected to MongoDB');

  const adminUser = (await User.findOne({ isSuperuser: true })) || (await User.findOne());
  const employeeUser = await User.findOne({ _id: { $ne: adminUser?._id } });

  if (!adminUser) {
    console.error('No user found in database.');
    process.exit(1);
  }

  console.log(`[Test] Admin user: ${adminUser.username} (${adminUser._id})`);
  if (employeeUser) {
    console.log(`[Test] Employee user: ${employeeUser.username} (${employeeUser._id})`);
  }

  // 1. Create or Find General Company Channel
  let generalGroup = await ChatConversation.findOne({ name: 'FLUMENX General HQ' });
  if (!generalGroup) {
    const participants: any[] = [
      { user: adminUser._id, role: 'ADMIN', joinedAt: new Date(), lastReadAt: new Date() },
    ];
    if (employeeUser) {
      participants.push({
        user: employeeUser._id,
        role: 'MEMBER',
        joinedAt: new Date(),
        lastReadAt: new Date(),
      });
    }

    generalGroup = await ChatConversation.create({
      type: 'GROUP',
      name: 'FLUMENX General HQ',
      description: 'Official company-wide announcements, discussions, and updates',
      createdBy: adminUser._id,
      participants,
      lastMessageText: 'Welcome to FLUMENX Team Chat Hub!',
      lastMessageAt: new Date(),
    });
    console.log(`[Test] Created general group: ${generalGroup._id}`);
  }

  // 2. Post a Welcome Message
  const welcomeMsg = await ChatMessage.create({
    conversation: generalGroup._id,
    sender: adminUser._id,
    senderName: adminUser.username || 'Admin',
    senderRole: 'ADMIN',
    messageType: 'TEXT',
    text: '🚀 Welcome to FLUMENX Team Chat! You can collaborate 1-to-1, join department channels, launch video calls, and link active tasks directly in conversations.',
    isPinned: true,
    pinnedBy: adminUser._id,
    pinnedAt: new Date(),
  });

  generalGroup.pinnedMessages = [welcomeMsg._id as any];
  await generalGroup.save();
  console.log(`[Test] Created and pinned welcome message: ${welcomeMsg._id}`);

  // 3. Test Task Embed in Chat
  const sampleTask = await WorkAssignment.findOne();
  if (sampleTask) {
    const taskMsg = await ChatMessage.create({
      conversation: generalGroup._id,
      sender: adminUser._id,
      senderName: adminUser.username || 'Admin',
      senderRole: 'ADMIN',
      messageType: 'TASK_EMBED',
      text: `📌 Linked Task: ${sampleTask.title}`,
      taskEmbed: {
        id: sampleTask._id,
        title: sampleTask.title,
        status: sampleTask.status,
        priority: sampleTask.priority,
        completedQuantity: sampleTask.completedQuantity || 0,
        assignedQuantity: sampleTask.assignedQuantity || 1,
        unit: sampleTask.unit || 'units',
        employeeName: 'Team Member',
      },
    });
    console.log(`[Test] Created Task Embed message: ${taskMsg._id}`);
  }

  // 4. Test Daily Standup Card in Chat
  const standupMsg = await ChatMessage.create({
    conversation: generalGroup._id,
    sender: adminUser._id,
    senderName: adminUser.username || 'Admin',
    senderRole: 'ADMIN',
    messageType: 'STANDUP_UPDATE',
    text: '⚡ Daily Work Update (31 Aug 2026)',
    standupData: {
      date: '31 Aug 2026',
      completedTasks: ['Completed client brand guidelines asset export', 'Reviewed and approved 4 pending deliverables'],
      inProgressTasks: ['Editing Video Deliverable #2', 'Scheduling weekly client sync'],
      blockers: ['Awaiting footage review for Project Alpha'],
      note: 'On track to meet all milestone deadlines today',
    },
  });
  console.log(`[Test] Created Daily Standup update message: ${standupMsg._id}`);

  console.log('[Test] Chat Hub E2E initialization completed successfully!');
  process.exit(0);
}

testChatHub().catch((err) => {
  console.error('[Test Error]:', err);
  process.exit(1);
});
