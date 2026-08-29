import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Employee } from '../models/Employee.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { calculateAttendanceRecordState } from '../services/attendanceEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/flumenx_portal';

export async function seedAttendance(): Promise<void> {
  console.log('[Attendance Seed] Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);

  // 1. Purge all existing attendance records
  const deleteResult = await AttendanceRecord.deleteMany({});
  console.log(`[Attendance Seed] 🗑️ Deleted ${deleteResult.deletedCount} old attendance records.`);

  // 2. Load pre-parsed seed JSON
  const jsonPath = path.join(__dirname, '../data/official_attendance_seed.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Attendance seed JSON file not found at ${jsonPath}`);
  }
  const seedRecords = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // 3. Fetch or create Attendance Policy
  let policy = await AttendancePolicy.findOne();
  if (!policy) {
    policy = new AttendancePolicy({
      officeStartTime: '09:30',
      officeEndTime: '18:30',
      gracePeriodMinutes: 5,
    });
    await policy.save();
  }

  // 4. Map all employees by email and normalized name
  const employees = await Employee.find({});
  const empMapByEmail: Record<string, any> = {};
  const empMapByName: Record<string, any> = {};

  for (const emp of employees) {
    if (emp.email) empMapByEmail[emp.email.trim().toLowerCase()] = emp;
    if (emp.name) empMapByName[emp.name.trim().toLowerCase()] = emp;
  }

  let createdCount = 0;

  for (const item of seedRecords) {
    const emailKey = (item.employeeEmail || '').trim().toLowerCase();
    const nameKey = (item.employeeName || '').trim().toLowerCase();

    // Match employee
    let emp = empMapByEmail[emailKey] || empMapByName[nameKey];
    if (!emp) {
      emp = employees.find((e) => e.name.toLowerCase().includes(nameKey.split(' ')[0]));
    }

    if (!emp) {
      console.warn(`[Attendance Seed] ⚠️ Employee not found for ${item.employeeName} (${item.employeeEmail})`);
      continue;
    }

    const attendanceDate = new Date(`${item.attendanceDate}T00:00:00.000+05:30`);

    const record = new AttendanceRecord({
      employee: emp._id,
      attendanceDate: attendanceDate,
      checkInTime: item.checkInTime || null,
      checkOutTime: item.checkOutTime || null,
      source: item.source || 'QR',
      locationVerified: item.locationVerified !== undefined ? item.locationVerified : true,
      notes: `Imported official attendance record for ${item.attendanceDate}`,
    });

    if (item.attendanceStatus === 'Absent' || !item.checkInTime) {
      record.attendanceStatus = 'Absent';
      record.checkInStatus = '';
      record.isLate = false;
      record.lateMinutes = 0;
      record.isEarlyExit = false;
      record.earlyExitMinutes = 0;
      record.workingHours = 0;
    } else {
      calculateAttendanceRecordState(record, policy);
    }

    await record.save();
    createdCount++;
  }

  console.log(`[Attendance Seed] ✅ Successfully seeded ${createdCount} attendance records for ${seedRecords.length} dataset entries into MongoDB.`);
}

if (process.argv[1] && process.argv[1].includes('seed_attendance')) {
  seedAttendance()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Attendance Seed Error]', err);
      process.exit(1);
    });
}
