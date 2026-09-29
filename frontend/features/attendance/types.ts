export type AttendanceSummary = {
  present: number; late: number; early_exits: number; absent: number;
  half_days: number; leave: number; attendance_percentage: number;
};

export type MonthlyStatistics = {
  month: string;
  summary: AttendanceSummary;
  days: Array<{ day: number } & AttendanceSummary>;
};

export type AttendancePolicy = {
  office_start_time: string; grace_period_minutes: number; office_end_time: string;
  half_day_hours: string; full_day_hours: string;
};

export type DayAttendanceStatus = {
  code: 'P' | 'A' | 'W' | 'L' | 'HD' | 'H' | '-';
  label: string;
  checkIn?: string;
  checkOut?: string;
  workingHours?: number;
  isLate?: boolean;
};

export type EmployeeAttendanceSummary = {
  totalCalendarDays: number;
  workingDays: number;
  weekOffs: number;
  holidays: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  lateArrivals: number;
  lateHalfDayDeductions: number;
  salaryDays: number;
  effectivePresentDays: number;
  payableDays: number;
  unpaidDays: number;
};

export type EmployeeMatrixRecord = {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  employmentStatus: string;
  dailyStatuses: Record<string, DayAttendanceStatus>;
  summary: EmployeeAttendanceSummary;
};

export type MatrixDayInfo = {
  dateStr: string;
  dayNumber: number;
  dayName: string;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName?: string;
  totals: {
    present: number;
    absent: number;
    halfDay: number;
    leave: number;
    weekOff: number;
    holiday: number;
    totalEmployees: number;
  };
};

export type AttendanceMatrixReport = {
  success: boolean;
  cycle: {
    year: number;
    month: number;
    cycleType: 'salary' | 'calendar';
    cycleName: string;
    readablePeriod: string;
    startStr: string;
    endStr: string;
    totalCalendarDays: number;
  };
  days: MatrixDayInfo[];
  employees: EmployeeMatrixRecord[];
  overallSummary: {
    totalEmployees: number;
    totalCalendarDays: number;
    avgPayableDays: number;
    totalPresent: number;
    totalAbsent: number;
    totalLeaves: number;
  };
};

