import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock3,
  FileCode,
  FileSpreadsheet,
  FolderGit2,
  Grid,
  Kanban,
  Layers,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MessageSquare,
  Pencil,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import type { PortalRole, WorkspaceRole } from "@/lib/types";
import { SHOW_ADVANCED_WORKBOARD } from "@/lib/types";

export type NavigationItem = readonly [label: string, href: string, Icon: LucideIcon];

export const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Sparkles,
  Kanban,
  Layers,
  TrendingUp,
  Users,
  Calendar,
  CalendarCheck,
  CalendarDays,
  UserRound,
  Clock3,
  BriefcaseBusiness,
  Megaphone,
  MessageSquare,
  BarChart3,
  FileSpreadsheet,
  CheckSquare,
  ClipboardList,
  FileCode,
  FolderGit2,
  Pencil,
  Shield,
  UserCheck,
  Wrench,
  Settings,
  Grid,
  MapPin,
};

export function getLucideIcon(iconName?: string): LucideIcon {
  if (!iconName) return LayoutDashboard;
  const trimmed = iconName.trim();
  return iconMap[trimmed] || LayoutDashboard;
}

export type DynamicApiNavItem = {
  id: number;
  title: string;
  route_path: string;
  module_code: string;
  icon: string;
  sidebar_order: number;
};

const adminNav = [
  // Workspace
  ["Command Center", "/admin/work?view=command-center", Sparkles],
  ["Task Board", "/admin/work?view=kanban", Kanban],
  ["Approvals Queue", "/admin/work?view=approvals", CheckSquare],
  ["Timeline & Phases", "/admin/work?view=timeline", Layers],
  ["Time Tracker", "/timer", Clock3],

  // Tools & Apps
  ["Utility Toolbox", "/tools", Wrench],
  ["Team Chat Hub", "/chat", MessageSquare],

  // Clients & Projects
  ["Clients Master", "/clients", BriefcaseBusiness],
  ["Client Tasks & Calendar", "/clients/tasks", Calendar],
  ["Team Work", "/team-work", Users],

  // People & HR
  ["Employees Directory", "/employees", Users],
  ["Attendance", "/admin/attendance", CalendarCheck],
  ["Employee Tracking", "/tracking", MapPin],
  ["Leave Requests", "/admin/leaves", CalendarDays],
  ["Meetings", "/admin/meetings", UserRound],
  ["KPI Performance", "/admin/kpi", TrendingUp],
  ["Salary & Payroll", "/admin/salary-slips", FileSpreadsheet],
  ["Reports Center", "/admin/reports", FileSpreadsheet],
  ["Announcements", "/admin/announcements", Megaphone],

  // Administration
  ["Dynamic Roles", "/admin/roles", Shield],
  ["User Management", "/admin/users", UserCheck],
  ["Page Management", "/pages", FileCode],
  ["Audit Logs", "/admin/audit-logs", BarChart3],
  ["Settings & Access", "/settings", Settings],
] as const satisfies readonly NavigationItem[];

const employeeNav = [
  // Workspace
  ["Task Board", "/employee/work?view=kanban", Kanban],
  ["Approvals Queue", "/employee/work?view=approvals", CheckSquare],
  ["Timeline", "/employee/work?view=timeline", Layers],
  ["Time Tracker", "/timer", Clock3],

  // Tools & Apps
  ["Utility Toolbox", "/tools", Wrench],
  ["Team Chat Hub", "/chat", MessageSquare],

  // People & HR
  ["Employees Directory", "/employees", Users],
  ["My Attendance", "/employee/attendance", CalendarCheck],
  ["Location Tracking", "/tracking", MapPin],
  ["My Leave", "/employee/leaves", CalendarDays],
  ["Meetings", "/employee/meetings", Users],
  ["My Performance", "/employee/profile", TrendingUp],
  ["My Salary Slips", "/employee/salary-slips", FileSpreadsheet],
  ["Reports Center", "/employee/reports", FileSpreadsheet],
  ["Announcements", "/employee/announcements", Megaphone],
] as const satisfies readonly NavigationItem[];

