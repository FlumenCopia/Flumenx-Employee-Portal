import mongoose from 'mongoose';
import { User } from '../models/User.js';

async function verifyClientTasksEndpoint() {
  console.log('Testing GET /work-assignments/?is_master_client_task=true...');
  const API_BASE = 'http://127.0.0.1:8000/api';

  // 1. Login Super Admin
  const loginRes = await fetch(`${API_BASE}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin@flumenx.com',
      password: 'password123',
    }),
  });
  const loginData: any = await loginRes.json();
  const token = loginData.access;

  // 2. Fetch Client Master Tasks
  const res = await fetch(`${API_BASE}/work-assignments/?is_master_client_task=true`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data: any = await res.json();
  const tasks = Array.isArray(data) ? data : data.results || [];
  console.log(`Fetched ${tasks.length} tasks with is_master_client_task=true`);

  let allAreMaster = true;
  for (const t of tasks) {
    console.log(`- Task: "${t.title}" | Client: ${t.client_name || t.client} | is_master_client_task: ${t.is_master_client_task}`);
    if (t.is_master_client_task !== true) {
      allAreMaster = false;
    }
  }

  if (tasks.length >= 4 && allAreMaster) {
    console.log('✓ All returned tasks are strictly Client Master Deliverables! (PASSED)');
  } else {
    throw new Error('Verification failed: Non-master tasks were returned or empty.');
  }

  // 3. Fetch Regular Employee Tasks
  const empRes = await fetch(`${API_BASE}/work-assignments/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const empData: any = await empRes.json();
  const empTasks = Array.isArray(empData) ? empData : empData.results || [];
  console.log(`Fetched ${empTasks.length} tasks for standard employee work list`);

  let hasMasterInEmpList = false;
  for (const t of empTasks) {
    if (t.is_master_client_task === true) {
      hasMasterInEmpList = true;
    }
  }

  if (!hasMasterInEmpList) {
    console.log('✓ Standard employee work list contains NO master client tasks! (PASSED)');
  } else {
    throw new Error('Verification failed: Master tasks leaked into regular employee work list.');
  }

  console.log('🎉 All Client vs Employee Task isolation tests PASSED!');
}

verifyClientTasksEndpoint().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
