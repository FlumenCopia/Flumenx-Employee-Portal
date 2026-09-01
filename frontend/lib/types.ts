export const SHOW_ADVANCED_WORKBOARD = false;

export type PortalRole = "SUPER_ADMIN" | "ADMIN" | "HR" | "ACCOUNTANT" | "BDE" | "TEAM_LEAD" | "EMPLOYEE" | "OPERATIONS" | "OPERATIONS_HEAD";
export type WorkspaceRole = "admin" | "employee" | "hr" | "accountant" | "bdo" | "team-lead";

export type PortalPage = {
  id: number;
  title: string;
  route_path: string;
  module_code: string;
  icon: string;
  sidebar_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type DepartmentItem = {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  display_order: number;
  employees_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type DynamicRole = {
  id: number;
  name: string;
  code: string;
  description: string;
  is_superadmin_wildcard: boolean;
  is_system_role: boolean;
  permissions_count?: number;
  assigned_users_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type RolePermissionItem = {
  page_id: number;
  page_title: string;
  route_path: string;
  module_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type RolePermissionMatrixResponse = {
  role: {
    id: number;
    code: string;
    name: string;
    is_superadmin_wildcard: boolean;
    is_system_role: boolean;
  };
  permissions: RolePermissionItem[];
};

export type SuperAdminUser = {
  user_id: number;
  employee_id: number | null;
  full_name: string;
  work_email: string;
  designation: string;
  department: string;
  department_id?: number | null;
  team_lead_id: number | null;
  dynamic_role: { id: number; code: string; name: string } | null;
  legacy_portal_role: PortalRole;
  status: EmployeeStatus;
  is_active: boolean;
  date_joined: string;
};

export type Role = WorkspaceRole;
export type Department = "Web Development" | "Video Editing" | "Design" | "Digital Marketing" | "Accountant" | "HR" | "Operations";

export type CanonicalDepartmentKey =
  | "web_development"
  | "video_editing"
  | "design"
  | "digital_marketing"
  | "accountant"
  | "operations"
  | "hr";

export interface CanonicalDepartmentInfo {
  key: CanonicalDepartmentKey;
  label: string;
  badge: string;
  color: string;
}

export const CANONICAL_DEPARTMENTS: Record<CanonicalDepartmentKey, CanonicalDepartmentInfo> = {
  web_development: { key: "web_development", label: "Web Development", badge: "Web Development", color: "#cba86e" },
  video_editing: { key: "video_editing", label: "Video Editing", badge: "Video Editing", color: "#F472B6" },
  design: { key: "design", label: "Design", badge: "Design", color: "#F59E0B" },
  digital_marketing: { key: "digital_marketing", label: "Digital Marketing", badge: "Digital Marketing", color: "#22D3EE" },
  accountant: { key: "accountant", label: "Accountant", badge: "Accountant", color: "#A78BFA" },
  operations: { key: "operations", label: "Operations", badge: "Operations", color: "#3B82F6" },
  hr: { key: "hr", label: "HR", badge: "HR", color: "#EC4899" },
};

export function normalizeDepartment(val?: string | null): CanonicalDepartmentKey {
  if (!val) return "design";
  const s = val.trim().toLowerCase();

  if (s === "web_development" || s === "web development" || s === "web dev" || s === "web" || s === "web_developer" || s === "software" || s === "it" || s === "it / web" || s === "it / web development") return "web_development";
  if (s === "video_editing" || s === "video editing" || s === "video" || s === "editing" || s === "animation" || s === "reel") return "video_editing";
  if (s === "design" || s === "graphic design" || s === "graphic" || s === "ui/ux" || s === "ui" || s === "ux" || s === "poster") return "design";
  if (s === "digital_marketing" || s === "digital marketing" || s === "marketing" || s === "ads" || s === "ad" || s === "bde" || s === "social media" || s === "content" || s === "copy") return "digital_marketing";
  if (s === "accountant" || s === "accounting" || s === "accounts" || s === "finance") return "accountant";
  if (s === "operations" || s === "ops" || s === "operations_head" || s === "operations head") return "operations";
  if (s === "hr" || s === "human resources") return "hr";

  if (s.includes("web") || s.includes("software") || s.includes("development")) return "web_development";
  if (s.includes("video") || s.includes("anim") || s.includes("editing")) return "video_editing";
  if (s.includes("design") || s.includes("graphic")) return "design";
  if (s.includes("marketing") || s.includes("bde")) return "digital_marketing";
  if (s.includes("account")) return "accountant";
  if (s.includes("ops") || s.includes("operation")) return "operations";
  if (s.includes("hr")) return "hr";

  return "design";
}
export type EmployeeStatus = "Active" | "On Leave" | "Inactive";
export type EmploymentStatus = "Probation" | "Permanent" | "Contract" | "Intern";

export type EmployeeProfile = {
  id: number; employee_code: string; name: string; email: string; phone: string;
  department: Department; designation: string; joining_date: string; status: EmployeeStatus;
  employment_status?: EmploymentStatus;
  probation_start_date?: string | null;
  probation_end_date?: string | null;
  confirmation_date?: string | null;
  location?: string;
  avatar?: string;
};
export type AuthUser = {
  id: number; username: string; email: string; first_name?: string;
  role: string; portal_role: PortalRole; employee?: EmployeeProfile | null;
  avatar?: string;
};
export type Paginated<T> = {
  count: number; next: string | null; previous: string | null; results: T[];
};
export type PortalNotification = {
  id: number; user: number; title: string; message: string; category: string;
  is_read: boolean; created_at: string;
};
export type Employee = {
  id: number | string; employee_code: string; name: string; email: string; phone: string;
  department: Department; designation: string; joining_date: string; status: EmployeeStatus;
  employment_status?: EmploymentStatus;
  probation_start_date?: string | null;
  probation_end_date?: string | null;
  confirmation_date?: string | null;
  exit_date?: string | null;
  location?: string; portal_role?: PortalRole;
  avatar?: string;
};
export type EmployeeDocumentItem = {
  id: string | number;
  employee_id: string | number;
  title: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

export type Leave = {
  id: number; employee?: number; employee_name?: string; employee_code?: string;
  leave_type: string; start_date: string; end_date: string; reason: string;
  status: "Pending" | "Approved" | "Rejected"; days?: number; admin_note?: string;
};
export type Announcement = { id: number; title: string; message: string; date: string; priority: "Normal" | "Important" | "Urgent" };
export type SalarySlip = {
  id: number | string;
  employee?: number | string;
  employee_name?: string;
  month: number;
  year: number;
  gross_salary: number | string;
  net_salary: number | string;
  total_deductions?: number | string;
  cycle_start_date?: string;
  cycle_end_date?: string;
  status?: string;
  pdf_url?: string;
  file?: string;
  uploaded_at?: string;
};
export type AttendanceRecord = {
  id: number; employee: number; employee_name: string; employee_code: string; department: string;
  attendance_date: string; check_in_time: string | null; check_out_time: string | null;
  check_in_status: "On Time" | "Grace Period" | "Late" | ""; attendance_status: string;
  is_late: boolean; late_minutes: number; is_early_exit: boolean; early_exit_minutes: number;
  working_hours: string; source: string; location_verified: boolean;
  latitude?: number | null; longitude?: number | null; check_in_distance_meters?: number | null;
  check_out_latitude?: number | null; check_out_longitude?: number | null; check_out_distance_meters?: number | null;
  photo?: string | null;
  is_auto_checkout?: boolean;
  auto_checkout_reason?: string;
};

export type ClientDocument = {
  id?: string | number;
  name: string;
  url: string;
  document_type: "Contract" | "NDA" | "Proposal" | "SLA" | "Asset" | "Other";
  documentType?: "Contract" | "NDA" | "Proposal" | "SLA" | "Asset" | "Other";
  uploaded_at?: string;
};

export type ClientProposal = {
  id?: string | number;
  title: string;
  url?: string;
  value?: number;
  status: "Draft" | "Sent" | "Approved" | "Rejected";
  uploaded_at?: string;
};

export type ClientBrandAsset = {
  id?: string | number;
  name: string;
  url: string;
  asset_type?: "Logo" | "Brand Guide" | "Font" | "Drive Link" | "Other";
  assetType?: "Logo" | "Brand Guide" | "Font" | "Drive Link" | "Other";
  notes?: string;
};

export type ClientContactPerson = {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
};

export type Client = {
  id: number | string;
  name: string;
  industry?: string;
  is_active?: boolean;
  isActive?: boolean;
  notes?: string;
  contact_person?: ClientContactPerson;
  contactPerson?: ClientContactPerson;
  website?: string;
  address?: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  retainer_monthly_fee?: number;
  retainerMonthlyFee?: number;
  documents?: ClientDocument[];
  proposals?: ClientProposal[];
  brand_assets?: ClientBrandAsset[];
  brandAssets?: ClientBrandAsset[];
  services_provided?: string[];
  servicesProvided?: string[];
  created_at?: string;
  updated_at?: string;
};
export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed" | "Archived";
export type Project = {
  id: number | string;
  name: string;
  code?: string;
  description?: string;
  status: ProjectStatus;
  client_id: number | string;
  client_name: string;
  project_manager?: { id: number | string; name: string; email: string } | null;
  start_date?: string;
  target_end_date?: string;
  budget_hours?: number;
  total_tasks?: number;
  completed_tasks?: number;
  estimated_hours?: number;
  actual_hours?: number;
  progress_percentage?: number;
  created_at?: string;
};

export type TimerStatus = "RUNNING" | "PAUSED" | "STOPPED";
export type TimeEntry = {
  id: number | string;
  employee: number | string;
  user: number | string;
  client?: number | string | null;
  project?: number | string | null;
  task: number | string;
  startTime: string;
  endTime?: string | null;
  durationSeconds: number;
  status: TimerStatus;
  description?: string;
  isBillable: boolean;
  isManualEntry: boolean;
  entryDate: string;
};

export type DepartmentCategory = "Development" | "Digital Marketing" | "Video Editing" | "Design" | "HR" | "General";
export type DepartmentData = {
  videoCount?: number;
  videoDurationSeconds?: number;
  editingType?: string;
  revisionCount?: number;
  platforms?: string[];
  campaignName?: string;
  postCount?: number;
  targetDate?: string;
  repositoryUrl?: string;
  environment?: "Development" | "Staging" | "Production";
  featureBugType?: "Feature" | "Bug" | "Improvement" | "Refactor";
  techStack?: string[];
  designType?: string;
  creativesCount?: number;
  dimensions?: string;
  customNotes?: string;
};

export type WorkPriority = "Low" | "Normal" | "High" | "Urgent";
export type WorkStatus = "Backlog" | "Assigned" | "In Progress" | "In Review" | "Approved" | "Published" | "Pending" | "Ongoing" | "Blocked" | "Changes Requested" | "Rejected" | "Completed";
export type DeliverableItem = {
  id: string | number;
  name?: string;
  title?: string;
  type?: string;
  work_type?: string;
  contracted?: number;
  delivered?: number;
  completed?: number;
  status: string;
  due_date?: string;
  completed_at?: string | null;
  client?: number | string;
  brief?: string;
  assignment?: number;
  assignment_title?: string;
  employee_name?: string;
  client_name?: string;
  is_overdue?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type WorkDeliverable = DeliverableItem;

export type ReviewStatus = "PENDING_REVIEW" | "OK" | "CORRECTION_NEEDED";

export type TaskAttachment = {
  id?: string | number;
  name: string;
  url: string;
  file_type?: string;
  file_size?: number;
  uploaded_at?: string;
  uploaded_by?: string | number | null;
  uploaded_by_name?: string;
};

export type WorkAssignment = {
  id: number | string; employee: number | string; employee_name: string; employee_department?: string; client: number | string; client_name: string;
  project?: number | string | null; project_name?: string;
  department_category?: DepartmentCategory;
  parent_task?: number | string | null; parent_task_title?: string; is_master_client_task?: boolean;
  title: string; description: string; priority: WorkPriority; assigned_date: string; due_date: string;
  status: WorkStatus; progress: number; assigned_quantity: number; completed_quantity: number;
  remaining_quantity: number; unit: string; completed_at: string | null;
  estimated_hours?: number; actual_hours?: number; overrun_hours?: number; is_overrun?: boolean;
  department_data?: DepartmentData;
  assigned_by: number | null; assigned_by_name: string;
  reviewer?: number | null; reviewer_name?: string;
  reviewer_details?: { id: number | null; name: string; username: string } | null;
  review_status?: ReviewStatus;
  review_note?: string;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string;
  is_overdue: boolean; is_backlog?: boolean; deliverables: DeliverableItem[];
  attachments?: TaskAttachment[];
  created_at: string; updated_at: string;
  total_time_spent_seconds?: number;
  active_timer?: { started_at: string; started_by?: number | null } | null;
  time_logs?: { id?: string; startTime?: string; started_at?: string; endTime?: string | null; stopped_at?: string | null; durationSeconds?: number; duration_seconds?: number; loggedBy?: number | null; user_name?: string }[];
};

export type ClientKPIHealth = {
  clientId: string | number;
  totalTasks: number;
  totalAssignedQuantity: number;
  totalCompletedQuantity: number;
  quotaCompletionPct: number;
  onTimeDeliveryPct: number;
  satisfactionScore: number;
  healthStatus: "Delighted" | "On Track" | "Needs Attention" | "At Risk";
};

export type DeptCategoryProgress = {
  assigned: number;
  completed: number;
  pct: number;
  has_work?: boolean;
};

export type WorkSummary = {
  total: number;
  pending: number;
  in_progress: number;
  blocked: number;
  completed: number;
  overdue: number;
  review_pending?: number;
  review_ok?: number;
  review_correction?: number;
  total_assigned_qty?: number;
  total_completed_qty?: number;
  overall_progress?: number;
  dept_progress?: {
    design: DeptCategoryProgress;
    marketing: DeptCategoryProgress;
    web: DeptCategoryProgress;
    video: DeptCategoryProgress;
  };
};
export type WorkEmployeeOption = {
  id: number; display_name: string; department: Department;
};
export type WorkReviewerOption = {
  id: number; display_name: string; username: string;
};


export type KPIGrade = "Outstanding" | "Excellent" | "Good" | "Needs Improvement" | "Critical" | "Not Evaluated";

export type KPIScoreComponent = {
  score: number;
  max_score: number;
  percentage?: number;
  assigned_quantity?: number;
  completed_quantity?: number;
  total_assignments?: number;
  total_days?: number;
  eligible_days?: number;
  present_days?: number;
  half_days?: number;
  absent_days?: number;
  leave_days?: number;
  total_due?: number;
  on_time_count?: number;
  overdue_count?: number;
  active_count?: number;
  correction_count?: number;
  total_tasks?: number;
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
  score_out_of_10: number;
  is_evaluated: boolean;
  grade: KPIGrade;
  quality_rating?: number;
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
  score_out_of_10: number;
  is_evaluated: boolean;
  grade: KPIGrade;
  components: {
    attendance: KPIScoreComponent;
    on_time_delivery: KPIScoreComponent;
    pending_work: KPIScoreComponent;
    rework: KPIScoreComponent;
    work_completion: KPIScoreComponent;
    work_quality?: KPIScoreComponent;
    leave_discipline?: KPIScoreComponent;
    consistency?: KPIScoreComponent;
  };
  history?: KPIHistoryItem[];
};

export type KPIDashboardData = {
  selected_month: number;
  selected_year: number;
  total_employees: number;
  evaluated_employees: number;
  average_kpi: number;
  average_kpi_out_of_10: number;
  top_performer: {
    id: number;
    name: string;
    department: Department;
    score: number;
    score_out_of_10: number;
    grade: KPIGrade;
  } | null;
  critical_performers_count: number;
  critical_performers: {
    id: number;
    name: string;
    department: Department;
    score: number;
    score_out_of_10: number;
    grade: KPIGrade;
  }[];
  department_averages: {
    department: Department;
    average_score: number;
    average_score_out_of_10: number;
    employee_count: number;
  }[];
  monthly_trend: {
    month: number;
    year: number;
    period: string;
    average_score: number;
    average_score_out_of_10: number;
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
  id?: string | number;
  name?: string;
  title?: string;
  type?: string;
  work_type?: string;
  status: string;
  contracted?: number;
  delivered?: number;
  due_date?: string;
  completed_at?: string | null;
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
  assigned_date?: string;
  due_date?: string;
  completed_at?: string | null;
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

export type Meeting = {
  id: string | number;
  meeting_code: string;
  title: string;
  date: string;
  time: string;
  description: string;
  department: string;
  location?: string;
  status: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
  created_by?: string | number | null;
  is_host?: boolean;
  host_name?: string;
  participants_count?: number;
  settings?: {
    isLocked: boolean;
    allowScreenShare: boolean;
    allowChat: boolean;
    muteOnEntry: boolean;
  };
  started_at?: string | null;
  ended_at?: string | null;
};

export type MeetingChatMessage = {
  id: string;
  sender_name: string;
  sender_role?: string;
  text: string;
  timestamp: string;
  is_self?: boolean;
};

export type ChatConversationType = "DIRECT" | "GROUP" | "DEPARTMENT" | "CLIENT";

export type ChatParticipant = {
  user_id: string | number;
  name: string;
  avatar?: string;
  role: "ADMIN" | "MEMBER";
  portal_role?: string;
  department?: string;
};

export type ChatConversationItem = {
  id: string;
  type: ChatConversationType;
  name: string;
  description?: string;
  avatar?: string;
  department?: string;
  client_id?: string | number | null;
  client_name?: string;
  created_by?: string | number;
  participants: ChatParticipant[];
  pinned_messages?: string[];
  last_message_text?: string;
  last_message_at?: string;
  last_message_sender_name?: string;
  has_unread?: boolean;
  is_admin?: boolean;
  other_participant?: {
    id: string | number;
    name: string;
    avatar?: string;
    role?: string;
    department?: string;
  } | null;
};

export type ChatMessageAttachment = {
  name: string;
  url: string;
  file_type: string;
  file_size?: number;
};

export type ChatMessageTaskEmbed = {
  id: string | number;
  title: string;
  status: string;
  priority: string;
  completedQuantity?: number;
  assignedQuantity?: number;
  unit?: string;
  employeeName?: string;
  clientName?: string;
};

export type ChatMessageClientEmbed = {
  id: string | number;
  name: string;
  industry?: string;
  contactPerson?: string;
};

export type ChatMessageStandupData = {
  date: string;
  completedTasks: string[];
  inProgressTasks: string[];
  blockers: string[];
  note?: string;
};

export type ChatMessageItem = {
  id: string;
  conversation_id: string;
  sender_id: string | number | null;
  sender_name: string;
  sender_role?: string;
  sender_avatar?: string;
  message_type:
    | "TEXT"
    | "IMAGE"
    | "VIDEO"
    | "FILE"
    | "TASK_EMBED"
    | "CLIENT_EMBED"
    | "STANDUP_UPDATE"
    | "MEETING_LINK"
    | "CALL_LOG"
    | "SYSTEM";
  text: string;
  attachments?: ChatMessageAttachment[];
  task_embed?: ChatMessageTaskEmbed;
  client_embed?: ChatMessageClientEmbed;
  standup_data?: ChatMessageStandupData;
  meeting_code?: string;
  is_pinned?: boolean;
  pinned_at?: string | null;
  reactions?: { emoji: string; user: string | number; userName?: string }[];
  reply_to?: string | null;
  reply_to_snapshot?: { id: string; senderName: string; text: string };
  created_at: string;
  is_self?: boolean;
};

export type ChatUserOption = {
  id: string | number;
  name: string;
  username: string;
  email: string;
  portal_role: string;
  department: string;
  designation: string;
  avatar?: string;
};

export type StandupWorkSummary = {
  date: string;
  employee_name: string;
  completed_tasks: string[];
  in_progress_tasks: string[];
  blockers: string[];
};

// ==========================================
// 📍 EMPLOYEE LOCATION TRACKING TYPES
// ==========================================

export type TrackingStatus = 'ONLINE' | 'OFFLINE' | 'GPS_LOST' | 'DISCONNECTED' | 'ERROR';

export type LiveLocationPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  timestamp: string | Date;
  batteryLevel?: number;
  address?: string;
};

export type TrackingSession = {
  id?: string;
  _id?: string;
  employee: string | any;
  user?: string | null;
  startedAt: string;
  endedAt?: string | null;
  startLocation?: LiveLocationPoint | null;
  endLocation?: LiveLocationPoint | null;
  totalDistance: number;
  totalDuration: number;
  status: 'ACTIVE' | 'COMPLETED' | 'INTERRUPTED';
  interruptedReason?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LiveEmployeeTracking = {
  id: string;
  _id: string;
  name: string;
  employeeCode: string;
  department: string;
  designation: string;
  avatar?: string;
  trackingStatus: TrackingStatus;
  isStale?: boolean;
  trackingStartedAt?: string | null;
  lastLocationAt?: string | null;
  currentLocation?: LiveLocationPoint | null;
  activeSession?: {
    startedAt: string;
    totalDistance: number;
    totalDuration: number;
    status: string;
  } | null;
};

export type DailyStationaryStop = {
  latitude: number;
  longitude: number;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

export type DailyRouteData = {
  employee?: {
    id: string;
    name: string;
    employeeCode: string;
    department: string;
    designation: string;
    avatar?: string;
  };
  routeGeoJson: {
    type: 'FeatureCollection';
    features: any[];
  };
  summary: {
    date: string;
    totalDistanceKm: number;
    totalDurationSeconds: number;
    pointCount: number;
    startedAt: string | null;
    endedAt: string | null;
  };
  points: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number;
    heading: number;
    timestamp: string;
    batteryLevel?: number;
    isMoving?: boolean;
  }[];
  stops: DailyStationaryStop[];
};

export type DailyLocationSummary = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  avatar: string;
  date: string;
  trackingStarted: string | null;
  trackingEnded: string | null;
  trackingDurationSeconds: number;
  totalDistanceKm: number;
  totalPoints: number;
  firstKnownLocation: LiveLocationPoint | null;
  lastKnownLocation: LiveLocationPoint | null;
  movementTimeSeconds: number;
  stationaryTimeSeconds: number;
  longestStationaryPeriod: {
    startedAt: string | null;
    endedAt: string | null;
    durationSeconds: number;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export type LocationHistoryPoint = {
  id?: string;
  _id?: string;
  employee: string;
  session?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  timestamp: string;
  batteryLevel?: number;
  isMoving?: boolean;
};


