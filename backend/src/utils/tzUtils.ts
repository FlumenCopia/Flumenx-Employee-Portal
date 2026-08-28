/**
 * Centralized Timezone and Date Utility Module
 * Company Business Timezone: Asia/Kolkata (IST - UTC+05:30)
 * 
 * Ensures all attendance, payroll, late arrival, holiday, and cycle calculations
 * are strictly evaluated in IST, regardless of the host VPS/server system timezone.
 */

export const COMPANY_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in ms

/**
 * Returns current timestamp
 */
export function getCompanyNow(): Date {
  return new Date();
}

/**
 * Formats a Date object to YYYY-MM-DD in Asia/Kolkata
 */
export function getISTDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COMPANY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formats a Date object to HH:mm (24-hour format) in Asia/Kolkata
 */
export function getISTTimeString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: COMPANY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}

/**
 * Returns detailed date and time components in Asia/Kolkata
 */
export function getISTParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: COMPANY_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => {
    const val = parts.find((p) => p.type === type)?.value;
    return val ? parseInt(val, 10) : 0;
  };

  return {
    year: getPart('year'),
    month: getPart('month'), // 1-12
    day: getPart('day'),
    hours: getPart('hour') === 24 ? 0 : getPart('hour'),
    minutes: getPart('minute'),
    seconds: getPart('second'),
  };
}

/**
 * Converts a YYYY-MM-DD string or Date to start of day in Asia/Kolkata (00:00:00.000 IST)
 */
export function getCompanyStartOfDay(dateInput: Date | string = new Date()): Date {
  const dateStr = typeof dateInput === 'string' ? dateInput.split('T')[0] : getISTDateString(dateInput);
  return new Date(`${dateStr}T00:00:00.000+05:30`);
}

/**
 * Converts a YYYY-MM-DD string or Date to end of day in Asia/Kolkata (23:59:59.999 IST)
 */
export function getCompanyEndOfDay(dateInput: Date | string = new Date()): Date {
  const dateStr = typeof dateInput === 'string' ? dateInput.split('T')[0] : getISTDateString(dateInput);
  return new Date(`${dateStr}T23:59:59.999+05:30`);
}

/**
 * Converts "HH:mm" time string into total minutes since midnight
 */
export function timeStringToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

/**
 * Converts total minutes into "HH:mm" 24-hour string
 */
export function minutesToTimeString(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export interface AttendanceCycleInfo {
  year: number;
  month: number;
  cycleName: string;
  startStr: string;
  endStr: string;
  cycleStart: Date;
  cycleEnd: Date;
  totalCalendarDays: number;
}

/**
 * Calculates the Attendance Cycle for a given target month & year.
 * Company Policy: 26th of (Month - 1) to 25th of (Month).
 * E.g., for Month = 8 (August), Year = 2026:
 * Cycle runs from 2026-07-26 00:00:00.000 IST to 2026-08-25 23:59:59.999 IST.
 */
export function getAttendanceCycleForMonth(year: number, month: number): AttendanceCycleInfo {
  // Previous month calculation
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const currMonthStr = String(month).padStart(2, '0');

  const startStr = `${prevYear}-${prevMonthStr}-26`;
  const endStr = `${year}-${currMonthStr}-25`;

  const cycleStart = new Date(`${startStr}T00:00:00.000+05:30`);
  const cycleEnd = new Date(`${endStr}T23:59:59.999+05:30`);

  const diffMs = cycleEnd.getTime() - cycleStart.getTime();
  const totalCalendarDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const readablePeriod = `26 ${shortMonthNames[prevMonth - 1]} ${prevYear} → 25 ${shortMonthNames[month - 1]} ${year}`;
  const cycleName = `${monthNames[month - 1]} ${year} (${startStr} to ${endStr})`;

  return {
    year,
    month,
    cycleName,
    readablePeriod,
    startStr,
    endStr,
    cycleStart,
    cycleEnd,
    totalCalendarDays,
  };
}

/**
 * Determines which Attendance Cycle a given date belongs to in IST.
 * If date is >= 26th, it belongs to the NEXT month's cycle.
 * If date is <= 25th, it belongs to the CURRENT month's cycle.
 */
export function getAttendanceCycleForDate(dateInput: Date | string = new Date()): AttendanceCycleInfo {
  const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const ist = getISTParts(dateObj);

  let targetYear = ist.year;
  let targetMonth = ist.month;

  if (ist.day >= 26) {
    targetMonth += 1;
    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }
  }

  return getAttendanceCycleForMonth(targetYear, targetMonth);
}
