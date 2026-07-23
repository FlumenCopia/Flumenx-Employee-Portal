export type Role = "admin" | "employee";
export type Employee = {
  id: number; employee_code: string; name: string; email: string; phone: string;
  department: string; designation: string; joining_date: string; status: string;
  location?: string;
};
export type Leave = {
  id: number; employee?: number; employee_name?: string; employee_code?: string;
  leave_type: string; start_date: string; end_date: string; reason: string;
  status: "Pending" | "Approved" | "Rejected"; days?: number;
};
export type Meeting = { id: number; title: string; date: string; time: string; description: string; department: string; location: string };
export type Announcement = { id: number; title: string; message: string; date: string; priority: string };
export type SalarySlip = { id: number; employee?: number; employee_name?: string; month: number; year: number; gross_salary: string; net_salary: string; uploaded_at: string; file?: string };
export type AttendanceRecord = {
  id: number; employee: number; employee_name: string; employee_code: string; department: string;
  attendance_date: string; check_in_time: string | null; check_out_time: string | null;
  check_in_status: "On Time" | "Grace Period" | "Late" | ""; attendance_status: string;
  is_late: boolean; late_minutes: number; is_early_exit: boolean; early_exit_minutes: number;
  working_hours: string; source: string; location_verified: boolean;
};
