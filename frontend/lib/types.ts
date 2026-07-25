export type PortalRole = "ADMIN" | "HR" | "ACCOUNTANT" | "BDE" | "TEAM_LEAD" | "EMPLOYEE";
export type WorkspaceRole = "admin" | "employee" | "hr" | "accountant" | "bdo" | "team-lead";
export type Role = WorkspaceRole;
export type Department = "Web Development" | "Video Editing" | "Design" | "Digital Marketing" | "Accountant" | "HR" | "Operations";
export type EmployeeStatus = "Active" | "On Leave" | "Inactive";
export type EmployeeProfile = {
  id: number; employee_code: string; name: string; email: string; phone: string;
  department: Department; designation: string; joining_date: string; status: EmployeeStatus;
  location?: string;
};
export type AuthUser = {
  id: number; username: string; email: string; first_name?: string;
  role: string; portal_role: PortalRole; employee?: EmployeeProfile | null;
};
export type Paginated<T> = {
  count: number; next: string | null; previous: string | null; results: T[];
};
export type PortalNotification = {
  id: number; user: number; title: string; message: string; category: string;
  is_read: boolean; created_at: string;
};
export type Employee = {
  id: number; employee_code: string; name: string; email: string; phone: string;
  department: Department; designation: string; joining_date: string; status: EmployeeStatus;
  location?: string; portal_role?: PortalRole;
};
export type Leave = {
  id: number; employee?: number; employee_name?: string; employee_code?: string;
  leave_type: string; start_date: string; end_date: string; reason: string;
  status: "Pending" | "Approved" | "Rejected"; days?: number;
};
export type Meeting = { id: number; title: string; date: string; time: string; description: string; department: string; location: string };
export type Announcement = { id: number; title: string; message: string; date: string; priority: "Normal" | "Important" | "Urgent" };
export type SalarySlip = { id: number; employee?: number; employee_name?: string; month: number; year: number; gross_salary: string; net_salary: string; uploaded_at: string; file?: string };
export type AttendanceRecord = {
  id: number; employee: number; employee_name: string; employee_code: string; department: string;
  attendance_date: string; check_in_time: string | null; check_out_time: string | null;
  check_in_status: "On Time" | "Grace Period" | "Late" | ""; attendance_status: string;
  is_late: boolean; late_minutes: number; is_early_exit: boolean; early_exit_minutes: number;
  working_hours: string; source: string; location_verified: boolean;
};
export type Client = {
  id: number; name: string; created_at: string; updated_at: string;
};
export type WorkPriority = "Low" | "Normal" | "High" | "Urgent";
export type WorkStatus = "Pending" | "In Progress" | "Blocked" | "Completed";
export type WorkAssignment = {
  id: number; employee: number; employee_name: string; client: number; client_name: string;
  title: string; description: string; priority: WorkPriority; assigned_date: string; due_date: string;
  status: WorkStatus; progress: number; assigned_by: number | null; assigned_by_name: string;
  is_overdue: boolean; created_at: string; updated_at: string;
};
export type WorkSummary = {
  total: number; pending: number; in_progress: number; blocked: number; completed: number; overdue: number;
};
export type WorkEmployeeOption = {
  id: number; display_name: string;
};
