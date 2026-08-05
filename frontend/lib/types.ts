export const SHOW_ADVANCED_WORKBOARD = false;

export type PortalRole = "ADMIN" | "HR" | "ACCOUNTANT" | "BDE" | "TEAM_LEAD" | "EMPLOYEE" | "OPERATIONS" | "OPERATIONS_HEAD";
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
export type WorkStatus = "Pending" | "In Progress" | "Ongoing" | "Blocked" | "In Review" | "Changes Requested" | "Rejected" | "Approved" | "Completed" | "Published";
export type WorkDeliverable = {
  id: number; assignment: number; assignment_title: string; employee_name: string;
  client: number; client_name: string; title: string; brief: string; work_type: string;
  due_date: string; status: WorkStatus; completed_at: string | null; is_overdue: boolean;
  created_at: string; updated_at: string;
};
export type WorkAssignment = {
  id: number; employee: number; employee_name: string; employee_department?: string; client: number; client_name: string;
  title: string; description: string; priority: WorkPriority; assigned_date: string; due_date: string;
  status: WorkStatus; progress: number; assigned_quantity: number; completed_quantity: number;
  remaining_quantity: number; unit: string; completed_at: string | null;
  assigned_by: number | null; assigned_by_name: string;
  reviewer?: number | null; reviewer_name?: string;
  reviewer_details?: { id: number | null; name: string; username: string } | null;
  is_overdue: boolean; deliverables: WorkDeliverable[]; created_at: string; updated_at: string;
};

export type WorkSummary = {
  total: number; pending: number; in_progress: number; blocked: number; completed: number; overdue: number;
};
export type WorkEmployeeOption = {
  id: number; display_name: string; department: Department;
};
export type WorkReviewerOption = {
  id: number; display_name: string; username: string;
};


export type KPIGrade = "Outstanding" | "Excellent" | "Good" | "Needs Improvement" | "Critical";

export type KPIScoreComponent = {
  score: number;
  max_score: number;
  percentage?: number;
  assigned_quantity?: number;
  completed_quantity?: number;
  total_assignments?: number;
  total_days?: number;
  present_days?: number;
  half_days?: number;
  absent_days?: number;
  leave_days?: number;
  total_due?: number;
  on_time_count?: number;
  approved_leaves?: number;
  rejected_leaves?: number;
  pending_leaves?: number;
  unapproved_absences?: number;
  quality_rating?: number;
  notes?: string;
  rated_by?: string;
};

export type KPIHistoryItem = {
  month: number;
  year: number;
  period: string;
  final_score: number;
  grade: KPIGrade;
  quality_rating: number;
  work_completion_pct: number;
  attendance_pct: number;
};

export type KPIEmployeeData = {
  employee_id: number;
  employee_code: string;
  employee_name: string;
  department: Department;
  designation: string;
  month: number;
  year: number;
  final_score: number;
  grade: KPIGrade;
  components: {
    work_completion: KPIScoreComponent;
    attendance: KPIScoreComponent;
    on_time_delivery: KPIScoreComponent;
    leave_discipline: KPIScoreComponent;
    work_quality: KPIScoreComponent;
    consistency: KPIScoreComponent;
  };
  history?: KPIHistoryItem[];
};

export type KPIDashboardData = {
  selected_month: number;
  selected_year: number;
  total_employees: number;
  average_kpi: number;
  top_performer: {
    id: number;
    name: string;
    department: Department;
    score: number;
    grade: KPIGrade;
  } | null;
  critical_performers_count: number;
  critical_performers: {
    id: number;
    name: string;
    department: Department;
    score: number;
    grade: KPIGrade;
  }[];
  department_averages: {
    department: Department;
    average_score: number;
    employee_count: number;
  }[];
  monthly_trend: {
    month: number;
    year: number;
    period: string;
    average_score: number;
  }[];
  employees: KPIEmployeeData[];
};

export type ShareLink = {
  id: number;
  token: string;
  client_id: number;
  client_name: string;
  assignment_id: number | null;
  assignment_title: string | null;
  public_update: string;
  expires_at: string | null;
  is_revoked: boolean;
  is_valid: boolean;
  created_at: string;
  created_by: string | null;
};

export type PublicWorkDeliverable = {
  title: string;
  work_type: string;
  status: string;
  due_date: string;
  completed_at: string | null;
};

export type PublicWorkAssignment = {
  title: string;
  status: string;
  priority: string;
  progress: number;
  assigned_quantity: number;
  completed_quantity: number;
  remaining_quantity: number;
  unit: string;
  assigned_date: string;
  due_date: string;
  completed_at: string | null;
  deliverables: PublicWorkDeliverable[];
};

export type PublicWorkProgress = {
  client_name: string;
  public_update: string;
  scope: "assignment" | "client";
  overall_progress: number;
  expires_at: string | null;
  last_updated: string;
  assignments: PublicWorkAssignment[];
};
