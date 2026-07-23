"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { Bell, CalendarCheck, CalendarDays, ChevronDown, CircleDollarSign, Clock3, LayoutDashboard, LogOut, Megaphone, Menu, Settings, UserRound, Users, X } from "lucide-react";
import { FlumenxMark, Avatar } from "./icons";
import { api, logout } from "@/lib/api";

const adminNav = [
  ["Overview", "/admin/dashboard", LayoutDashboard], ["Employees", "/admin/employees", Users],
  ["Attendance", "/admin/attendance", CalendarCheck], ["Shift policy", "/admin/attendance/settings", Settings],
  ["Leave requests", "/admin/leaves", CalendarDays], ["Salary slips", "/admin/salary-slips", CircleDollarSign],
  ["Meetings", "/admin/meetings", UserRound], ["Announcements", "/admin/announcements", Megaphone],
] as const;
const employeeNav = [
  ["Overview", "/employee/dashboard", LayoutDashboard], ["My profile", "/employee/profile", UserRound],
  ["My attendance", "/employee/attendance", Clock3],
  ["My leave", "/employee/leaves", CalendarDays], ["Salary slips", "/employee/salary-slips", CircleDollarSign],
  ["Meetings", "/employee/meetings", Users], ["Announcements", "/employee/announcements", Megaphone],
] as const;
const hrNav = [
  ["Overview", "/hr/dashboard", LayoutDashboard], ["Employees", "/hr/employees", Users],
  ["Attendance", "/hr/attendance", CalendarCheck], ["Leave requests", "/hr/leaves", CalendarDays],
  ["Meetings", "/hr/meetings", UserRound], ["Announcements", "/hr/announcements", Megaphone],
] as const;
const accountantNav = [
  ["Overview", "/accountant/dashboard", LayoutDashboard], ["Salary slips", "/accountant/salary-slips", CircleDollarSign],
  ["Attendance", "/accountant/attendance", CalendarCheck],
] as const;
const bdoNav = [
  ["Overview", "/bdo/dashboard", LayoutDashboard], ["My profile", "/bdo/profile", UserRound],
  ["My attendance", "/bdo/attendance", Clock3], ["My leave", "/bdo/leaves", CalendarDays],
  ["Meetings", "/bdo/meetings", Users], ["Announcements", "/bdo/announcements", Megaphone],
] as const;

type Workspace = "admin" | "employee" | "hr" | "accountant" | "bdo";
const roleRoutes: Record<string,string> = { ADMIN:"admin", HR:"hr", ACCOUNTANT:"accountant", BDO:"bdo", EMPLOYEE:"employee" };
const expectedPortalRole: Record<Workspace,string> = { admin:"ADMIN", hr:"HR", accountant:"ACCOUNTANT", bdo:"BDO", employee:"EMPLOYEE" };

export function Shell({ children, role = "admin" }: { children: ReactNode; role?: Workspace }) {
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{first_name?:string;portal_role:string} | null>(null);
  useEffect(() => {
    let active = true;
    api<{first_name?:string;portal_role:string}>("/auth/me/")
      .then(current => {
        if (!active) return;
        const destination = roleRoutes[current.portal_role] || (current.portal_role === "EMPLOYEE" ? "employee" : "");
        if (current.portal_role !== expectedPortalRole[role]) {
          router.replace(destination ? `/${destination}/dashboard` : "/login");
          return;
        }
        localStorage.setItem("flumenx_user", JSON.stringify(current));
        setUser(current); setReady(true);
      })
      .catch(() => { if (active) { localStorage.removeItem("flumenx_user"); router.replace("/login"); } });
    return () => { active = false; };
  }, [role, router]);
  const nav = role === "admin" ? adminNav : role === "hr" ? hrNav : role === "accountant" ? accountantNav : role === "bdo" ? bdoNav : employeeNav;
  const name = user?.first_name || (role === "admin" ? "Aarav Sharma" : role === "hr" ? "Ananya Singh" : role === "accountant" ? "Kabir Shah" : role === "employee" ? "Dev Malhotra" : "Maya Kapoor");
  const roleLabel = role === "admin" ? "Administrator" : role === "hr" ? "Human Resources" : role === "accountant" ? "Accountant" : role === "bdo" ? "Business Development" : "Employee";
  if (!ready) return <div className="route-loader"><span>H</span><p>Opening your workspace</p></div>;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="side-brand"><FlumenxMark /><button className="mobile-close" onClick={() => setOpen(false)}><X /></button></div>
        <div className="workspace"><div className="workspace-icon">FX</div><div><b>FLUMENX HQ</b><span>Core workspace</span></div><ChevronDown size={14} /></div>
        <nav>{nav.map(([label, href, Icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={path === href || (href !== `/${role}/dashboard` && path.startsWith(href)) ? "active" : ""}><Icon size={18} /><span>{label}</span>{label === "Leave requests" && role === "admin" && <em>2</em>}</Link>)}</nav>
        <div className="sidebar-foot">
          <div className="mini-profile"><Avatar name={name} /><div><b>{name}</b><span>{roleLabel}</span></div></div>
          <button onClick={async () => { await logout(); router.replace("/login"); }}><LogOut size={17} /> Sign out</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)}><Menu /></button>
          <div className="topbar-word">FLUMENX / <span>{roleLabel.toUpperCase()}</span></div>
          <div className="top-actions"><button className="icon-button"><Bell size={19} /><i /></button><div className="top-profile"><Avatar name={name} size={34} /><div><b>{name}</b><span>{roleLabel}</span></div></div></div>
        </header>
        <div className="page">{children}</div>
      </main>
    </div>
  );
}

