"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Building2, CalendarCheck, CheckCircle2, Clock3, LogIn, ShieldCheck, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { AttendanceRecord, Paginated } from "@/lib/types";
import { Badge, EmptyState, PageHeader, PrimaryButton, Section, StatCard } from "@/components/ui";
import { AttendanceChart } from "./AttendanceChart";
import { defaultSummary, displayTime, statusTone } from "./helpers";
import { AttendanceSummary, MonthlyStatistics } from "./types";

export function EmployeeAttendancePage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const [record, setRecord] = useState<AttendanceRecord | null>(null); const [message,setMessage]=useState(""); const [correction,setCorrection]=useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>(defaultSummary);
  const [monthly, setMonthly] = useState<MonthlyStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [monthlyError, setMonthlyError] = useState("");
  const [recordsError, setRecordsError] = useState("");
  const loadRequestRef = useRef(0);
  const aggregateRequestRef = useRef(0);

  const applyAttendanceRecord = useCallback((updated: AttendanceRecord) => {
    setRecord(updated.attendance_date === today ? updated : null);
    setRecords(current => {
      const exists = current.some(item => item.id === updated.id || item.attendance_date === updated.attendance_date);
      const next = exists
        ? current.map(item => item.id === updated.id || item.attendance_date === updated.attendance_date ? updated : item)
        : [updated, ...current];
      return next.sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
    });
  }, [today]);

  const refreshAggregates = useCallback(async () => {
    const requestId = ++aggregateRequestRef.current;
    setRefreshError("");
    const [summaryResult, monthlyResult] = await Promise.allSettled([
      api<AttendanceSummary>(`/attendance/summary/?month=${currentMonth}`),
      api<MonthlyStatistics>(`/attendance/monthly-statistics/?month=${currentMonth}`),
    ]);
    if (requestId !== aggregateRequestRef.current) return;

    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value);
      setSummaryError("");
    } else {
      setSummaryError(summaryResult.reason instanceof Error ? summaryResult.reason.message : "Could not refresh attendance summary.");
    }

    if (monthlyResult.status === "fulfilled") {
      setMonthly(monthlyResult.value);
      setMonthlyError("");
    } else {
      setMonthlyError(monthlyResult.reason instanceof Error ? monthlyResult.reason.message : "Could not refresh monthly statistics.");
    }

    if (summaryResult.status === "rejected" || monthlyResult.status === "rejected") {
      setRefreshError("Office entry was recorded, but some attendance totals could not refresh.");
    }
  }, [currentMonth]);

  const loadAttendance = useCallback(() => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setRecordsError("");
    setSummaryError("");
    setMonthlyError("");
    setRefreshError("");

    api<Paginated<AttendanceRecord>>(`/attendance/?month=${currentMonth}`)
      .then(data => {
        if (requestId !== loadRequestRef.current) return;
        setRecords(data.results);
        setRecord(data.results.find(item => item.attendance_date === today) || null);
      })
      .catch(err => {
        if (requestId !== loadRequestRef.current) return;
        setRecords([]);
        setRecord(null);
        setRecordsError(err instanceof Error ? err.message : "Could not load attendance records.");
      })
      .finally(() => {
        if (requestId === loadRequestRef.current) setLoading(false);
      });

    api<AttendanceSummary>(`/attendance/summary/?month=${currentMonth}`)
      .then(value => {
        if (requestId !== loadRequestRef.current) return;
        setSummary(value);
      })
      .catch(err => {
        if (requestId !== loadRequestRef.current) return;
        setSummary(defaultSummary);
        setSummaryError(err instanceof Error ? err.message : "Could not load attendance summary.");
      });

    api<MonthlyStatistics>(`/attendance/monthly-statistics/?month=${currentMonth}`)
      .then(value => {
        if (requestId !== loadRequestRef.current) return;
        setMonthly(value);
      })
      .catch(err => {
        if (requestId !== loadRequestRef.current) return;
        setMonthly(null);
        setMonthlyError(err instanceof Error ? err.message : "Could not load monthly statistics.");
      });
  }, [currentMonth, today]);

  useEffect(()=>{
    loadAttendance();
    return () => {
      loadRequestRef.current += 1;
      aggregateRequestRef.current += 1;
    };
  },[loadAttendance]);

  async function enterOffice(){
    if (actionPending) return;
    setActionPending(true);
    setMessage("");
    setRefreshError("");
    try{
      const updated=await api<AttendanceRecord>("/attendance/check-in/",{method:"POST",body:JSON.stringify({})});
      applyAttendanceRecord(updated);
      setMessage("Office entry recorded.");
      refreshAggregates();
    }
    catch(e){setMessage(e instanceof Error?e.message:"Attendance action could not be completed.");}
    finally{setActionPending(false);}
  }

  return <>
    <PageHeader eyebrow="MY WORKSPACE / ATTENDANCE" title="Your attendance." subtitle="A transparent view of your time, status, and monthly rhythm." action={<button className="secondary-button" disabled={!record} onClick={()=>setCorrection(true)}>Request correction</button>} />
    {message&&<div className="toast success"><CheckCircle2 size={18}/>{message}</div>}
    {refreshError&&<div className="toast error">{refreshError}</div>}
    {recordsError && <EmptyState title="Could not load attendance" text={recordsError} />}
    <div className="attendance-hero">
      <div className="clock-panel"><span>TODAY - {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long"}).toUpperCase()}</span><strong>{new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</strong><p><Building2 size={14}/> Enter the office to mark today's attendance</p><div className="clock-actions"><button onClick={enterOffice} disabled={actionPending}>{actionPending ? <Clock3 size={18}/> : <LogIn size={18}/>} {actionPending ? "Recording..." : "Enter the office"}</button></div></div>
      <div className="today-record"><div className="record-head"><span>TODAY'S RECORD</span>{record ? <Badge tone={statusTone(record)}>{record.attendance_status}</Badge> : <Badge>No attendance recorded</Badge>}</div>{record ? <div className="record-times"><div><LogIn/><span>OFFICE ENTRY</span><b>{displayTime(record.check_in_time)}</b><small>{record.check_in_status || "Not recorded"}</small></div><div><Clock3/><span>STATUS</span><b>{record.attendance_status}</b><small>Office entry only</small></div></div> : <EmptyState title="No attendance recorded today" text="No office entry record exists for today." />}</div>
    </div>
    {summaryError && <EmptyState title="Could not load summary" text={summaryError} />}
    <div className="stats-grid">
      <StatCard label="Present days" value={summaryError ? "Not available" : String(summary.present)} note={summaryError ? "Summary unavailable" : `${summary.half_days} half days`} icon={<CalendarCheck/>}/>
      <StatCard label="Late this month" value={summaryError ? "Not available" : String(summary.late)} note="Calculated from your check-ins" icon={<TriangleAlert/>} accent/>
      <StatCard label="Attendance rate" value={summaryError ? "Not available" : `${summary.attendance_percentage}%`} note="Month to date" icon={<ShieldCheck/>}/>
    </div>
    <div className="dashboard-grid"><Section title="Monthly rhythm" kicker={`${currentMonth.toUpperCase()} / ATTENDANCE`}>{monthlyError && <EmptyState title="Could not load trend" text={monthlyError} />}{!monthlyError && <AttendanceChart employee days={monthly?.days}/>}</Section></div>
    <Section title="Attendance history" kicker="RECENT / RECORDS"><div className="data-table employee-attendance-table"><div className="table-head"><span>Date</span><span>Office entry</span><span>Status</span></div>{!loading && !recordsError && records.slice(0,7).map(r=><div className="table-row" key={r.id}><b>{new Date(r.attendance_date).toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short"})}</b><span>{displayTime(r.check_in_time)}</span><Badge tone={statusTone(r)}>{r.attendance_status}</Badge></div>)}</div>{loading && <EmptyState title="Loading attendance history" text="Fetching attendance records." />}{!loading && !recordsError && !records.length && <EmptyState title="No attendance history" text="No attendance records are available." />}</Section>
    {correction&&record&&<div className="modal-backdrop" onMouseDown={()=>setCorrection(false)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span>ATTENDANCE / CORRECTION</span><h2>Correct today's record</h2></div><button onClick={()=>setCorrection(false)}>x</button></div><form className="modal-form" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{await api("/attendance-corrections/",{method:"POST",body:JSON.stringify({attendance_record:record.id,requested_check_in:data.get("check_in")||null,reason:data.get("reason")})});setMessage("Correction request sent to your administrator.");setCorrection(false);}catch(err){setMessage(err instanceof Error?err.message:"Could not submit correction.");}}}><label>Requested office entry<input name="check_in" type="time"/></label><label>Reason<textarea name="reason" required placeholder="Explain what needs to be corrected"/></label><PrimaryButton type="submit">Send request</PrimaryButton></form></div></div>}
  </>;
}
