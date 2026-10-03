import { connectDB } from '../config/db.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { calculateAttendanceRecordState } from '../services/attendanceEngine.js';

async function run() {
  await connectDB();
  console.log('[Attendance Fix] Connected to database.');

  // 1. Update Attendance Policy in DB to 16:30 (4:30 PM, 2-hr cutoff)
  let policy = await AttendancePolicy.findOne();
  if (policy) {
    console.log(`[Attendance Policy] Current early checkout cutoff: ${policy.earlyCheckoutHalfDayCutoff}`);
    policy.earlyCheckoutHalfDayCutoff = '16:30';
    await policy.save();
    console.log(`[Attendance Policy] ✅ Updated early checkout cutoff to 16:30 (4:30 PM).`);
  } else {
    policy = new AttendancePolicy({ earlyCheckoutHalfDayCutoff: '16:30' });
    await policy.save();
  }

  // 2. Find all records marked 'Half Day' that have checkout time
  const records = await AttendanceRecord.find({
    attendanceStatus: 'Half Day',
    checkInTime: { $ne: null },
    checkOutTime: { $ne: null },
  }).populate('employee');

  console.log(`[Attendance Fix] Found ${records.length} 'Half Day' records with checkouts to inspect.`);

  let fixedCount = 0;
  for (const r of records) {
    const oldStatus = r.attendanceStatus;
    calculateAttendanceRecordState(r, policy);

    if (r.attendanceStatus !== oldStatus) {
      await r.save();
      const empName = (r.employee as any)?.name || 'Employee';
      const dateStr = r.attendanceDate ? r.attendanceDate.toISOString().split('T')[0] : '';
      console.log(`  ✅ Fixed: ${empName} (${dateStr}) In: ${r.checkInTime} Out: ${r.checkOutTime} (${r.workingHours}h) -> ${r.attendanceStatus}`);
      fixedCount++;
    }
  }

  console.log(`\n[Attendance Fix] Done! Successfully updated ${fixedCount} of ${records.length} records.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('[Attendance Fix Error]', err);
  process.exit(1);
});
