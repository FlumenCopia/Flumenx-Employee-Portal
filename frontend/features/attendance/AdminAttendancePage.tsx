"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, FileBarChart, MapPin, TimerOff, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { AttendanceRecord, Paginated } from "@/lib/types";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, Section, StatCard } from "@/components/ui";
import { defaultSummary, displayTime, statusTone } from "./helpers";
import { AttendanceSummary } from "./types";
import { AttendanceDetailModal } from "./AttendanceDetailModal";

export function AdminAttendancePage() {
  const [filter, setFilter] = useState("All");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>(defaultSummary);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const rows = useMemo(() => records.filter(r => filter === "All" || (filter === "Late" ? r.is_late : filter === "Early Exit" ? r.is_early_exit : r.attendance_status === filter)), [records, filter]);

  useEffect(() => {
    const controller = new AbortController();
    setRecordsLoading(true);
    setRecordsError("");

    api<Paginated<AttendanceRecord>>(`/attendance/?date=${date}`, { signal: controller.signal })
      .then(data => setRecords(data.results))
      .catch(err => {
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
      .catch(err => {
        if (err instanceof Error && err.name === "AbortError") return;
        setSummary(defaultSummary);
        setSummaryError(err instanceof Error ? err.message : "Could not load attendance summary.");
      })
      .finally(() => setSummaryLoading(false));

    return () => controller.abort();
  }, [date]);

  const summaryUnavailable = summaryLoading || Boolean(summaryError);

  return (
    <>
      <PageHeader
        eyebrow="PEOPLE / ATTENDANCE CONTROL"
        title="Attendance."
        subtitle="Today's workforce rhythm and live attendance register across all departments."
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
      
      <div style={{ background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: "12px", padding: "14px 18px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(203,168,110,0.15)", border: "1px solid rgba(203,168,110,0.3)", color: "var(--goldD)", display: "grid", placeItems: "center", flexShrink: 0 }}>
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

      <Section title="Today's register" kicker="LIVE / ATTENDANCE" action={<div className="table-filters"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Present</option><option>Late</option><option>Early Exit</option><option>Absent</option></select></div>}>
        <div className="data-table attendance-table">
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
                <Avatar name={r.employee_name} />
                <div>
                  <b>{r.employee_name}</b>
                  <span>{r.employee_code} - {r.department}</span>
                </div>
              </div>
              <div className="time-value">
                <b>{displayTime(r.check_in_time)}</b>
                {r.is_late && <small>Late Arrival</small>}
              </div>
              <div className="time-value">
                <b>{displayTime(r.check_out_time)}</b>
                {r.is_early_exit && <small className="red">Early Exit</small>}
              </div>
              <b>{Number(r.working_hours).toFixed(2)}h</b>
              <Badge tone={statusTone(r)}>{r.is_late ? "Late (Half Day)" : (r.check_in_status || "No check-in")}</Badge>
              <span className="daily-status" style={{ color: r.is_late || r.attendance_status === "Half Day" ? "var(--goldD)" : "inherit", fontWeight: r.is_late || r.attendance_status === "Half Day" ? 700 : 400 }}>{r.is_late ? "Half Day (Late)" : r.attendance_status}</span>
              <button type="button" onClick={() => setSelectedRecord(r)} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", textAlign: "left" }}>
                <span className={`verification ${r.location_verified ? "verified" : ""}`}>
                  <MapPin size={13} />
                  {r.location_verified ? "Verified (Details)" : "No record"}
                </span>
              </button>
            </div>
          ))}
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