const hrNav = [
  // Workspace
  ["Task Board", "/hr/work?view=kanban", Kanban],
  ["Approvals Queue", "/hr/work?view=approvals", CheckSquare],
  ["Time Tracker", "/timer", Clock3],

  // Tools & Apps
  ["Utility Toolbox", "/tools", Wrench],
  ["Team Chat Hub", "/chat", MessageSquare],

  // Clients & Projects
  ["Clients Master", "/clients", BriefcaseBusiness],
  ["Client Tasks & Calendar", "/clients/tasks", Calendar],

  // People & HR
  ["Employees Directory", "/employees", Users],
  ["Attendance", "/hr/attendance", CalendarCheck],
  ["Employee Tracking", "/tracking", MapPin],
  ["Leave Requests", "/hr/leaves", CalendarDays],
  ["Meetings", "/hr/meetings", Users],
  ["KPI Performance", "/hr/kpi", TrendingUp],
  ["Salary & Payroll", "/hr/salary-slips", FileSpreadsheet],
  ["Reports Center", "/hr/reports", FileSpreadsheet],
  ["Announcements", "/hr/announcements", Megaphone],
] as const satisfies readonly NavigationItem[];

const accountantNav = [
  // Tools & Apps
  ["Utility Toolbox", "/tools", Wrench],
  ["Team Chat Hub", "/chat", MessageSquare],

  // People & HR
  ["Employees Directory", "/employees", Users],
  ["Attendance", "/accountant/attendance", CalendarCheck],
  ["Employee Tracking", "/tracking", MapPin],
  ["Leave Requests", "/accountant/leaves", CalendarDays],
  ["Meetings", "/accountant/meetings", Users],
  ["Salary Slips Hub", "/accountant/salary-slips", FileSpreadsheet],
  ["Reports Center", "/accountant/reports", FileSpreadsheet],
  ["Announcements", "/accountant/announcements", Megaphone],
] as const satisfies readonly NavigationItem[];

const bdoNav = [
  // Workspace
  ["Task Board", "/bdo/work?view=kanban", Kanban],
  ["Approvals Queue", "/bdo/work?view=approvals", CheckSquare],
  ["Time Tracker", "/timer", Clock3],

  // Tools & Apps
  ["Utility Toolbox", "/tools", Wrench],
  ["Team Chat Hub", "/chat", MessageSquare],

  // Clients & Projects
  ["Clients Master", "/clients", BriefcaseBusiness],
  ["Client Tasks & Calendar", "/clients/tasks", Calendar],

  // People & HR
  ["My Attendance", "/bdo/attendance", CalendarCheck],
  ["Location Tracking", "/tracking", MapPin],
  ["My Leave", "/bdo/leaves", CalendarDays],
  ["Meetings", "/bdo/meetings", Users],
  ["Salary & Payslips", "/bdo/salary-slips", FileSpreadsheet],
  ["Reports Center", "/bdo/reports", FileSpreadsheet],
  ["Announcements", "/bdo/announcements", Megaphone],
] as const satisfies readonly NavigationItem[];

const teamLeadNav = [
  // Workspace
  ["Task Board", "/team-lead/work?view=kanban", Kanban],
  ["Approvals Queue", "/team-lead/work?view=approvals", CheckSquare],
  ["Time Tracker", "/timer", Clock3],

  // Tools & Apps
  ["Utility Toolbox", "/tools", Wrench],
  ["Team Chat Hub", "/chat", MessageSquare],

  // Clients & Projects
  ["Client Tasks & Calendar", "/clients/tasks", Calendar],
  ["Team Work", "/team-lead/team-work", Users],

  // People & HR
  ["Employees Directory", "/employees", Users],
  ["Attendance", "/team-lead/attendance", CalendarCheck],
  ["Employee Tracking", "/tracking", MapPin],
  ["Leave Requests", "/team-lead/leaves", CalendarDays],
  ["Meetings", "/team-lead/meetings", Users],
  ["KPI Performance", "/team-lead/kpi", TrendingUp],
  ["Salary & Payslips", "/team-lead/salary-slips", FileSpreadsheet],
  ["Reports Center", "/team-lead/reports", FileSpreadsheet],
  ["Announcements", "/team-lead/announcements", Megaphone],
] as const satisfies readonly NavigationItem[];

