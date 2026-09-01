"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Clock3, FileBarChart, MapPin, TimerOff, UserX, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { AttendanceRecord, Paginated } from "@/lib/types";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, Section, StatCard } from "@/components/ui";
import { defaultSummary, displayTime, statusTone, getTodayISTDateString } from "./helpers";
import { AttendanceSummary } from "./types";
import { AttendanceDetailModal } from "./AttendanceDetailModal";

export interface AttendanceCorrectionItem {
  id: string;
  _id?: string;
  employee?: {
    _id?: string;
    id?: number | string;
    display_name?: string;
    name?: string;
    employee_code?: string;
    department?: string;
  };
  attendanceRecord?: {
    _id?: string;
    id?: number | string;
    attendanceDate?: string;
    attendance_date?: string;
    checkInTime?: string | null;
    check_in_time?: string | null;
    checkOutTime?: string | null;
    check_out_time?: string | null;
    attendanceStatus?: string;
    attendance_status?: string;
  };
  requestedCheckIn?: string | null;
  requested_check_in?: string | null;
  requestedCheckOut?: string | null;
  requested_check_out?: string | null;
  reason?: string;
  status: "Pending" | "Approved" | "Rejected";
  adminNote?: string;
  admin_note?: string;
  createdAt?: string;
}

