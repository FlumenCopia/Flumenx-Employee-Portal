import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
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
  Megaphone,
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
  CalendarCheck,
  CalendarDays,
  UserRound,
  Clock3,
  BriefcaseBusiness,
  Megaphone,
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
  ["Command Center", "/admin/work?view=command-center", Sparkles],
  ["Task Board", "/admin/work?view=kanban", Kanban],
  ["Time Tracker", "/timer", Clock3],
  ["Team Work", "/team-work", Users],
  ["Clients Master", "/clients", BriefcaseBusiness],
  ["Timeline & Phases", "/admin/work?view=timeline", Layers],
  ["KPI Performance", "/admin/kpi", TrendingUp],
  ["Employees Directory", "/employees", Users],
  ["Attendance", "/admin/attendance", CalendarCheck],
  ["Leave Requests", "/admin/leaves", CalendarDays],
  ["Meetings", "/admin/meetings", UserRound],
  ["Reports Center", "/admin/reports", FileSpreadsheet],
  ["Dynamic Roles", "/admin/roles", Shield],
  ["User Management", "/admin/users", UserCheck],
  ["Page Management", "/pages", FileCode],
  ["Salary Slips", "/admin/salary-slips", FileCode],
  ["Announcements", "/admin/announcements", Megaphone],
  ["Audit Logs", "/admin/audit-logs", BarChart3],
  ["Settings & Access", "/settings", Settings],
] as const satisfies readonly NavigationItem[];

const employeeNav = [
  ["Task Board", "/employee/work?view=kanban", Kanban],
  ["Time Tracker", "/timer", Clock3],
  ["Team Work", "/team-work", Users],
  ["KPI Performance", "/employee/kpi", TrendingUp],
  ["Employees Directory", "/employees", Users],
  ["My Profile", "/employee/profile", UserRound],
  ["My Attendance", "/employee/attendance", Clock3],
  ["My Leave", "/employee/leaves", CalendarDays],
  ["Meetings", "/employee/meetings", Users],
] as const satisfies readonly NavigationItem[];

const hrNav = [
  ["Task Board", "/hr/work?view=kanban", Kanban],
  ["Time Tracker", "/timer", Clock3],
  ["Team Work", "/team-work", Users],
  ["KPI Performance", "/hr/kpi", TrendingUp],
  ["Employees Directory", "/employees", Users],
  ["Attendance", "/hr/attendance", CalendarCheck],
  ["Leave Requests", "/hr/leaves", CalendarDays],
  ["Meetings", "/hr/meetings", UserRound],
  ["Reports Center", "/hr/reports", FileSpreadsheet],
  ["Announcements", "/admin/announcements", Megaphone],
] as const satisfies readonly NavigationItem[];

const accountantNav = [
  ["Task Board", "/admin/work?view=kanban", Kanban],
  ["Time Tracker", "/timer", Clock3],
  ["Attendance", "/accountant/attendance", CalendarCheck],
  ["Leave Requests", "/accountant/leaves", CalendarDays],
  ["Salary Slips", "/admin/salary-slips", FileCode],
  ["Reports Center", "/accountant/reports", FileSpreadsheet],
] as const satisfies readonly NavigationItem[];

const bdoNav = [
  ["Task Board", "/bdo/work?view=kanban", Kanban],
  ["Time Tracker", "/timer", Clock3],
  ["Clients Master", "/clients", BriefcaseBusiness],
  ["Meetings", "/bdo/meetings", Users],
] as const satisfies readonly NavigationItem[];

const teamLeadNav = [
  ["Task Board", "/team-lead/work?view=kanban", Kanban],
  ["Time Tracker", "/timer", Clock3],
  ["Team Work", "/team-lead/team-work", Users],
  ["KPI Performance", "/kpi", TrendingUp],
  ["Employees Directory", "/employees", Users],
  ["Meetings", "/meetings", Users],
  ["Reports Center", "/team-lead/reports", FileSpreadsheet],
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

export function getWorkspaceRole(portalRole?: string): WorkspaceRole {
  if (!portalRole) return "employee";
  const role = portalRole.trim().toUpperCase();
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "OPERATIONS" || role === "OPERATIONS_HEAD") {
    return "admin";
  }
  if (role === "HR") return "hr";
  if (role === "ACCOUNTANT") return "accountant";
  if (role === "BDE") return "bdo";
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
  if (pathname === "/salary-slips" || pathname === "/admin/salary-slips") {
    return "/admin/salary-slips";
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
  if (pathname === "/clients" || pathname === "/admin/clients") {
    return "/clients";
  }
  if (pathname === "/work" || pathname === "/admin/work") {
    return `/work${query}`;
  }
  if (pathname === "/kpi" || pathname === "/admin/kpi") {
    return `/kpi${query}`;
  }
  if (pathname === "/employees" || pathname === "/admin/employees") {
    return `/employees${query}`;
  }
  if (pathname === "/attendance" || pathname === "/admin/attendance") {
    return `/attendance${query}`;
  }
  if (pathname === "/leaves" || pathname === "/admin/leaves") {
    return `/leaves${query}`;
  }
  if (pathname === "/meetings" || pathname === "/admin/meetings") {
    return `/meetings${query}`;
  }

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
