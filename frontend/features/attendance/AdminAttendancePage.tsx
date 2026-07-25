"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, FileBarChart, MapPin, TimerOff, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { AttendanceRecord, Paginated } from "@/lib/types";
import { Avatar } from "@/components/icons";
import { Badge, EmptyState, PageHeader, Section, StatCard } from "@/components/ui";
import { AttendanceChart } from "./AttendanceChart";
import { defaultSummary, displayTime, statusTone } from "./helpers";
import { AttendanceSummary, MonthlyStatistics } from "./types";

export function AdminAttendancePage() {
  const [filter, setFilter] = useState("All"); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const month = useMemo(() => date.slice(0, 7), [date]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>(defaultSummary);
  const [monthly, setMonthly] = useState<MonthlyStatistics | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [monthlyError, setMonthlyError] = useState("");
  const rows = useMemo(() => records.filter(r => filter === "All" || (filter === "Late" ? r.is_late : filter === "Early Exit" ? r.is_early_exit : r.attendance_status === filter)), [records, filter]);

  useEffect(() => {
    const controller = new AbortController();
    setRecordsLoading(true);
    setRecordsError("");
    api<Paginated<AttendanceRecord>>(`/attendance/?date=${date}`, { signal: controller.signal })
      .then(data => setRecords(data.results))
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setRecords([]);
        setRecordsError(err instanceof Error ? err.message : "Could not load attendance records.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecordsLoading(false);
      });

    setSummaryLoading(true);
    setSummaryError("");
    api<AttendanceSummary>(`/attendance/summary/?date=${date}`, { signal: controller.signal })
      .then(setSummary)
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSummary(defaultSummary);
        setSummaryError(err instanceof Error ? err.message : "Could not load attendance summary.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSummaryLoading(false);
      });
    return () => controller.abort();
  }, [date]);

  useEffect(() => {
    const controller = new AbortController();
    setMonthlyLoading(true);
    setMonthlyError("");
    api<MonthlyStatistics>(`/attendance/monthly-statistics/?month=${month}`, { signal: controller.signal })
      .then(setMonthly)
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setMonthly(null);
        setMonthlyError(err instanceof Error ? err.message : "Could not load monthly statistics.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMonthlyLoading(false);
      });
    return () => controller.abort();
  }, [month]);

  const summaryUnavailable = summaryLoading || Boolean(summaryError);

  return <>
    <PageHeader eyebrow="PEOPLE / ATTENDANCE CONTROL" title="Attendance." subtitle="Today's workforce rhythm and live attendance register." action={<div className="header-actions"><Link className="secondary-button" href="/admin/attendance/reports"><FileBarChart size={17}/> Reports</Link></div>} />
    {summaryError && <EmptyState title="Could not load attendance summary" text={summaryError} />}
    <div className="stats-grid attendance-stats">
      <StatCard label="Present today" value={summaryUnavailable ? "Not available" : String(summary.present).padStart(2, "0")} note={summaryUnavailable ? "Summary unavailable" : `${summary.attendance_percentage}% of active team`} icon={<CheckCircle2 />} />
      <StatCard label="Late arrivals" value={summaryUnavailable ? "Not available" : String(summary.late).padStart(2, "0")} note="Calculated from office time" icon={<Clock3 />} accent />
      <StatCard label="Early exits" value={summaryUnavailable ? "Not available" : String(summary.early_exits).padStart(2, "0")} note="Before office end time" icon={<TimerOff />} />
      <StatCard label="Absent today" value={summaryUnavailable ? "Not available" : String(summary.absent).padStart(2, "0")} note={summaryUnavailable ? "Summary unavailable" : `${summary.leave} on leave`} icon={<UserX />} />
    </div>
    <Section title="Today's register" kicker="LIVE / ATTENDANCE" action={<div className="table-filters"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Present</option><option>Late</option><option>Early Exit</option><option>Absent</option></select></div>}>
      <div className="data-table attendance-table"><div className="table-head"><span>Employee</span><span>Check in</span><span>Check out</span><span>Working hours</span><span>Arrival</span><span>Daily status</span><span>Verification</span></div>
      {!recordsLoading && !recordsError && rows.map(r=><div className="table-row" key={r.id}><div className="person-cell"><Avatar name={r.employee_name}/><div><b>{r.employee_name}</b><span>{r.employee_code} - {r.department}</span></div></div><div className="time-value"><b>{displayTime(r.check_in_time)}</b>{r.is_late&&<small>+{r.late_minutes} min</small>}</div><div className="time-value"><b>{displayTime(r.check_out_time)}</b>{r.is_early_exit&&<small className="red">-{r.early_exit_minutes} min</small>}</div><b>{Number(r.working_hours).toFixed(2)}h</b><Badge tone={statusTone(r)}>{r.check_in_status || "No check-in"}</Badge><span className="daily-status">{r.attendance_status}</span><span className={`verification ${r.location_verified?"verified":""}`}><MapPin size={13}/>{r.location_verified?"Location verified":"No record"}</span></div>)}</div>
      {recordsLoading && <EmptyState title="Loading attendance" text="Fetching attendance records." />}
      {recordsError && <EmptyState title="Could not load attendance" text={recordsError} />}
      {!recordsLoading && !recordsError && !rows.length && <EmptyState title="No attendance records" text="No records match the selected filters." />}
    </Section>
    <Section title="Monthly attendance" kicker={`${month.toUpperCase()} / DAILY TREND`} action={<Link href="/admin/attendance/reports">Open full report</Link>}>
      {monthlyLoading && <EmptyState title="Loading trend" text="Fetching monthly statistics." />}
      {monthlyError && <EmptyState title="Could not load trend" text={monthlyError} />}
      {!monthlyLoading && !monthlyError && <AttendanceChart days={monthly?.days} />}
    </Section>
  </>;
}
