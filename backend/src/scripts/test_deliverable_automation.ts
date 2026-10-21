import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Client } from '../models/Client.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { ClientDeliverableTracker } from '../models/ClientDeliverableTracker.js';
import {
  syncTaskApprovalToDeliverables,
  revertTaskApproval,
  classifyTaskDeliverable,
} from '../services/deliverableSyncEngine.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

async function runDeliverableAutomationTest() {
  console.log('\n======================================================');
  console.log('🧪 DELIVERABLE AUTOMATION SYSTEM INTEGRATION TEST');
  console.log('======================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_portal';
  console.log(`Connecting to MongoDB at: ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.\n');

  const now = new Date();
  const currentMonth = MONTH_NAMES[now.getMonth()];
  const currentYear = now.getFullYear();

  let testClient: any = null;
  let testTracker: any = null;
  let posterTask: any = null;
  let videoTask: any = null;

  try {
    // -----------------------------------------------------------
    // Step 1: Unit Classification Checks
    // -----------------------------------------------------------
    console.log('--- Step 1: Testing Deliverable Classification Logic ---');
    const class1 = classifyTaskDeliverable({ title: 'Diwali Creative Flyer', unit: 'creatives' });
    console.log(`- "Diwali Creative Flyer": Category=${class1.category}, Type=${class1.type} [Expected: poster, poster]`);
    if (class1.category !== 'poster') throw new Error('Poster classification failed');

    const class2 = classifyTaskDeliverable({ title: 'Product Launch Instagram Reel', unit: 'reels' });
    console.log(`- "Product Launch Instagram Reel": Category=${class2.category}, Type=${class2.type} [Expected: video, reel]`);
    if (class2.category !== 'video' || class2.type !== 'reel') throw new Error('Reel classification failed');

    const class3 = classifyTaskDeliverable({ title: 'Company Promo Video Edit', unit: 'video' });
    console.log(`- "Company Promo Video Edit": Category=${class3.category}, Type=${class3.type} [Expected: video, video]`);
    if (class3.category !== 'video') throw new Error('Video classification failed');

    console.log('✅ Deliverable Classification verified.\n');

    // -----------------------------------------------------------
    // Step 2: Setup Test Client & Tracker
    // -----------------------------------------------------------
    console.log('--- Step 2: Setting up Mock Test Client & Tracker ---');
    const testClientName = `TEST_CLIENT_${Date.now()}`;
    testClient = await Client.create({
      name: testClientName,
      status: 'Active',
      industry: 'Technology',
    });
    console.log(`- Created Test Client: "${testClient.name}" (_id: ${testClient._id})`);

    testTracker = await ClientDeliverableTracker.create({
      client: testClient._id,
      clientName: testClient.name,
      month: currentMonth,
      year: currentYear,
      cycleLabel: `${currentMonth.slice(0, 3).toUpperCase()}-01 TO ${currentMonth.slice(0, 3).toUpperCase()}-30`,
      posters: { target: 10, delivered: 0, pending: 10 },
      videos: { target: 5, delivered: 0, pending: 5 },
      yearlyTargetPosters: 120,
      yearlyTargetVideos: 60,
      deliveredItems: [],
      status: 'ACTIVE',
    });
    console.log(`- Initialized Tracker: Posters=0/10, Videos=0/5`);
    console.log('✅ Mock Client and Monthly Tracker ready.\n');

    // -----------------------------------------------------------
    // Step 3: Test Poster Task Approval & URL Auto-Extraction
    // -----------------------------------------------------------
    console.log('--- Step 3: Simulating Employee Poster Task Completion ---');
    const mockPostUrl = 'https://www.instagram.com/p/DB123456789/';
    posterTask = await WorkAssignment.create({
      title: 'October Festive Poster Design',
      client: testClient._id,
      status: 'In Progress',
      assignedQuantity: 1,
      completedQuantity: 1,
      unit: 'poster',
      departmentCategory: 'Design',
      description: `Please review creative files. Live link: ${mockPostUrl}`,
      attachments: [{ name: 'banner.png', url: 'https://cdn.example.com/assets/banner.png' }],
      priority: 'Normal',
      assignedDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
    });
    console.log(`- Created Task: "${posterTask.title}" (Status: In Progress)`);

    // Simulate Team Lead approving the task
    console.log('- Lead Approves Task -> Changing status: "In Progress" -> "Approved"');
    const prevStatus1 = posterTask.status;
    posterTask.status = 'Approved';
    posterTask.completedAt = new Date();
    await posterTask.save();

    await syncTaskApprovalToDeliverables(posterTask, prevStatus1);

    // Verify Tracker
    let updatedTracker = await ClientDeliverableTracker.findById(testTracker._id);
    console.log(`- Tracker after approval: Posters Delivered=${updatedTracker?.posters.delivered}, Pending=${updatedTracker?.posters.pending}`);
    
    if (updatedTracker?.posters.delivered !== 1) {
      throw new Error(`Expected delivered posters to be 1, but got ${updatedTracker?.posters.delivered}`);
    }

    const posterItem = updatedTracker?.deliveredItems.find(
      (it) => it.sourceTaskId && String(it.sourceTaskId) === String(posterTask._id)
    );
    if (!posterItem) throw new Error('Delivered item log entry was not found in tracker');
    
    console.log(`- Auto-extracted item in log: Title="${posterItem.title}", Type="${posterItem.deliverableType}", URL="${posterItem.postUrl}"`);
    if (!posterItem.postUrl || !posterItem.postUrl.startsWith('http')) {
      throw new Error(`URL was not extracted properly: ${posterItem.postUrl}`);
    }
    console.log('✅ Poster task auto-increment and URL extraction: PASSED.\n');

    // -----------------------------------------------------------
    // Step 4: Test Video/Reel Task Approval
    // -----------------------------------------------------------
    console.log('--- Step 4: Simulating Employee Video/Reel Task Completion ---');
    const mockReelUrl = 'https://www.instagram.com/reel/C_987654321/';
    videoTask = await WorkAssignment.create({
      title: 'Client Brand Story Reel',
      client: testClient._id,
      status: 'In Review',
      assignedQuantity: 1,
      completedQuantity: 1,
      unit: 'reel',
      departmentCategory: 'Video Editing',
      description: 'Edited on Premiere Pro.',
      reviewNote: `Approved by TL. Posted here: ${mockReelUrl}`,
      priority: 'High',
      assignedDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
    });
    console.log(`- Created Task: "${videoTask.title}" (Status: In Review)`);

    const prevStatus2 = videoTask.status;
    videoTask.status = 'Approved';
    videoTask.completedAt = new Date();
    await videoTask.save();

    await syncTaskApprovalToDeliverables(videoTask, prevStatus2);

    updatedTracker = await ClientDeliverableTracker.findById(testTracker._id);
    console.log(`- Tracker after video approval: Videos Delivered=${updatedTracker?.videos.delivered}, Pending=${updatedTracker?.videos.pending}`);

    if (updatedTracker?.videos.delivered !== 1) {
      throw new Error(`Expected delivered videos to be 1, but got ${updatedTracker?.videos.delivered}`);
    }

    const videoItem = updatedTracker?.deliveredItems.find(
      (it) => it.sourceTaskId && String(it.sourceTaskId) === String(videoTask._id)
    );
    if (!videoItem) throw new Error('Video item log entry was not found in tracker');
    console.log(`- Auto-extracted item in log: Title="${videoItem.title}", Type="${videoItem.deliverableType}", URL="${videoItem.postUrl}"`);
    if (videoItem.postUrl !== mockReelUrl) {
      throw new Error(`Reel URL extracted incorrectly. Expected ${mockReelUrl}, got ${videoItem.postUrl}`);
    }
    console.log('✅ Video/Reel task auto-increment and URL extraction: PASSED.\n');

    // -----------------------------------------------------------
    // Step 5: Test Approval Revert (e.g. Lead sends for correction)
    // -----------------------------------------------------------
    console.log('--- Step 5: Testing Approval Revert (e.g., CORRECTION_NEEDED) ---');
    const prevStatus3 = posterTask.status; // 'Approved'
    posterTask.status = 'In Progress'; // reverted!
    await posterTask.save();

    await syncTaskApprovalToDeliverables(posterTask, prevStatus3);

    updatedTracker = await ClientDeliverableTracker.findById(testTracker._id);
    console.log(`- Tracker after poster approval reverted: Posters Delivered=${updatedTracker?.posters.delivered}`);
    if (updatedTracker?.posters.delivered !== 0) {
      throw new Error(`Expected delivered posters to decrement back to 0, but got ${updatedTracker?.posters.delivered}`);
    }

    const revertedItem = updatedTracker?.deliveredItems.find(
      (it) => it.sourceTaskId && String(it.sourceTaskId) === String(posterTask._id)
    );
    if (revertedItem) {
      throw new Error('Reverted task should have been removed from tracker deliveredItems log');
    }
    console.log('✅ Approval revert correctly decremented tally and removed log entry.\n');

    // -----------------------------------------------------------
    // Step 6: Test Task Deletion Cleanup
    // -----------------------------------------------------------
    console.log('--- Step 6: Testing Task Deletion Cleanup ---');
    // videoTask is currently Approved with count 1
    await revertTaskApproval(videoTask);
    await WorkAssignment.findByIdAndDelete(videoTask._id);
    videoTask = null;

    updatedTracker = await ClientDeliverableTracker.findById(testTracker._id);
    console.log(`- Tracker after video task deleted: Videos Delivered=${updatedTracker?.videos.delivered}`);
    if (updatedTracker?.videos.delivered !== 0) {
      throw new Error(`Expected delivered videos to decrement to 0 upon deletion, but got ${updatedTracker?.videos.delivered}`);
    }
    console.log('✅ Task deletion correctly reverted deliverable counts.\n');

    console.log('🎉 ALL AUTOMATION TESTS PASSED SUCCESSFULLY! 100% OPERATIONAL.\n');

  } catch (err: any) {
    console.error('❌ AUTOMATION TEST FAILED:', err.message || err);
    process.exitCode = 1;
  } finally {
    // Clean up mock data
    console.log('Cleaning up mock test entities...');
    if (posterTask && posterTask._id) await WorkAssignment.findByIdAndDelete(posterTask._id);
    if (videoTask && videoTask._id) await WorkAssignment.findByIdAndDelete(videoTask._id);
    if (testTracker && testTracker._id) await ClientDeliverableTracker.findByIdAndDelete(testTracker._id);
    if (testClient && testClient._id) await Client.findByIdAndDelete(testClient._id);
    await mongoose.disconnect();
    console.log('Done.');
  }
}

runDeliverableAutomationTest();