export const workspaceNavigation: Record<WorkspaceRole, readonly NavigationItem[]> = {
  admin: adminNav,
  employee: employeeNav,
  hr: hrNav,
  accountant: accountantNav,
  bdo: bdoNav,
  "team-lead": teamLeadNav,
};

export const getFilteredNavigation = (role: WorkspaceRole): readonly NavigationItem[] => {
  return workspaceNavigation[role] || workspaceNavigation.admin;
};

export type NavCategoryKey = "WORKSPACE" | "TOOLS" | "CLIENTS" | "PEOPLE" | "ADMIN";

export interface NavCategory {
  id: NavCategoryKey;
  label: string;
}

export const NAV_CATEGORIES: readonly NavCategory[] = [
  { id: "WORKSPACE", label: "Workspace" },
  { id: "TOOLS", label: "Tools & Apps" },
  { id: "CLIENTS", label: "Clients & Projects" },
  { id: "PEOPLE", label: "People & HR" },
  { id: "ADMIN", label: "Administration" },
] as const;

export const ITEM_ORDER_WEIGHTS: Record<string, number> = {
  // WORKSPACE
  "command center": 10,
  "task board": 20,
  "approvals queue": 30,
  "timeline & phases": 40,
  "timeline": 40,
  "time tracker": 50,

  // TOOLS & APPS
  "utility toolbox": 10,
  "team chat hub": 20,

  // CLIENTS & PROJECTS
  "clients master": 10,
  "client tasks & calendar": 20,
  "team work": 30,

  // PEOPLE & HR
  "employees directory": 10,
  "attendance": 20,
  "my attendance": 20,
  "employee tracking": 30,
  "location tracking": 30,
  "employee location tracking": 30,
  "leave requests": 40,
  "my leave": 40,
  "meetings": 50,
  "kpi performance": 60,
  "my performance": 60,
  "salary & payroll": 70,
  "salary slips hub": 70,
  "my salary slips": 70,
  "salary & payslips": 70,
  "reports center": 80,
  "announcements": 90,

  // ADMINISTRATION
  "dynamic roles": 10,
  "user management": 20,
  "page management": 30,
  "audit logs": 40,
  "settings & access": 50,
  "settings": 50,
};

export function getNavCategory(item: readonly [string, string, any]): NavCategoryKey {
  const [label, href] = item;
  const path = (href || "").toLowerCase();
  const title = (label || "").toLowerCase();

  // 1. Administration
  if (
    path.includes("/admin/roles") ||
    path.includes("/admin/users") ||
    path.includes("/admin/audit-logs") ||
    path.includes("/pages") ||
    path.includes("/settings") ||
    title.includes("role") ||
    title.includes("user management") ||
    title.includes("page management") ||
    title.includes("audit log") ||
    title.includes("settings & access") ||
    title === "settings"
  ) {
    return "ADMIN";
  }

  // 2. Tools & Apps
  if (
    path.startsWith("/tools") ||
    path.includes("/tools") ||
    path.startsWith("/chat") ||
    path.includes("/chat") ||
    title.includes("toolbox") ||
    title.includes("utility toolbox") ||
    title.includes("chat")
  ) {
    return "TOOLS";
  }

  // 3. Clients & Projects
  if (
    path.includes("/clients") ||
    path.includes("/team-work") ||
    title.includes("client") ||
    title.includes("team work")
  ) {
    return "CLIENTS";
  }

  // 4. People & HR
  if (
    path.includes("/employees") ||
    path.includes("/attendance") ||
    path.includes("/tracking") ||
    path.includes("/leaves") ||
    path.includes("/meetings") ||
    path.includes("/kpi") ||
    path.includes("/profile") ||
    path.includes("/salary") ||
    path.includes("/reports") ||
    path.includes("/announcements") ||
    title.includes("employee") ||
    title.includes("attendance") ||
    title.includes("tracking") ||
    title.includes("leave") ||
    title.includes("meeting") ||
    title.includes("kpi") ||
    title.includes("performance") ||
    title.includes("salary") ||
    title.includes("payroll") ||
    title.includes("payslip") ||
    title.includes("report") ||
    title.includes("announcement")
  ) {
    return "PEOPLE";
  }

  // 5. Workspace (Default for tasks, timer, board, approvals, etc.)
  return "WORKSPACE";
}

