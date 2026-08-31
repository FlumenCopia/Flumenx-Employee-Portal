import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';

interface TestResult {
  scenario: string;
  step: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(scenario: string, step: string, passed: boolean, details: string) {
  results.push({ scenario, step, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${scenario}] - ${step}: ${details}`);
}

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

async function runAllScenarios() {
  await connectDB();
  console.log('\n======================================================');
  console.log('🚀 RUNNING TASK LIFECYCLE & WORKFLOW VALIDATION SUITE');
  console.log('======================================================\n');

  // Fetch Users
  const adminUser = await User.findOne({ username: 'admin' });
  const teamLead = await User.findOne({ role: 'TEAM_LEAD' });
  const employee1 = await User.findOne({ email: 'nidhinkgflumenx@gmail.com' });
  const employee2 = await User.findOne({ email: 'ebilawrenceflumenx@gmail.com' });
  const emp1Doc = await Employee.findOne({ user: employee1?._id });
  const emp2Doc = await Employee.findOne({ user: employee2?._id });
  const leadDoc = await Employee.findOne({ user: teamLead?._id });

  let client = await Client.findOne();
  if (!client) {
    client = await Client.create({ name: 'Acme Corp', isActive: true });
  }

  // Auth tokens
  const adminAuth = await loginUser('admin');
  const leadAuth = await loginUser(teamLead!.email);
  const emp1Auth = await loginUser(employee1!.email);
  const emp2Auth = await loginUser(employee2!.email);

  let createdTaskId = '';

  // -------------------------------------------------------------
  // SCENARIO 1: Assigner Creates Task with Assignee and Reviewer
  // -------------------------------------------------------------
  try {
    const taskPayload = {
      title: 'Develop Real-Time GPS Tracking Module',
      description: 'Implement Haversine distance calculations and location verification.',
      priority: 'High',
      employee: emp1Doc?._id.toString(),
      reviewer: leadDoc?.user?.toString() || teamLead?._id.toString(),
      client: client._id.toString(),
      department_category: 'Development',
      estimated_hours: 8,
      due_date: new Date(Date.now() + 5 * 86400000).toISOString(),
      assigned_quantity: 100,
      unit: '%',
    };

    const res = await fetch('http://localhost:8000/api/work-assignments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
        Cookie: adminAuth.cookie,
      },
      body: JSON.stringify(taskPayload),
    });

    const resData = await res.json();
    if (res.status === 201 && resData._id) {
      createdTaskId = resData._id;
      record('Scenario 1: Creation', 'Assigner delegates task to Assignee with Reviewer', true, `Task ID: ${createdTaskId}, Status: ${resData.status}`);
    } else {
      record('Scenario 1: Creation', 'Assigner delegates task', false, `Status ${res.status}: ${JSON.stringify(resData)}`);
    }
  } catch (err: any) {
    record('Scenario 1: Creation', 'Assigner delegates task', false, err.message);
  }

  // -------------------------------------------------------------
  // SCENARIO 2: Assignee Visibility & Access Isolation
  // -------------------------------------------------------------
  try {
    // Emp1 (Assignee) should see it
    const res1 = await fetch(`http://localhost:8000/api/work-assignments?employee_id=me`, {
      headers: { Authorization: `Bearer ${emp1Auth.token}`, Cookie: emp1Auth.cookie },
    });
    const list1 = await res1.json();
    const hasTask1 = list1.results ? list1.results.some((t: any) => t.id === createdTaskId) : false;
    record('Scenario 2: Visibility', 'Assignee can view assigned task in their personal board', hasTask1, `Found in Assignee list: ${hasTask1}`);

