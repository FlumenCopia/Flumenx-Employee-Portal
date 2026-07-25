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
