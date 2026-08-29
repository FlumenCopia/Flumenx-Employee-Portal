export const COMPANY_TIMEZONE = 'Asia/Kolkata';

export function getISTDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COMPANY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

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

export function getAttendanceCycleForMonth(year: number, month: number) {
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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const cycleName = `${monthNames[month - 1]} ${year} (${startStr} to ${endStr})`;

  const cycleStart = new Date(`${startStr}T00:00:00.000+05:30`);
  const cycleEnd = new Date(`${endStr}T23:59:59.999+05:30`);
  const totalCalendarDays = Math.round((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));

  let cur = new Date(cycleStart.getTime());
  let weekOffs = 0;
  while (cur.getTime() <= cycleEnd.getTime()) {
    if (cur.getDay() === 0) weekOffs += 1;
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  const salaryDays = Math.max(1, totalCalendarDays - weekOffs);

  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const readablePeriod = `26 ${shortMonthNames[prevMonth - 1]} ${prevYear} → 25 ${shortMonthNames[month - 1]} ${year}`;

  return {
    year,
    month,
    cycleName,
    readablePeriod,
    startStr,
    endStr,
    totalCalendarDays,
    weekOffs,
    salaryDays,
  };
}
