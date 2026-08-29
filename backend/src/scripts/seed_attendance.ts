import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Employee } from '../models/Employee.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { calculateAttendanceRecordState } from '../services/attendanceEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/flumenx_portal';

const rawAttendanceData = [
  {
    "employee_name": "Dhishunjith k",
    "designation": "DM Team Lead",
    "mailid": "dhishunjith@flumenx.com",
    "27-08-2026": "A",
    "28-08-2026": "A",
    "29-08-2026": "A"
  },
  {
    "employee_name": "Nidhin KG",
    "designation": "Junior web developer",
    "mailid": "nidhinkgflumenx@gmail.com",
    "27-08-2026": "A",
    "28-08-2026": "A",
    "29-08-2026": "A"
  },
  {
    "employee_name": "Ebi Lawrence",
    "designation": "Junior Graphic Designer",
    "mailid": "ebilawrenceflumenx@gmail.com",
    "27-08-2026": "A",
    "28-08-2026": "P 9.26-6.45",
    "29-08-2026": "P 9.32"
  },
  {
    "employee_name": "Abeyson p mathew",
    "designation": "HR",
    "mailid": "abeysonpmathewflumenx@gmail.com",
    "27-08-2026": "P 8.55-6.55",
    "28-08-2026": "P 8.45-7.00",
    "29-08-2026": "P 8.56"
  },
  {
    "employee_name": "Anurag J S",
    "designation": "BDM",
    "mailid": "anuragjsflumenx@gmail.com",
    "27-08-2026": "P 9.16-6.44",
    "28-08-2026": "A",
    "29-08-2026": "P 923"
  },
  {
    "employee_name": "Shrijith",
    "designation": "Senior Graphic Designer",
    "mailid": "Shreejithspillaiflumencopia@gmail.com",
    "27-08-2026": "A",
    "28-08-2026": "P 9.28-6.50",
    "29-08-2026": "P 9.28-"
  },
  {
    "employee_name": "Anandhu R S",
    "designation": "Accountant",
    "mailid": "anandhursflumenx@gmail.com",
    "27-08-2026": "P 10.16-6.30",
    "28-08-2026": "P 9.38-6.30",
    "29-08-2026": "P 9.35"
  },
  {
    "employee_name": "Najil Rahman P.M.",
    "designation": "Senior web developer",
    "mailid": "najilrahmanflumenx@gmail.com",
    "27-08-2026": "P 9.24-6.32",
    "28-08-2026": "P 89.17-637",
    "29-08-2026": "P 9.27"
  },
  {
    "employee_name": "Anandu anil",
    "designation": "Video editor",
    "mailid": "ananduanilflumenx@gmail.com",
    "27-08-2026": "P 9.17-6.37",
    "28-08-2026": "P 9.14-6.45",
    "29-08-2026": "P 9.21-"
  },
  {
    "employee_name": "Gowtham Vijay",
    "designation": "Digital Marketing Executive",
    "mailid": "gowthamvijayflumenx@gmail.com",
    "27-08-2026": "P 9.20-6.35",
    "28-08-2026": "P 9.25-6.40",
    "29-08-2026": "P 9.20"
  },
  {
    "employee_name": "NiKhil A.V.",
    "designation": "Digital Marketing Executive",
    "mailid": "nikhilavflumenx@gmail.com",
    "27-08-2026": "P 9.28-6.35",
    "28-08-2026": "P 9.31-6.40",
    "29-08-2026": "P 9.20"
  },
  {
    "employee_name": "Akhil S.",
    "designation": "Junior web developer",
    "mailid": "akhilsflumencopia@gmail.com",
    "27-08-2026": "P 9.41-6.30",
    "28-08-2026": "P 9.31-6.40",
    "29-08-2026": "P 9.33"
  },
  {
    "employee_name": "Rahul B Chandran",
    "designation": "Digital marketing intern",
    "mailid": "rahulchandran883@gmail.com",
    "27-08-2026": "P 9.34-6.35",
    "28-08-2026": "P 9.31-6.40",
    "29-08-2026": "A"
  }
];

function parseAttendanceValue(val: string): { isPresent: boolean; checkIn: string | null; checkOut: string | null } {
  if (!val || val.trim() === 'A') {
    return { isPresent: false, checkIn: null, checkOut: null };
  }

  const clean = val.trim().replace(/^P\s*/i, '');
  if (!clean) {
    return { isPresent: false, checkIn: null, checkOut: null };
  }

  let checkInStr: string | null = null;
  let checkOutStr: string | null = null;

  if (clean.includes('-')) {
    const parts = clean.split('-');
    checkInStr = formatTimePart(parts[0], 'IN');
    checkOutStr = parts[1] && parts[1].trim() ? formatTimePart(parts[1], 'OUT') : null;
  } else {
    checkInStr = formatTimePart(clean, 'IN');
  }

  return { isPresent: true, checkIn: checkInStr, checkOut: checkOutStr };
}

