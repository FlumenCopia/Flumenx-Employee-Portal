"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Calendar,
  Clock,
  Compass,
  MapPin,
  Move,
  PauseCircle,
  RefreshCw,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { TOKENS } from "@/components/design-system/tokens";
import type { DailyLocationSummary } from "@/lib/types";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(dateVal?: string | Date | number | null): string {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

interface DailyLocationSummaryCardProps {
  initialEmployeeId?: string;
  initialDate?: string;
  employeesList?: { id: string; name: string; employeeCode: string; department: string }[];
  isEmployeeSelfView?: boolean;
}

export function DailyLocationSummaryCard({
  initialEmployeeId,
  initialDate,
  employeesList = [],
  isEmployeeSelfView = false,
}: DailyLocationSummaryCardProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(initialEmployeeId || "");
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().split("T")[0]
  );
  const [summary, setSummary] = useState<DailyLocationSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorText, setErrorText] = useState<string>("");

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setErrorText("");

    try {
      const params = new URLSearchParams();
      if (selectedEmployeeId) params.set("employeeId", selectedEmployeeId);
      if (selectedDate) params.set("date", selectedDate);

      const data = await api<DailyLocationSummary>(`/tracking/summary/?${params.toString()}`);
      setSummary(data);
    } catch (err: any) {
      setErrorText(err.message || "Failed to load daily location summary.");
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmployeeId, selectedDate]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Movement vs Stationary percentage split
  const totalTrackedSeconds = summary?.trackingDurationSeconds || 0;
  const movementSeconds = summary?.movementTimeSeconds || 0;
  const stationarySeconds = summary?.stationaryTimeSeconds || 0;

  const movementPercent = totalTrackedSeconds > 0 ? Math.round((movementSeconds / totalTrackedSeconds) * 100) : 0;
  const stationaryPercent = totalTrackedSeconds > 0 ? 100 - movementPercent : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: TOKENS.colors.surfacePanel,
          border: `1px solid ${TOKENS.colors.borderLight}`,
          borderRadius: TOKENS.radius.lg,
          padding: "12px 20px",
          boxShadow: TOKENS.shadows.sm,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {!isEmployeeSelfView && employeesList.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: TOKENS.colors.textSecondary, textTransform: "uppercase" }}>
                Employee:
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: TOKENS.radius.md,
                  border: `1px solid ${TOKENS.colors.borderLight}`,
                  fontSize: "12px",
                  fontWeight: 600,
                  color: TOKENS.colors.textPrimary,
                  background: TOKENS.colors.surfaceSubtle,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Select Employee...</option>
                {employeesList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeCode}) - {emp.department}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: TOKENS.colors.textSecondary, textTransform: "uppercase" }}>
              Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: "5px 10px",
                borderRadius: TOKENS.radius.md,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                fontSize: "12px",
                fontWeight: 600,
                color: TOKENS.colors.textPrimary,
                background: TOKENS.colors.surfaceSubtle,
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            style={{
              padding: "5px 10px",
              borderRadius: TOKENS.radius.md,
              border: `1px solid ${TOKENS.colors.borderLight}`,
              fontSize: "11px",
              fontWeight: 700,
              background:
                selectedDate === new Date().toISOString().split("T")[0]
                  ? TOKENS.colors.brandPrimary
                  : TOKENS.colors.surfaceSubtle,
              color:
                selectedDate === new Date().toISOString().split("T")[0] ? "#FFFFFF" : TOKENS.colors.textSecondary,
              cursor: "pointer",
            }}
          >
            Today
          </button>
        </div>

        <button
          type="button"
          onClick={loadSummary}
          disabled={isLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: TOKENS.colors.surfaceSubtle,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            padding: "6px 12px",
            borderRadius: TOKENS.radius.md,
            fontSize: "12px",
            fontWeight: 600,
            color: TOKENS.colors.textSecondary,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={13} className={isLoading ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Main Summary Panel */}
      {summary ? (
        <div
          style={{
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            borderRadius: TOKENS.radius.lg,
            padding: "24px",
            boxShadow: TOKENS.shadows.sm,
          }}
        >
          {/* Employee Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              paddingBottom: "20px",
              borderBottom: `1px solid ${TOKENS.colors.borderLight}`,
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: TOKENS.colors.surfaceMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "18px",
                  border: `2px solid ${TOKENS.colors.brandPrimary}`,
                }}
              >
                {summary.avatar ? (
                  <img src={summary.avatar} alt={summary.employeeName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  summary.employeeName.charAt(0)
                )}
              </div>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: TOKENS.colors.textPrimary }}>
                  {summary.employeeName}
                </h2>
                <div style={{ fontSize: "12px", color: TOKENS.colors.textSecondary }}>
                  {summary.employeeCode} • {summary.department} • {summary.date}
                </div>
              </div>
            </div>

            <div
              style={{
                background: TOKENS.colors.brandSubtle,
                border: `1px solid ${TOKENS.colors.brandBorder}`,
                borderRadius: TOKENS.radius.md,
                padding: "8px 16px",
                textAlign: "right",
              }}
            >
              <span style={{ fontSize: "11px", color: TOKENS.colors.brandPrimary, fontWeight: 700, textTransform: "uppercase" }}>
                Tracking Session
              </span>
              <div style={{ fontSize: "14px", fontWeight: 800, color: TOKENS.colors.textPrimary }}>
                {formatTime(summary.trackingStarted)} → {formatTime(summary.trackingEnded)}
              </div>
            </div>
          </div>

          {/* Metric Stats Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                background: TOKENS.colors.surfaceSubtle,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                borderRadius: TOKENS.radius.md,
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: TOKENS.colors.textSecondary, textTransform: "uppercase" }}>
                  Total Distance
                </span>
                <TrendingUp size={16} color={TOKENS.colors.brandPrimary} />
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: TOKENS.colors.brandPrimary }}>
                {summary.totalDistanceKm} km
              </div>
              <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted }}>
                Across {summary.totalPoints} GPS points
              </span>
            </div>

            <div
              style={{
                background: TOKENS.colors.surfaceSubtle,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                borderRadius: TOKENS.radius.md,
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: TOKENS.colors.textSecondary, textTransform: "uppercase" }}>
                  Tracking Duration
                </span>
                <Clock size={16} color={TOKENS.colors.info} />
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: TOKENS.colors.textPrimary }}>
                {formatDuration(summary.trackingDurationSeconds)}
              </div>
              <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted }}>
                Active tracking window
              </span>
            </div>

            <div
              style={{
                background: TOKENS.colors.surfaceSubtle,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                borderRadius: TOKENS.radius.md,
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: TOKENS.colors.textSecondary, textTransform: "uppercase" }}>
                  Movement Time
                </span>
                <Move size={16} color={TOKENS.colors.success} />
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: TOKENS.colors.success }}>
                {formatDuration(summary.movementTimeSeconds)}
              </div>
              <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted }}>
                {movementPercent}% of tracking duration
              </span>
            </div>

            <div
              style={{
                background: TOKENS.colors.surfaceSubtle,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                borderRadius: TOKENS.radius.md,
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: TOKENS.colors.textSecondary, textTransform: "uppercase" }}>
                  Stationary Time
                </span>
                <PauseCircle size={16} color={TOKENS.colors.warning} />
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: TOKENS.colors.warning }}>
                {formatDuration(summary.stationaryTimeSeconds)}
              </div>
              <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted }}>
                {stationaryPercent}% of tracking duration
              </span>
            </div>
          </div>

          {/* Movement vs Stationary Progress Bar */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
              <span style={{ color: TOKENS.colors.success }}>Moving: {formatDuration(summary.movementTimeSeconds)} ({movementPercent}%)</span>
              <span style={{ color: TOKENS.colors.warning }}>Stationary: {formatDuration(summary.stationaryTimeSeconds)} ({stationaryPercent}%)</span>
            </div>
            <div style={{ height: "10px", borderRadius: "5px", background: TOKENS.colors.warning, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${movementPercent}%`, background: TOKENS.colors.success, height: "100%", transition: "width 0.5s ease" }} />
            </div>
          </div>

          {/* Extended Details Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {/* First & Last Known Locations */}
            <div
              style={{
                border: `1px solid ${TOKENS.colors.borderLight}`,
                borderRadius: TOKENS.radius.md,
                padding: "16px",
              }}
            >
              <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: 700, color: TOKENS.colors.textPrimary }}>
                First & Last Recorded Fixes
              </h4>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: TOKENS.colors.successBg,
                      color: TOKENS.colors.success,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "11px",
                    }}
                  >
                    1
                  </div>
                  <div>
                    <strong style={{ fontSize: "12px", color: TOKENS.colors.textPrimary }}>First Known Location</strong>
                    <div style={{ fontSize: "11px", color: TOKENS.colors.textMuted }}>
                      {summary.firstKnownLocation ? (
                        <>
                          {summary.firstKnownLocation.latitude.toFixed(5)}, {summary.firstKnownLocation.longitude.toFixed(5)} •{" "}
                          {formatTime(summary.firstKnownLocation.timestamp)}
                        </>
                      ) : (
                        "No data"
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: TOKENS.colors.dangerBg,
                      color: TOKENS.colors.danger,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "11px",
                    }}
                  >
                    2
                  </div>
                  <div>
                    <strong style={{ fontSize: "12px", color: TOKENS.colors.textPrimary }}>Last Known Location</strong>
                    <div style={{ fontSize: "11px", color: TOKENS.colors.textMuted }}>
                      {summary.lastKnownLocation ? (
                        <>
                          {summary.lastKnownLocation.latitude.toFixed(5)}, {summary.lastKnownLocation.longitude.toFixed(5)} •{" "}
                          {formatTime(summary.lastKnownLocation.timestamp)}
                        </>
                      ) : (
                        "No data"
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Longest Stationary Period */}
            <div
              style={{
                border: `1px solid ${TOKENS.colors.borderLight}`,
                borderRadius: TOKENS.radius.md,
                padding: "16px",
              }}
            >
              <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: 700, color: TOKENS.colors.textPrimary }}>
                Longest Stationary Stop
              </h4>

              {summary.longestStationaryPeriod ? (
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: TOKENS.colors.warning, marginBottom: "4px" }}>
                    {formatDuration(summary.longestStationaryPeriod.durationSeconds)}
                  </div>
                  <div style={{ fontSize: "12px", color: TOKENS.colors.textSecondary, marginBottom: "4px" }}>
                    {formatTime(summary.longestStationaryPeriod.startedAt)} → {formatTime(summary.longestStationaryPeriod.endedAt)}
                  </div>
                  <div style={{ fontSize: "11px", color: TOKENS.colors.textMuted }}>
                    Coordinates: {summary.longestStationaryPeriod.latitude?.toFixed(5)},{" "}
                    {summary.longestStationaryPeriod.longitude?.toFixed(5)}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: TOKENS.colors.textMuted, padding: "10px 0" }}>
                  No stationary stop longer than 5 minutes recorded.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : !isLoading ? (
        <div
          style={{
            background: TOKENS.colors.surfacePanel,
            border: `1px solid ${TOKENS.colors.borderLight}`,
            borderRadius: TOKENS.radius.lg,
            padding: "40px",
            textAlign: "center",
            color: TOKENS.colors.textMuted,
          }}
        >
          <Calendar size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: 700, color: TOKENS.colors.textPrimary }}>
            No Summary Available
          </h3>
          <p style={{ margin: 0, fontSize: "12px" }}>
            No tracking data found for the selected date.
          </p>
        </div>
      ) : null}
    </div>
  );
}
