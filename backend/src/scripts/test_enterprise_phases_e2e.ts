import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Client } from '../models/Client.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import jwt from 'jsonwebtoken';

async function loginUser(emailOrUsername: string, password = 'password123'): Promise<{ token: string; cookie: string; user: any }> {
  const res = await fetch('http://localhost:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: emailOrUsername, password }),
  });
  const data = await res.json();
  const rawCookie = res.headers.get('set-cookie') || '';
  const token = data.access || data.token || '';
  return { token, cookie: rawCookie, user: data.user || data };
}

async function runTest() {
  await mongoose.connect('mongodb://127.0.0.1:27017/flumenx_portal');
  console.log('[MongoDB] Connected to database');

  const { token, cookie } = await loginUser('admin', 'password123');

  console.log('\n======================================================');
  console.log('🚀 ENTERPRISE PHASES WORKFLOW VALIDATION SUITE');
  console.log('======================================================');

  // Test 1: Multi-Client Task Creation
  const client1 = await Client.findOneAndUpdate({ name: 'Alpha Corp' }, { name: 'Alpha Corp', industry: 'Tech', isActive: true }, { upsert: true, new: true });
  const client2 = await Client.findOneAndUpdate({ name: 'Beta Logistics' }, { name: 'Beta Logistics', industry: 'Logistics', isActive: true }, { upsert: true, new: true });
  const testEmp = await Employee.findOne();

  const multiRes = await fetch('http://127.0.0.1:8000/api/work-assignments/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: 'Global Branding Campaign Q4',
      clients: [client1._id.toString(), client2._id.toString()],
      employee: testEmp?._id.toString(),
      priority: 'High',
      assigned_quantity: 5,
      unit: 'graphics',
    }),
  });

  const multiJson = await multiRes.json() as any;
  if (Array.isArray(multiJson) && multiJson.length === 2) {
    console.log(`✅ PASS [Phase 2: Multi-Client Creation] - Generated ${multiJson.length} independent tasks for Alpha Corp & Beta Logistics`);
  } else {
    throw new Error(`Failed multi-client creation: ${JSON.stringify(multiJson)}`);
  }

  // Test 2: Time Adjustment with Audit Trail
  const singleTask = multiJson[0];
  const adjustRes = await fetch(`http://127.0.0.1:8000/api/work-assignments/${singleTask._id}/adjust-time/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      new_seconds: 7200, // 2 hours
      reason: 'Timesheet correction: Employee worked offline on vector assets',
    }),
  });

  const adjustJson = await adjustRes.json() as any;
  if (adjustJson.totalTimeSpentSeconds === 7200 && adjustJson.actualHours === 2 && adjustJson.timeAdjustments?.length > 0) {
    console.log(`✅ PASS [Phase 7: Time Adjustment & Audit Trail] - Adjusted to 7200s (2.0h) with reason: "${adjustJson.timeAdjustments[0].reason}"`);
  } else {
    throw new Error(`Failed time adjustment: ${JSON.stringify(adjustJson)}`);
  }

  // Test 3: Client Master Update
  const updateClientRes = await fetch(`http://127.0.0.1:8000/api/clients/${client1._id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Alpha Corp Global',
      industry: 'Enterprise Software',
      is_active: true,
      notes: 'Key VIP account with monthly scope of 20 deliverables.',
    }),
  });

  const clientJson = await updateClientRes.json() as any;
  if (clientJson.name === 'Alpha Corp Global' && clientJson.industry === 'Enterprise Software') {
    console.log(`✅ PASS [Phase 10: Client Master Management] - Updated client "${clientJson.name}" industry to "${clientJson.industry}"`);
  } else {
    throw new Error(`Failed client update: ${JSON.stringify(clientJson)}`);
  }

  // Test 4: Dedicated Review Center Query Filter
  const reviewQueueRes = await fetch('http://127.0.0.1:8000/api/work-assignments/?review_queue=true', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const reviewJson = await reviewQueueRes.json() as any;
  if (reviewJson.results && Array.isArray(reviewJson.results)) {
    console.log(`✅ PASS [Phase 5: Dedicated Review Center Queue] - Successfully fetched ${reviewJson.results.length} tasks in review queue`);
  } else {
    throw new Error(`Failed review queue query: ${JSON.stringify(reviewJson)}`);
  }

  console.log('\n======================================================');
  console.log('📊 ALL ENTERPRISE WORKFLOW VALIDATION TESTS PASSED (4/4)');
  console.log('======================================================\n');
  await mongoose.disconnect();
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