export function AdminAttendancePage() {
  const [filter, setFilter] = useState("All");
  const [date, setDate] = useState(() => getTodayISTDateString());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>(defaultSummary);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  // Correction approval workflow state
  const [corrections, setCorrections] = useState<AttendanceCorrectionItem[]>([]);
  const [correctionsLoading, setCorrectionsLoading] = useState(true);
  const [correctionFilter, setCorrectionFilter] = useState<"Pending" | "All" | "Approved" | "Rejected">("Pending");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const rows = useMemo(
    () =>
      records.filter(
        (r) => filter === "All" || (filter === "Late" ? r.is_late : filter === "Early Exit" ? r.is_early_exit : r.attendance_status === filter)
      ),
    [records, filter]
  );

  const filteredCorrections = useMemo(() => {
    return corrections.filter((c) => (correctionFilter === "All" ? true : c.status === correctionFilter));
  }, [corrections, correctionFilter]);

  const loadCorrections = () => {
    setCorrectionsLoading(true);
    api<AttendanceCorrectionItem[]>("/attendance-corrections/")
      .then((res) => {
        setCorrections(Array.isArray(res) ? res : []);
      })
      .catch(() => setCorrections([]))
      .finally(() => setCorrectionsLoading(false));
  };

  const reloadAllAttendance = () => {
    loadCorrections();
    setRecordsLoading(true);
    api<Paginated<AttendanceRecord>>(`/attendance/?date=${date}`)
      .then((data) => setRecords(data.results))
      .catch(() => {})
      .finally(() => setRecordsLoading(false));
  };

  useEffect(() => {
    loadCorrections();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setRecordsLoading(true);
    setRecordsError("");

    api<Paginated<AttendanceRecord>>(`/attendance/?date=${date}`, { signal: controller.signal })
      .then((data) => setRecords(data.results))
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setRecords([]);
        setRecordsError(err instanceof Error ? err.message : "Could not load attendance records.");
      })
      .finally(() => setRecordsLoading(false));

    return () => controller.abort();
  }, [date]);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryLoading(true);
    setSummaryError("");

    api<AttendanceSummary>(`/attendance/summary/?date=${date}`, { signal: controller.signal })
      .then(setSummary)
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setSummary(defaultSummary);
        setSummaryError(err instanceof Error ? err.message : "Could not load attendance summary.");
      })
      .finally(() => setSummaryLoading(false));

    return () => controller.abort();
  }, [date]);

  const handleUpdateCorrectionStatus = async (correctionId: string, status: "Approved" | "Rejected") => {
    const note = window.prompt(`Enter optional admin note for ${status.toLowerCase()}ing this request:`, status === "Approved" ? "Approved by Management" : "Correction request rejected.");
    if (note === null) return;

    setActionLoadingId(correctionId);
    setActionMessage("");
    try {
      await api(`/attendance-corrections/${correctionId}/`, {
        method: "PATCH",
        body: JSON.stringify({ status, admin_note: note }),
      });
      const msg = `Attendance correction request successfully ${status.toLowerCase()}!`;
      setActionMessage(msg);
      toast.success(msg);
      reloadAllAttendance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update correction request status.";
      toast.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const summaryUnavailable = summaryLoading || Boolean(summaryError);
  const pendingCorrectionsCount = corrections.filter((c) => c.status === "Pending").length;

  return (
    <>
      <PageHeader
        eyebrow="PEOPLE / ATTENDANCE CONTROL"
        title="Attendance."
        subtitle="Today's workforce rhythm, attendance correction approvals, and live register across all departments."
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Link className="secondary-button" href="/admin/attendance/settings">
              <MapPin size={16} /> GPS &amp; Policy Settings
            </Link>
            <Link className="secondary-button" href="/admin/attendance/reports">
              <FileBarChart size={16} /> Reports &amp; Export
            </Link>
          </div>
        }
      />

      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border2)",
          borderRadius: "12px",
          padding: "14px 18px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(203,168,110,0.15)",
              border: "1px solid rgba(203,168,110,0.3)",
              color: "var(--goldD)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Clock3 size={18} />
          </div>
          <div>
            <b style={{ fontSize: "13px", color: "var(--text)", display: "block" }}>Company-Wide Attendance & Half Day Cutoff Policy</b>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              Office hours are <b>09:30 AM – 06:30 PM</b> (5-min grace until <b>09:35 AM</b>). Check-ins after <b>09:35 AM</b> or checkouts before <b>06:00 PM</b> automatically mark as <b>Half Day</b>. Click on any record verification to view photo & GPS distance details.
            </span>
          </div>
        </div>
      </div>

      {summaryError && <EmptyState title="Could not load attendance summary" text={summaryError} />}
      <div className="stats-grid attendance-stats">
        <StatCard label="Present today" value={summaryUnavailable ? "Not available" : String(summary.present).padStart(2, "0")} note={summaryUnavailable ? "Summary unavailable" : `${summary.attendance_percentage}% of active team`} icon={<CheckCircle2 />} />
        <StatCard label="Late arrivals" value={summaryUnavailable ? "Not available" : String(summary.late).padStart(2, "0")} note="Calculated from office time" icon={<Clock3 />} accent />
        <StatCard label="Early exits" value={summaryUnavailable ? "Not available" : String(summary.early_exits).padStart(2, "0")} note="Before office end time" icon={<TimerOff />} />
        <StatCard label="Absent today" value={summaryUnavailable ? "Not available" : String(summary.absent).padStart(2, "0")} note={summaryUnavailable ? "Summary unavailable" : `${summary.leave} on leave`} icon={<UserX />} />
      </div>

      {/* HIGHER MANAGEMENT ATTENDANCE CORRECTION APPROVAL PANEL */}
      <Section
        title={`Attendance Correction Requests ${pendingCorrectionsCount > 0 ? `(${pendingCorrectionsCount} Pending)` : ""}`}
        kicker="APPROVAL WORKFLOW / CORRECTIONS"
        action={
          <div className="table-filters" style={{ display: "flex", gap: "6px" }}>
            {(["Pending", "All", "Approved", "Rejected"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setCorrectionFilter(st)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  border: correctionFilter === st ? "1px solid var(--amber)" : "1px solid var(--border)",
                  background: correctionFilter === st ? "var(--amber)" : "var(--panel)",
                  color: correctionFilter === st ? "#ffffff" : "var(--text)",
                  cursor: "pointer",
                }}
              >
                {st} {st === "Pending" && pendingCorrectionsCount > 0 ? `(${pendingCorrectionsCount})` : ""}
              </button>
            ))}
          </div>
        }
      >
        {actionMessage && (
          <div style={{ padding: "8px 12px", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", borderRadius: "8px", fontSize: "12px", fontWeight: 600, marginBottom: "10px" }}>
            ✓ {actionMessage}
          </div>
        )}

        <div className="table-responsive-wrapper" style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "8px" }}>
          <div className="data-table attendance-corrections-table" style={{ minWidth: "750px" }}>
            <div className="table-head">
              <span>Employee</span>
              <span>Date</span>
              <span>Requested Check-In</span>
              <span>Requested Check-Out</span>
              <span>Reason</span>
              <span>Status</span>
              <span>Actions / Note</span>
            </div>

            {!correctionsLoading &&
              filteredCorrections.map((c) => {
                const cId = c.id || c._id || "";
                const empName = c.employee?.display_name || c.employee?.name || "Employee";
                const empCode = c.employee?.employee_code || "";
                const dept = c.employee?.department || "";
                const rawDate = c.attendanceRecord?.attendanceDate || c.attendanceRecord?.attendance_date || "";
                const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
                const isPending = c.status === "Pending";
                const reqIn = c.requestedCheckIn || c.requested_check_in || "No change";
                const reqOut = c.requestedCheckOut || c.requested_check_out || "No change";

                return (
                  <div className="table-row" key={cId} style={{ background: isPending ? "rgba(245, 158, 11, 0.04)" : "transparent" }}>
                    <div className="person-cell">
                      <Avatar name={empName} avatar={(c as any).employee_avatar || (c as any).avatar || (c.attendanceRecord as any)?.employee_avatar} />
                      <div>
                        <b>{empName}</b>
                        <span>{empCode} {dept ? `• ${dept}` : ""}</span>
                      </div>
                    </div>

                    <b>{formattedDate}</b>

                    <div className="time-value">
                      <b style={{ color: "#059669" }}>{displayTime(reqIn)}</b>
                      <small style={{ color: "var(--muted)" }}>Current: {displayTime(c.attendanceRecord?.checkInTime || c.attendanceRecord?.check_in_time)}</small>
                    </div>

                    <div className="time-value">
                      <b style={{ color: "#059669" }}>{displayTime(reqOut)}</b>
                      <small style={{ color: "var(--muted)" }}>Current: {displayTime(c.attendanceRecord?.checkOutTime || c.attendanceRecord?.check_out_time)}</small>
                    </div>

                    <span style={{ fontSize: "11.5px", color: "var(--text)", maxWidth: "180px", wordBreak: "break-word" }} title={c.reason || ""}>
                      {c.reason || "N/A"}
                    </span>

                    <Badge tone={c.status === "Approved" ? "success" : c.status === "Rejected" ? "danger" : "warning"}>
                      {c.status}
                    </Badge>

                    <div>
                      {isPending ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            disabled={actionLoadingId === cId}
                            onClick={() => handleUpdateCorrectionStatus(cId, "Approved")}
                            style={{
                              background: "#10b981",
                              color: "#ffffff",
                              border: "none",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === cId}
                            onClick={() => handleUpdateCorrectionStatus(cId, "Rejected")}
                            style={{
                              background: "#ef4444",
                              color: "#ffffff",
                              border: "none",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <X size={13} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {c.adminNote || c.admin_note ? `Note: ${c.adminNote || c.admin_note}` : `Reviewed as ${c.status}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {correctionsLoading && <EmptyState title="Loading requests" text="Fetching attendance correction requests." />}
        {!correctionsLoading && !filteredCorrections.length && (
          <EmptyState title="No correction requests" text={`No ${correctionFilter.toLowerCase()} attendance correction requests found.`} />
        )}
      </Section>

      {/* TODAY'S ATTENDANCE REGISTER */}
      <Section title="Today's register" kicker="LIVE / ATTENDANCE" action={<div className="table-filters"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Present</option><option>Late</option><option>Early Exit</option><option>Absent</option></select></div>}>
        <div className="table-responsive-wrapper" style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "8px" }}>
          <div className="data-table attendance-table" style={{ minWidth: "750px" }}>
            <div className="table-head">
              <span>Employee</span>
              <span>Check in</span>
              <span>Check out</span>
              <span>Working hours</span>
              <span>Arrival</span>
              <span>Daily status</span>
              <span>Verification</span>
            </div>
            {!recordsLoading && !recordsError && rows.map(r => (
              <div className="table-row" key={r.id}>
                <div className="person-cell">
                  <Avatar name={r.employee_name} avatar={(r as any).employee_avatar || (r as any).avatar} />
                  <div>
                    <b>{r.employee_name}</b>
                    <span>{r.employee_code} - {r.department}</span>
                  </div>
                </div>
                <div className="time-value">
                  <b>{displayTime(r.check_in_time)}</b>
                  {r.is_late && <small className="red">Late Arrival ({r.late_minutes}m)</small>}
                </div>
                <div className="time-value">
                  <b>{displayTime(r.check_out_time)}</b>
                  {r.is_early_exit && <small className="red">Early Exit ({r.early_exit_minutes}m)</small>}
                </div>
                <b>{Number(r.working_hours).toFixed(2)}h</b>
                <Badge tone={statusTone(r)}>{r.check_in_status || (r.is_late ? "Late" : "On Time")}</Badge>
                <span className="daily-status" style={{ color: r.attendance_status === "Half Day" || r.is_late ? "var(--goldD)" : "inherit", fontWeight: r.attendance_status === "Half Day" || r.is_late ? 700 : 400 }}>{r.attendance_status || (r.is_late ? "Present (Late)" : "Present")}</span>
                <button type="button" onClick={() => setSelectedRecord(r)} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}>
                  <span className={`verification ${r.location_verified ? "verified" : ""}`}>
                    <MapPin size={13} />
                    {r.location_verified ? "Verified (Details)" : "No record"}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
        {recordsLoading && <EmptyState title="Loading attendance" text="Fetching attendance records." />}
        {recordsError && <EmptyState title="Could not load attendance" text={recordsError} />}
        {!recordsLoading && !recordsError && !rows.length && <EmptyState title="No attendance records" text="No records match the selected filters." />}
      </Section>

      {selectedRecord && (
        <AttendanceDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </>
  );
}