function formatTimePart(s: string, type: 'IN' | 'OUT'): string | null {
  let str = s.trim();
  if (!str) return null;

  // Handle typo "89.17" -> "9.17"
  if (str.startsWith('89.')) str = str.replace('89.', '9.');

  // Handle 3-4 digit string without dot e.g. "923" -> "09:23" or "637" -> "18:37"
  if (/^\d{3,4}$/.test(str)) {
    if (type === 'OUT') {
      const h = parseInt(str.length === 3 ? str[0] : str.slice(0, 2), 10);
      const m = str.slice(-2);
      const hour24 = h < 12 ? h + 12 : h;
      return `${String(hour24).padStart(2, '0')}:${m}`;
    } else {
      const h = str.length === 3 ? '0' + str[0] : str.slice(0, 2);
      const m = str.slice(-2);
      return `${h}:${m}`;
    }
  }

  if (str.includes('.')) {
    const parts = str.split('.');
    let h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    if (type === 'OUT' && h < 12) {
      h += 12; // 6.45 PM -> 18:45
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  if (str.includes(':')) {
    const parts = str.split(':');
    let h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    if (type === 'OUT' && h < 12) {
      h += 12;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return str;
}

export async function seedAttendance(): Promise<void> {
  console.log('[Attendance Seed] Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);

  // 1. Purge all existing attendance records
  const deleteResult = await AttendanceRecord.deleteMany({});
  console.log(`[Attendance Seed] 🗑️ Deleted ${deleteResult.deletedCount} old attendance records.`);

  // 2. Fetch or create Attendance Policy
  let policy = await AttendancePolicy.findOne();
  if (!policy) {
    policy = new AttendancePolicy({
      officeStartTime: '09:30',
      officeEndTime: '18:30',
      gracePeriodMinutes: 5,
    });
    await policy.save();
  }

  // 3. Map all employees by email and normalized name
  const employees = await Employee.find({});
  const empMapByEmail: Record<string, any> = {};
  const empMapByName: Record<string, any> = {};

  for (const emp of employees) {
    if (emp.email) empMapByEmail[emp.email.trim().toLowerCase()] = emp;
    if (emp.name) empMapByName[emp.name.trim().toLowerCase()] = emp;
  }

  const dateKeys = ['27-08-2026', '28-08-2026', '29-08-2026'];
  let createdCount = 0;

  for (const row of rawAttendanceData) {
    const emailKey = row.mailid.trim().toLowerCase();
    const nameKey = row.employee_name.trim().toLowerCase();

    // Match employee
    let emp = empMapByEmail[emailKey] || empMapByName[nameKey];
    if (!emp) {
      // Fuzzy name matching fallback
      emp = employees.find((e) => e.name.toLowerCase().includes(nameKey.split(' ')[0]));
    }

    if (!emp) {
      console.warn(`[Attendance Seed] ⚠️ Employee not found for ${row.employee_name} (${row.mailid})`);
      continue;
    }

    for (const dateStr of dateKeys) {
      const cellVal = (row as any)[dateStr];
      const parsed = parseAttendanceValue(cellVal);

      // Convert DD-MM-YYYY to YYYY-MM-DD Date
      const [dd, mm, yyyy] = dateStr.split('-');
      const attendanceDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000+05:30`);

      const record = new AttendanceRecord({
        employee: emp._id,
        attendanceDate: attendanceDate,
        checkInTime: parsed.checkIn,
        checkOutTime: parsed.checkOut,
        source: 'QR',
        locationVerified: true,
        notes: `Imported official attendance record for ${dateStr}`,
      });

      if (!parsed.isPresent) {
        record.attendanceStatus = 'Absent';
        record.checkInStatus = '';
        record.isLate = false;
        record.isEarlyExit = false;
        record.workingHours = 0;
      } else {
        calculateAttendanceRecordState(record, policy);
      }

      await record.save();
      createdCount++;
    }
  }

  console.log(`[Attendance Seed] ✅ Successfully seeded ${createdCount} attendance records for ${rawAttendanceData.length} employees across 27-08-2026, 28-08-2026, 29-08-2026.`);
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
