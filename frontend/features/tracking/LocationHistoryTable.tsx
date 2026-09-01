"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { TOKENS } from "@/components/design-system/tokens";
import type { LocationHistoryPoint } from "@/lib/types";

interface LocationHistoryTableProps {
  initialEmployeeId?: string;
  initialDate?: string;
  employeesList?: { id: string; name: string; employeeCode: string; department: string }[];
  isEmployeeSelfView?: boolean;
}

export function LocationHistoryTable({
  initialEmployeeId,
  initialDate,
  employeesList = [],
  isEmployeeSelfView = false,
}: LocationHistoryTableProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(initialEmployeeId || "");
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().split("T")[0]
  );
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);
  const [points, setPoints] = useState<LocationHistoryPoint[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorText, setErrorText] = useState<string>("");

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorText("");

    try {
      const params = new URLSearchParams();
      if (selectedEmployeeId) params.set("employeeId", selectedEmployeeId);
      if (selectedDate) params.set("date", selectedDate);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const data = await api<{ results: LocationHistoryPoint[]; count: number; totalPages: number }>(
        `/tracking/history/?${params.toString()}`
      );

      if (data) {
        setPoints(data.results || []);
        setTotalCount(data.count || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err: any) {
      setErrorText(err.message || "Failed to load location history.");
      setPoints([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmployeeId, selectedDate, page, limit]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (selectedEmployeeId) params.set("employeeId", selectedEmployeeId);
    if (selectedDate) params.set("date", selectedDate);
    window.open(`/api/tracking/export/?${params.toString()}`, "_blank");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Filters & Export Header */}
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
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setPage(1);
                }}
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
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
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
            onClick={() => {
              setSelectedDate(new Date().toISOString().split("T")[0]);
              setPage(1);
            }}
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

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={loadHistory}
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

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={points.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: TOKENS.colors.brandPrimary,
              color: "#FFFFFF",
              border: 0,
              padding: "6px 14px",
              borderRadius: TOKENS.radius.md,
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              opacity: points.length === 0 ? 0.6 : 1,
            }}
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table Panel */}
      <div
        style={{
          background: TOKENS.colors.surfacePanel,
          border: `1px solid ${TOKENS.colors.borderLight}`,
          borderRadius: TOKENS.radius.lg,
          overflow: "hidden",
          boxShadow: TOKENS.shadows.sm,
        }}
      >
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${TOKENS.colors.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: TOKENS.colors.textPrimary }}>
            Location Points ({totalCount.toLocaleString()} total)
          </span>
          <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted }}>
            Page {page} of {totalPages}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: TOKENS.colors.surfaceSubtle, borderBottom: `1px solid ${TOKENS.colors.borderLight}`, color: TOKENS.colors.textSecondary }}>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Time (IST)</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Latitude</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Longitude</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Accuracy</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Speed</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Heading</th>
                <th style={{ padding: "10px 16px", fontWeight: 700 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {points.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: TOKENS.colors.textMuted }}>
                    {isLoading ? "Loading location points..." : "No location points recorded for this date."}
                  </td>
                </tr>
              ) : (
                points.map((pt, idx) => {
                  const d = new Date(pt.timestamp);
                  const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                  const isMoving = (pt.speed || 0) > 1.0;
                  const speedKmh = pt.speed ? (pt.speed * 3.6).toFixed(1) : "0.0";

                  return (
                    <tr
                      key={pt._id || pt.id || idx}
                      style={{
                        borderBottom: `1px solid ${TOKENS.colors.borderLight}`,
                        background: idx % 2 === 0 ? "#FFFFFF" : TOKENS.colors.surfaceSubtle,
                      }}
                    >
                      <td style={{ padding: "10px 16px", fontWeight: 600, color: TOKENS.colors.textPrimary }}>
                        {timeStr}
                      </td>
                      <td style={{ padding: "10px 16px", color: TOKENS.colors.textSecondary, fontFamily: "monospace" }}>
                        {pt.latitude.toFixed(6)}
                      </td>
                      <td style={{ padding: "10px 16px", color: TOKENS.colors.textSecondary, fontFamily: "monospace" }}>
                        {pt.longitude.toFixed(6)}
                      </td>
                      <td style={{ padding: "10px 16px", color: TOKENS.colors.textSecondary }}>
                        {pt.accuracy ? `${Math.round(pt.accuracy)} m` : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", color: TOKENS.colors.textSecondary }}>
                        {speedKmh} km/h
                      </td>
                      <td style={{ padding: "10px 16px", color: TOKENS.colors.textSecondary }}>
                        {pt.heading ? `${Math.round(pt.heading)}°` : "—"}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "10px",
                            background: isMoving ? TOKENS.colors.successBg : TOKENS.colors.warningBg,
                            color: isMoving ? TOKENS.colors.success : TOKENS.colors.warning,
                            border: `1px solid ${isMoving ? TOKENS.colors.successBorder : TOKENS.colors.warningBorder}`,
                          }}
                        >
                          {isMoving ? "Moving" : "Stationary"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 20px",
              borderTop: `1px solid ${TOKENS.colors.borderLight}`,
              background: TOKENS.colors.surfaceSubtle,
            }}
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                borderRadius: TOKENS.radius.sm,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                background: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 600,
                cursor: page <= 1 ? "not-allowed" : "pointer",
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <span style={{ fontSize: "12px", color: TOKENS.colors.textSecondary }}>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                borderRadius: TOKENS.radius.sm,
                border: `1px solid ${TOKENS.colors.borderLight}`,
                background: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 600,
                cursor: page >= totalPages ? "not-allowed" : "pointer",
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