export interface CategorizedNavGroup {
  category: NavCategory;
  items: (readonly [string, string, any])[];
}

export function groupNavigationByCategory(
  items: readonly (readonly [string, string, any])[]
): CategorizedNavGroup[] {
  const groups: Record<NavCategoryKey, (readonly [string, string, any])[]> = {
    WORKSPACE: [],
    TOOLS: [],
    CLIENTS: [],
    PEOPLE: [],
    ADMIN: [],
  };

  for (const item of items) {
    const cat = getNavCategory(item);
    groups[cat].push(item);
  }

  // Sort items inside each category by predefined weight
  for (const catKey of Object.keys(groups) as NavCategoryKey[]) {
    groups[catKey].sort((a, b) => {
      const weightA = ITEM_ORDER_WEIGHTS[a[0].toLowerCase().trim()] ?? 100;
      const weightB = ITEM_ORDER_WEIGHTS[b[0].toLowerCase().trim()] ?? 100;
      return weightA - weightB;
    });
  }

  // Return only categories that have at least one item
  return NAV_CATEGORIES
    .map(category => ({
      category,
      items: groups[category.id],
    }))
    .filter(group => group.items.length > 0);
}

export function getWorkspaceRole(portalRole?: string): WorkspaceRole {
  if (!portalRole) return "employee";
  const role = portalRole.trim().toUpperCase();
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "OPERATIONS" || role === "OPERATIONS_HEAD") {
    return "admin";
  }
  if (role === "HR") return "hr";
  if (role === "ACCOUNTANT") return "accountant";
  if (role === "BDE" || role === "BDO") return "bdo";
  if (role === "TEAM_LEAD") return "team-lead";
  return "employee";
}

export function getWorkspaceDestination(portalRole?: string): string {
  const ws = getWorkspaceRole(portalRole);
  return `/${ws}/dashboard`;
}

export function isRoleAllowedInWorkspace(portalRole: string | undefined, workspaceRole: WorkspaceRole): boolean {
  return getWorkspaceRole(portalRole) === workspaceRole;
}

