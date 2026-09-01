"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui";
import { TOKENS } from "@/components/design-system/tokens";
import { EmployeeTrackingCard } from "./EmployeeTrackingCard";
import { DailyLocationSummaryCard } from "./DailyLocationSummaryCard";
import { LocationHistoryTable } from "./LocationHistoryTable";

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

export function EmployeeTrackingPage() {
  const [activeTab, setActiveTab] = useState<"status" | "route" | "summary" | "history">("status");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <PageHeader
        eyebrow="FLUMENX WORKFORCE MOBILITY"
        title="My Location Tracking"
        subtitle="Manage your live GPS tracking session, view your daily travel route, and inspect location history."
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
          onClick={() => setActiveTab("status")}
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
            background: activeTab === "status" ? TOKENS.colors.brandPrimary : "transparent",
            color: activeTab === "status" ? "#FFFFFF" : TOKENS.colors.textSecondary,
          }}
        >
          <MapPin size={14} /> Tracking Controls
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
          <Navigation size={14} /> Today&apos;s Route & Replay
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
          <Clock size={14} /> Location History
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "status" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <EmployeeTrackingCard />
          <DailyRouteMap isEmployeeSelfView={true} />
        </div>
      )}

      {activeTab === "route" && <DailyRouteMap isEmployeeSelfView={true} />}

      {activeTab === "summary" && <DailyLocationSummaryCard isEmployeeSelfView={true} />}

      {activeTab === "history" && <LocationHistoryTable isEmployeeSelfView={true} />}
    </div>
  );
}
