import { calculateAttendanceRecordState } from '../services/attendanceEngine.js';
import { IAttendancePolicy } from '../models/AttendancePolicy.js';

const mockPolicy: IAttendancePolicy = {
  officeStartTime: '09:30',
  gracePeriodMinutes: 5,
  officeEndTime: '18:30',
  earlyCheckoutHalfDayCutoff: '18:00',
  halfDayHours: 4,
  fullDayHours: 8,
  officeLatitude: 8.5213442,
  officeLongitude: 76.978483,
  allowedRadiusMeters: 200,
  activeQrReference: 'FLUMENX-HQ',
} as any;

function displayTime(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.includes("T")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
    }
  }
  const clean = value.trim();
  const isPM = clean.toUpperCase().includes("PM");
  const isAM = clean.toUpperCase().includes("AM");
  const parts = clean.split(":");
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10) || 0;
    const minutes = parts[1].replace(/[^\d]/g, "").padStart(2, "0").slice(0, 2);
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;
  }
  return value;
}

function runVerification() {
  console.log('=====================================================');
  console.log('RUNNING ATTENDANCE CORRECTION & ARRIVAL STATUS TESTS');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // 1. Engine tests
  const rec30: any = { checkInTime: '09:30', attendanceStatus: 'Present' };
  calculateAttendanceRecordState(rec30, mockPolicy);
  assert(rec30.checkInStatus === 'On Time' && rec30.isLate === false, 'Engine: 09:30 AM check-in is On Time');

  const rec34: any = { checkInTime: '09:34', attendanceStatus: 'Present' };
  calculateAttendanceRecordState(rec34, mockPolicy);
  assert(rec34.checkInStatus === 'Grace Period' && rec34.isLate === false, 'Engine: 09:34 AM check-in is Grace Period');

  const rec35: any = { checkInTime: '09:35', attendanceStatus: 'Present' };
  calculateAttendanceRecordState(rec35, mockPolicy);
  assert(rec35.checkInStatus === 'Grace Period' && rec35.isLate === false, 'Engine: 09:35 AM check-in is Grace Period');

  const rec37: any = { checkInTime: '09:37', attendanceStatus: 'Present' };
  calculateAttendanceRecordState(rec37, mockPolicy);
  assert(rec37.checkInStatus === 'Late' && rec37.isLate === true && rec37.lateMinutes === 7, 'Engine: 09:37 AM check-in is Late (7m late)');

  const rec40: any = { checkInTime: '09:40', attendanceStatus: 'Present' };
  calculateAttendanceRecordState(rec40, mockPolicy);
  assert(rec40.checkInStatus === 'Late' && rec40.isLate === true && rec40.lateMinutes === 10, 'Engine: 09:40 AM check-in is Late (10m late)');

  // 2. Correction approval logic simulation
  // Case A: Correction requested check-in = 09:37 AM without explicit waive
  const recCorr37: any = { checkInTime: '09:00', checkOutTime: null, attendanceStatus: 'Present' };
  recCorr37.checkInTime = '09:37';
  calculateAttendanceRecordState(recCorr37, mockPolicy);
  assert(recCorr37.checkInStatus === 'Late' && recCorr37.isLate === true, 'Correction Approval: 09:37 AM requested check-in evaluates to Late');

  // Case B: Correction requested check-in = 09:34 AM
  const recCorr34: any = { checkInTime: '09:00', checkOutTime: null, attendanceStatus: 'Present' };
  recCorr34.checkInTime = '09:34';
  calculateAttendanceRecordState(recCorr34, mockPolicy);
  assert(recCorr34.checkInStatus === 'Grace Period' && recCorr34.isLate === false, 'Correction Approval: 09:34 AM requested check-in evaluates to Grace Period');

  // Case C: Correction requested check-in = 09:25 AM
  const recCorr25: any = { checkInTime: '09:00', checkOutTime: null, attendanceStatus: 'Present' };
  recCorr25.checkInTime = '09:25';
  calculateAttendanceRecordState(recCorr25, mockPolicy);
  assert(recCorr25.checkInStatus === 'On Time' && recCorr25.isLate === false, 'Correction Approval: 09:25 AM requested check-in evaluates to On Time');

  // 3. Frontend displayTime helper tests
  assert(displayTime('09:37 AM') === '09:37 AM', 'displayTime: "09:37 AM" formats as "09:37 AM"', `Got "${displayTime('09:37 AM')}"`);
  assert(displayTime('09:40 AM') === '09:40 AM', 'displayTime: "09:40 AM" formats as "09:40 AM"', `Got "${displayTime('09:40 AM')}"`);
  assert(displayTime('09:37') === '09:37 AM', 'displayTime: "09:37" formats as "09:37 AM"', `Got "${displayTime('09:37')}"`);
  assert(displayTime('18:30') === '06:30 PM', 'displayTime: "18:30" formats as "06:30 PM"', `Got "${displayTime('18:30')}"`);

  console.log('\n=====================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