export function normalizeWorkspaceRoute(routePath: string, workspaceRole: WorkspaceRole): string {
  if (!routePath) return `/${workspaceRole}/dashboard`;

  const [pathname, search] = routePath.split("?");
  const query = search ? `?${search}` : "";

  if (pathname === "/settings" || pathname === "/admin/settings") {
    return "/settings";
  }
  if (pathname === "/roles" || pathname === "/admin/roles") {
    return "/admin/roles";
  }
  if (pathname === "/users" || pathname === "/admin/users" || pathname === "/super-admin/users") {
    return "/admin/users";
  }
  if (pathname === "/audit-logs" || pathname === "/admin/audit-logs" || pathname === "/admin/audit_logs") {
    return "/admin/audit-logs";
  }
  if (
    pathname === "/salary-slips" ||
    pathname === "/salary" ||
    pathname === "/admin/salary-slips" ||
    pathname.endsWith("/salary-slips") ||
    pathname.endsWith("/salary")
  ) {
    return `/${workspaceRole}/salary-slips`;
  }
  if (pathname === "/announcements" || pathname === "/admin/announcements" || pathname.endsWith("/announcements")) {
    return `/${workspaceRole}/announcements`;
  }
  if (pathname === "/reports" || pathname === "/admin/reports" || pathname.endsWith("/reports")) {
    return `/${workspaceRole}/reports`;
  }
  if (pathname === "/attendance" || pathname === "/admin/attendance" || pathname.endsWith("/attendance")) {
    return `/${workspaceRole}/attendance`;
  }
  if (pathname === "/tracking" || pathname === "/admin/tracking" || pathname.endsWith("/tracking")) {
    return "/tracking";
  }
  if (pathname === "/leaves" || pathname === "/admin/leaves" || pathname.endsWith("/leaves")) {
    return `/${workspaceRole}/leaves`;
  }
  if (pathname === "/meetings" || pathname === "/admin/meetings" || pathname.endsWith("/meetings")) {
    return `/${workspaceRole}/meetings`;
  }
  if (pathname === "/kpi" || pathname === "/admin/kpi" || pathname.endsWith("/kpi")) {
    return `/${workspaceRole}/kpi`;
  }
  if (pathname === "/work" || pathname === "/admin/work" || pathname.endsWith("/work")) {
    return `/${workspaceRole}/work${query}`;
  }
  if (pathname === "/team-work" || pathname === "/admin/team-work" || pathname === "/team-lead/team-work") {
    return "/team-work";
  }
  if (pathname === "/pages" || pathname === "/admin/pages") {
    return "/pages";
  }
  if (pathname === "/timer" || pathname === "/work/timer" || pathname === "/admin/timer") {
    return "/timer";
  }
  if (pathname === "/chat" || pathname === "/admin/chat" || pathname.endsWith("/chat")) {
    return "/chat";
  }
  if (pathname === "/tools" || pathname === "/admin/tools" || pathname.endsWith("/tools")) {
    return "/tools";
  }
  if (pathname === "/clients/tasks" || pathname === "/admin/clients/tasks" || pathname.endsWith("/clients/tasks")) {
    return "/clients/tasks";
  }
  if (pathname === "/clients" || pathname === "/admin/clients") {
    return "/clients";
  }
  if (pathname === "/employees" || pathname === "/admin/employees") {
    return `/employees${query}`;
  }

  // Fallback for custom dynamic roles or raw route paths
  return routePath;
}

export const portalRoleRoutes: Record<PortalRole, WorkspaceRole> = {
  SUPER_ADMIN: "admin",
  ADMIN: "admin",
  HR: "hr",
  ACCOUNTANT: "accountant",
  BDE: "bdo",
  TEAM_LEAD: "team-lead",
  EMPLOYEE: "employee",
  OPERATIONS: "admin",
  OPERATIONS_HEAD: "admin",
};

export const expectedPortalRoles: Record<WorkspaceRole, readonly PortalRole[]> = {
  admin: ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "OPERATIONS_HEAD"],
  hr: ["HR"],
  accountant: ["ACCOUNTANT"],
  bdo: ["BDE"],
  "team-lead": ["TEAM_LEAD"],
  employee: ["EMPLOYEE"],
};

export const expectedPortalRole: Record<WorkspaceRole, PortalRole> = {
  admin: "ADMIN",
  hr: "HR",
  accountant: "ACCOUNTANT",
  bdo: "BDE",
  "team-lead": "TEAM_LEAD",
  employee: "EMPLOYEE",
};

export const workspaceLabels: Record<WorkspaceRole, string> = {
  admin: "Administrator",
  hr: "Human Resources",
  accountant: "Accountant",
  bdo: "Business Development",
  "team-lead": "Team Lead",
  employee: "Employee",
};

export const workspaceFallbackNames: Record<WorkspaceRole, string> = {
  admin: "Administrator",
  hr: "Human Resources",
  accountant: "Accountant",
  employee: "Employee",
  bdo: "Business Development",
  "team-lead": "Team Lead",
};
