"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Clock,
  CalendarCheck,
  User,
  Plus,
  X,
  Users,
  FileText,
  Smartphone,
  LogOut,
  Sparkles,
  Layers,
  Menu,
  KeyRound,
} from "lucide-react";
import type { AuthUser, WorkspaceRole } from "@/lib/types";

interface MobileBottomNavProps {
  workspaceRole: WorkspaceRole;
  user: AuthUser | null;
  onOpenSidebar: () => void;
  onOpenLogout: () => void;
  onNewTaskClick: () => void;
}

export function MobileBottomNav({
  workspaceRole,
  user,
  onOpenSidebar,
  onOpenLogout,
  onNewTaskClick,
}: MobileBottomNavProps) {
  const path = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  // Close popup when path changes
  useEffect(() => {
    setExpanded(false);
  }, [path]);

  // Lock body scroll when popup sheet is open
  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [expanded]);

  const rolePrefix = workspaceRole === "admin" ? "/admin" : workspaceRole === "hr" ? "/hr" : workspaceRole === "bdo" ? "/bdo" : workspaceRole === "team-lead" ? "/team-lead" : "/employee";

  const isWorkActive = path.includes("/work");
  const isTimerActive = path.includes("/timer");
  const isAttendanceActive = path.includes("/attendance");
  const isProfileActive = path.includes("/profile") || path.includes("/dashboard");

  return (
    <>
      {/* Dimmed backdrop when center circle is expanded */}
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9998,
            animation: "fadeIn 0.2s ease-out",
          }}
        />
      )}

      {/* Expanded Quick-Action Sheet */}
      {expanded && (
        <div
          style={{
            position: "fixed",
            bottom: "76px",
            left: "14px",
            right: "14px",
            maxWidth: "420px",
            margin: "0 auto",
            background: "#13231F",
            border: "1px solid rgba(8, 122, 91, 0.35)",
            borderRadius: "20px",
            padding: "16px",
            zIndex: 9999,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(8, 122, 91, 0.2)",
            animation: "slideUpSmooth 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/flumenx-mark-only.png" alt="FLUMENX OS" style={{ width: "20px", height: "20px" }} />
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#34D399", letterSpacing: "0.1em" }}>FLUMENX OS ACTIONS</span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#94a3b8", borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                onNewTaskClick();
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                padding: "12px 6px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #087A5B 0%, #055C44 100%)",
                border: "1px solid #34D399",
                color: "#FFFFFF",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <Plus size={20} />
              <span style={{ fontSize: "11px", fontWeight: 700 }}>+ New Task</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                router.push(`${rolePrefix}/attendance`);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                padding: "12px 6px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#E2E8F0",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <CalendarCheck size={20} color="#34D399" />
              <span style={{ fontSize: "11px", fontWeight: 600 }}>Attendance</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                router.push(workspaceRole === "admin" ? "/admin/employees" : "/employees");
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                padding: "12px 6px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#E2E8F0",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <Users size={20} color="#38BDF8" />
              <span style={{ fontSize: "11px", fontWeight: 600 }}>Team Directory</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                router.push(workspaceRole === "admin" ? "/admin/salary-slips" : "/employee/salary-slips");
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                padding: "12px 6px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#E2E8F0",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <FileText size={20} color="#FBBF24" />
              <span style={{ fontSize: "11px", fontWeight: 600 }}>Salary Slips</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("flumenx:open_change_password_modal"));
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                padding: "12px 6px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#E2E8F0",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <KeyRound size={20} color="#34D399" />
              <span style={{ fontSize: "11px", fontWeight: 600 }}>Password</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                onOpenSidebar();
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                padding: "12px 6px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#E2E8F0",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <Menu size={20} color="#A78BFA" />
              <span style={{ fontSize: "11px", fontWeight: 600 }}>Full Menu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                onOpenLogout();
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                padding: "12px 6px",
                borderRadius: "12px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#FCA5A5",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <LogOut size={20} color="#EF4444" />
              <span style={{ fontSize: "11px", fontWeight: 700 }}>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Persistent Bottom Navigation Bar for Mobile */}
      <nav className="mobile-bottom-nav">
        <Link
          href={`${rolePrefix}/work?view=kanban`}
          className={`mobile-nav-item ${isWorkActive ? "active" : ""}`}
        >
          <Briefcase size={18} />
          <span>Work</span>
        </Link>

        <Link
          href={`${rolePrefix}/timer`}
          className={`mobile-nav-item ${isTimerActive ? "active" : ""}`}
        >
          <Clock size={18} />
          <span>Timer</span>
        </Link>

        {/* Center Floating Elevated Circle Button */}
        <div className="mobile-center-fab-wrapper">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`mobile-center-fab ${expanded ? "fab-open" : ""}`}
            title="Quick Action Hub"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/flumenx-mark-only.png"
              alt="FLUMENX OS"
              style={{ width: "26px", height: "26px", objectFit: "contain" }}
            />
          </button>
        </div>

        <Link
          href={`${rolePrefix}/attendance`}
          className={`mobile-nav-item ${isAttendanceActive ? "active" : ""}`}
        >
          <CalendarCheck size={18} />
          <span>Attendance</span>
        </Link>

        <button
          type="button"
          onClick={onOpenSidebar}
          className="mobile-nav-item"
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
