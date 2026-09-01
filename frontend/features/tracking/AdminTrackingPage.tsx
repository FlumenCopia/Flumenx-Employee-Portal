"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Calendar,
  Clock,
  Compass,
  FileSpreadsheet,
  Layers,
  MapPin,
  Navigation,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui";
import { TOKENS } from "@/components/design-system/tokens";
import { api } from "@/lib/api";
import { DailyLocationSummaryCard } from "./DailyLocationSummaryCard";
import { LocationHistoryTable } from "./LocationHistoryTable";
import { EmployeeTrackingCard } from "./EmployeeTrackingCard";

const LiveTrackingMap = dynamic(
  () => import("./LiveTrackingMap").then((m) => m.LiveTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: "650px", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F3", borderRadius: "12px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#718096" }}>Initializing Live Map radar...</span>
      </div>
    ),
  }
);

const DailyRouteMap = dynamic(
  () => import("./DailyRouteMap").then((m) => m.DailyRouteMap),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: "650px", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F3", borderRadius: "12px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#718096" }}>Loading route visualizer...</span>
      </div>
    ),
  }
);

export function AdminTrackingPage() {
  const [activeTab, setActiveTab] = useState<"live" | "route" | "summary" | "history" | "personal">("live");
  const [selectedEmployeeIdForView, setSelectedEmployeeIdForView] = useState<string>("");
  const [employeesList, setEmployeesList] = useState<{ id: string; name: string; employeeCode: string; department: string }[]>([]);

  // Load employee directory options for dropdowns
  const loadEmployeesDirectory = useCallback(async () => {
    try {
      const res = await api<{ employees: any[] }>("/tracking/live/");
      if (res?.employees) {
        setEmployeesList(
          res.employees.map((e) => ({
            id: e.id || e._id,
            name: e.name,
            employeeCode: e.employeeCode,
            department: e.department,
          }))
        );
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    loadEmployeesDirectory();
  }, [loadEmployeesDirectory]);

  const handleJumpToRoute = (employeeId: string) => {
    setSelectedEmployeeIdForView(employeeId);
    setActiveTab("route");
  };

  const handleJumpToHistory = (employeeId: string) => {
    setSelectedEmployeeIdForView(employeeId);
    setActiveTab("history");
  };

  const handleJumpToSummary = (employeeId: string) => {
    setSelectedEmployeeIdForView(employeeId);
    setActiveTab("summary");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <PageHeader
        eyebrow="FLUMENX WORKFORCE MOBILITY"
        title="Employee Location Tracking"
        subtitle="Live GPS tracking radar, daily route visualization, route replay, and comprehensive geospatial analytics."
      />

      {/* Tabs Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: TOKENS.colors.surfacePanel,
          border: `1px solid ${TOKENS.colors.borderLight}`,
          padding: "6px",
          borderRadius: TOKENS.radius.lg,
          width: "fit-content",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("live")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: TOKENS.radius.md,
            border: 0,
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: activeTab === "live" ? TOKENS.colors.brandPrimary : "transparent",
            color: activeTab === "live" ? "#FFFFFF" : TOKENS.colors.textSecondary,
          }}
        >
          <MapPin size={14} /> Live Radar Map
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("route")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: TOKENS.radius.md,
            border: 0,
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: activeTab === "route" ? TOKENS.colors.brandPrimary : "transparent",
            color: activeTab === "route" ? "#FFFFFF" : TOKENS.colors.textSecondary,
          }}
        >
          <Navigation size={14} /> Daily Route & Replay
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: TOKENS.radius.md,
            border: 0,
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: activeTab === "summary" ? TOKENS.colors.brandPrimary : "transparent",
            color: activeTab === "summary" ? "#FFFFFF" : TOKENS.colors.textSecondary,
          }}
        >
          <TrendingUp size={14} /> Daily Summary
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: TOKENS.radius.md,
            border: 0,
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: activeTab === "history" ? TOKENS.colors.brandPrimary : "transparent",
            color: activeTab === "history" ? "#FFFFFF" : TOKENS.colors.textSecondary,
          }}
        >
          <Clock size={14} /> Location History & Export
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("personal")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: TOKENS.radius.md,
            border: 0,
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: activeTab === "personal" ? TOKENS.colors.brandPrimary : "transparent",
            color: activeTab === "personal" ? "#FFFFFF" : TOKENS.colors.textSecondary,
          }}
        >
          <User size={14} /> My Personal Clock-In / Tracking
        </button>
      </div>

      {/* Tab Content Panels */}
      {activeTab === "live" && (
        <LiveTrackingMap
          onViewRoute={handleJumpToRoute}
          onViewHistory={handleJumpToHistory}
          onViewSummary={handleJumpToSummary}
        />
      )}

      {activeTab === "route" && (
        <DailyRouteMap
          initialEmployeeId={selectedEmployeeIdForView}
          employeesList={employeesList}
        />
      )}

      {activeTab === "summary" && (
        <DailyLocationSummaryCard
          initialEmployeeId={selectedEmployeeIdForView}
          employeesList={employeesList}
        />
      )}

      {activeTab === "history" && (
        <LocationHistoryTable
          initialEmployeeId={selectedEmployeeIdForView}
          employeesList={employeesList}
        />
      )}

      {activeTab === "personal" && (
        <div style={{ maxWidth: "600px" }}>
          <EmployeeTrackingCard />
        </div>
      )}
    </div>
  );
}
