import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, CalendarCheck, CalendarDays, Clock3, LayoutDashboard, UserRound, Users } from "lucide-react";
import type { PortalRole, WorkspaceRole } from "@/lib/types";

export type NavigationItem = readonly [label: string, href: string, Icon: LucideIcon];

const adminNav = [
  ["Overview", "/admin/dashboard", LayoutDashboard], ["Employees", "/admin/employees", Users],
  ["Attendance", "/admin/attendance", CalendarCheck],
  ["Work", "/admin/work", BriefcaseBusiness],
  ["Leave requests", "/admin/leaves", CalendarDays],
  ["Meetings", "/admin/meetings", UserRound],
] as const satisfies readonly NavigationItem[];

const employeeNav = [
  ["Overview", "/employee/dashboard", LayoutDashboard], ["My profile", "/employee/profile", UserRound],
  ["My attendance", "/employee/attendance", Clock3],
  ["My Work", "/employee/work", BriefcaseBusiness],
  ["My leave", "/employee/leaves", CalendarDays],
  ["Meetings", "/employee/meetings", Users],
] as const satisfies readonly NavigationItem[];

const hrNav = [
  ["Overview", "/hr/dashboard", LayoutDashboard], ["Employees", "/hr/employees", Users],
  ["Attendance", "/hr/attendance", CalendarCheck], ["Leave requests", "/hr/leaves", CalendarDays],
  ["Work", "/hr/work", BriefcaseBusiness],
  ["Meetings", "/hr/meetings", UserRound],
] as const satisfies readonly NavigationItem[];

const accountantNav = [
  ["Overview", "/accountant/dashboard", LayoutDashboard],
  ["Attendance", "/accountant/attendance", CalendarCheck],
] as const satisfies readonly NavigationItem[];

const bdoNav = [
  ["Overview", "/bdo/dashboard", LayoutDashboard], ["My profile", "/bdo/profile", UserRound],
  ["My attendance", "/bdo/attendance", Clock3], ["My leave", "/bdo/leaves", CalendarDays],
  ["Work", "/bdo/work", BriefcaseBusiness],
  ["Meetings", "/bdo/meetings", Users],
] as const satisfies readonly NavigationItem[];

const teamLeadNav = [
  ["Overview", "/team-lead/dashboard", LayoutDashboard],
  ["Work", "/team-lead/work", BriefcaseBusiness],
] as const satisfies readonly NavigationItem[];

export const workspaceNavigation: Record<WorkspaceRole, readonly NavigationItem[]> = {
  admin: adminNav,
  employee: employeeNav,
  hr: hrNav,
  accountant: accountantNav,
  bdo: bdoNav,
  "team-lead": teamLeadNav,
};

export const portalRoleRoutes: Record<PortalRole, WorkspaceRole> = {
  ADMIN: "admin",
  HR: "hr",
  ACCOUNTANT: "accountant",
  BDE: "bdo",
  TEAM_LEAD: "team-lead",
  EMPLOYEE: "employee",
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
