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

  const startStr = `${prevYear}-${prevMonthStr}-25`;
  const endStr = `${year}-${currMonthStr}-24`;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const cycleName = `${monthNames[month - 1]} ${year} (${startStr} to ${endStr})`;

  return {
    year,
    month,
    cycleName,
    startStr,
    endStr,
  };
}