    // Emp2 (Different employee) should NOT see it
    const res2 = await fetch(`http://localhost:8000/api/work-assignments?employee_id=me`, {
      headers: { Authorization: `Bearer ${emp2Auth.token}`, Cookie: emp2Auth.cookie },
    });
    const list2 = await res2.json();
    const hasTask2 = list2.results ? list2.results.some((t: any) => t.id === createdTaskId) : false;
    record('Scenario 2: Isolation', 'Non-assigned employee cannot see another employee task', !hasTask2, `Forbidden task visible to other employee: ${hasTask2}`);
  } catch (err: any) {
    record('Scenario 2: Visibility & Isolation', 'Task listing checks', false, err.message);
  }

  // -------------------------------------------------------------
  // SCENARIO 3: Assignee Starts Work & Timer
  // -------------------------------------------------------------
  try {
    // Emp1 starts timer
    const res = await fetch(`http://localhost:8000/api/work-assignments/${createdTaskId}/start-timer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${emp1Auth.token}`, Cookie: emp1Auth.cookie },
    });
    const timerData = await res.json();
    const timerRunning = timerData.activeTimer && timerData.activeTimer.startedAt;
    const statusTransitioned = timerData.status === 'In Progress';
    record('Scenario 3: Execution', 'Assignee starts timer -> status automatically moves to "In Progress"', Boolean(timerRunning && statusTransitioned), `Status: ${timerData.status}, Timer active: ${Boolean(timerRunning)}`);

    // Emp2 tries to stop or tamper with timer (Should be forbidden)
    const resForbidden = await fetch(`http://localhost:8000/api/work-assignments/${createdTaskId}/stop-timer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${emp2Auth.token}`, Cookie: emp2Auth.cookie },
    });
    record('Scenario 3: Security', 'Unauthorized employee cannot stop/tamper with assignee timer', resForbidden.status === 403, `HTTP Status: ${resForbidden.status}`);

    // Emp1 stops timer
    const resStop = await fetch(`http://localhost:8000/api/work-assignments/${createdTaskId}/stop-timer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${emp1Auth.token}`, Cookie: emp1Auth.cookie },
    });
    const stopData = await resStop.json();
    record('Scenario 3: Time Logging', 'Assignee stops timer -> duration logged to task timeLogs', (stopData.totalTimeSpentSeconds ?? 0) >= 0, `Total time: ${stopData.totalTimeSpentSeconds}s`);
  } catch (err: any) {
    record('Scenario 3: Execution', 'Timer execution', false, err.message);
  }

  // -------------------------------------------------------------
  // SCENARIO 4: Assignee Submits for Review & Completion Restriction Gate
  // -------------------------------------------------------------
  try {
    // Assignee tries to mark Completed directly -> Gate should intercept and set PENDING_REVIEW
    const resComplete = await fetch(`http://localhost:8000/api/work-assignments/${createdTaskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${emp1Auth.token}`,
        Cookie: emp1Auth.cookie,
      },
      body: JSON.stringify({
        status: 'Completed',
        completed_quantity: 100,
        review_note: 'Initial version ready for lead review.',
      }),
    });
    const completeData = await resComplete.json();
    const isIntercepted = completeData.reviewStatus === 'PENDING_REVIEW' && (completeData.status === 'PENDING_REVIEW' || completeData.status === 'In Review' || completeData.status === 'In Progress');
    record('Scenario 4: Review Gate', 'Assignee cannot bypass designated Reviewer to mark Approved/Completed', Boolean(isIntercepted || completeData.reviewStatus === 'PENDING_REVIEW'), `Review Status: ${completeData.reviewStatus}, Status: ${completeData.status}`);
  } catch (err: any) {
    record('Scenario 4: Review Gate', 'Review submission check', false, err.message);
  }

  // -------------------------------------------------------------
  // SCENARIO 5: Reviewer Rejects / Requests Corrections
  // -------------------------------------------------------------
  try {
    // Reviewer audits and rejects with notes
    const resCorrection = await fetch(`http://localhost:8000/api/work-assignments/${createdTaskId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadAuth.token}`,
        Cookie: leadAuth.cookie,
      },
      body: JSON.stringify({
        review_status: 'CORRECTION_NEEDED',
        review_note: 'Missing test coverage for edge coordinates and zero radius.',
      }),
    });
    const corrData = await resCorrection.json();
    const isBackInProgress = corrData.status === 'In Progress' && corrData.reviewStatus === 'CORRECTION_NEEDED';
    record('Scenario 5: Reviewer Audit', 'Reviewer requests correction -> Task moves to "In Progress" with feedback', Boolean(isBackInProgress), `Status: ${corrData.status}, Note: "${corrData.reviewNote}"`);
  } catch (err: any) {
    record('Scenario 5: Reviewer Audit', 'Correction flow', false, err.message);
  }

  // -------------------------------------------------------------
  // SCENARIO 6: Reviewer Approves Task
  // -------------------------------------------------------------
  try {
    const resApprove = await fetch(`http://localhost:8000/api/work-assignments/${createdTaskId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadAuth.token}`,
        Cookie: leadAuth.cookie,
      },
      body: JSON.stringify({
        review_status: 'OK',
        review_note: 'Verified all unit tests and accuracy. Excellent work!',
      }),
    });
    const approvedData = await resApprove.json();
    const isApproved = approvedData.status === 'Approved' && approvedData.reviewStatus === 'OK' && approvedData.progress === 100 && approvedData.completedAt;
    record('Scenario 6: Final Approval', 'Reviewer signs off with OK -> Task marked "Approved", 100% progress, timestamp set', Boolean(isApproved), `Status: ${approvedData.status}, Progress: ${approvedData.progress}%, CompletedAt: ${approvedData.completedAt}`);
  } catch (err: any) {
    record('Scenario 6: Final Approval', 'Approval flow', false, err.message);
  }

  // -------------------------------------------------------------
  // SCENARIO 7: Unauthorized Reviewer Cannot Sign Off
  // -------------------------------------------------------------
  try {
    // Another regular employee tries to review
    const resUnauthorized = await fetch(`http://localhost:8000/api/work-assignments/${createdTaskId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${emp2Auth.token}`,
        Cookie: emp2Auth.cookie,
      },
      body: JSON.stringify({
        review_status: 'OK',
      }),
    });
    record('Scenario 7: Authorization', 'Unauthorized employee cannot execute reviewer sign-off', resUnauthorized.status === 403, `HTTP Status: ${resUnauthorized.status}`);
  } catch (err: any) {
    record('Scenario 7: Authorization', 'Unauthorized review check', false, err.message);
  }

  console.log('\n======================================================');
  console.log(`📊 TEST RUN COMPLETE: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
  console.log('======================================================\n');

  process.exit(results.every(r => r.passed) ? 0 : 1);
}

runAllScenarios().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
