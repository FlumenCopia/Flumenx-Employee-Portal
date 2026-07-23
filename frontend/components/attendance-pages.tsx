"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, Clock3, Download, FileBarChart, LogIn, LogOut, MapPin, Save, Settings2, ShieldCheck, TimerOff, TriangleAlert, UserX } from "lucide-react";
import { api, apiBlob } from "@/lib/api";
import { attendanceRecords, monthlyAttendance } from "@/lib/demo-data";
import { AttendanceRecord } from "@/lib/types";
import { Avatar } from "./icons";
import { Badge, PageHeader, PrimaryButton, Section, StatCard } from "./ui";

const statusTone = (record: AttendanceRecord) => record.is_early_exit ? "early-exit" : record.check_in_status === "Late" ? "late" : record.check_in_status === "Grace Period" ? "grace" : record.attendance_status === "Absent" ? "absent" : "on-time";
const displayTime = (value: string | null) => value ? new Date(`2026-01-01T${value}`).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "â€”";

type AttendanceSummary = {
  present: number; late: number; early_exits: number; absent: number;
  half_days: number; leave: number; attendance_percentage: number;
};
type MonthlyStatistics = {
  month: string;
  summary: AttendanceSummary;
  days: Array<{ day: number } & AttendanceSummary>;
};
type AttendancePolicy = {
  office_start_time: string; grace_period_minutes: number; office_end_time: string;
  half_day_hours: string; full_day_hours: string;
};

const defaultSummary: AttendanceSummary = {
  present: 0, late: 0, early_exits: 0, absent: 0, half_days: 0, leave: 0, attendance_percentage: 0,
};

export function AdminAttendancePage() {
  const [filter, setFilter] = useState("All"); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState(attendanceRecords);
  const [summary, setSummary] = useState<AttendanceSummary>(defaultSummary);
  const [monthly, setMonthly] = useState<MonthlyStatistics | null>(null);
  const rows = useMemo(() => records.filter(r => filter === "All" || (filter === "Late" ? r.is_late : filter === "Early Exit" ? r.is_early_exit : r.attendance_status === filter)), [records, filter]);
  useEffect(() => {
    api<{results: AttendanceRecord[]}>(`/attendance/?date=${date}`).then(data => setRecords(data.results)).catch(()=>{});
    api<AttendanceSummary>(`/attendance/summary/?date=${date}`).then(setSummary).catch(()=>{});
  }, [date]);
  useEffect(() => {
    api<MonthlyStatistics>(`/attendance/monthly-statistics/?month=${date.slice(0, 7)}`).then(setMonthly).catch(()=>{});
  }, [date]);
  return <>
    <PageHeader eyebrow="PEOPLE / ATTENDANCE CONTROL" title="Attendance." subtitle="Todayâ€™s workforce rhythm, calculated against the active shift policy." action={<div className="header-actions"><Link className="secondary-button" href="/admin/attendance/reports"><FileBarChart size={17}/> Reports</Link><Link className="primary-button" href="/admin/attendance/settings">Shift settings <Settings2 size={17}/></Link></div>} />
    <div className="stats-grid attendance-stats">
      <StatCard label="Present today" value={String(summary.present).padStart(2, "0")} note={`${summary.attendance_percentage}% of active team`} icon={<CheckCircle2 />} />
      <StatCard label="Late arrivals" value={String(summary.late).padStart(2, "0")} note="Calculated from shift policy" icon={<Clock3 />} accent />
      <StatCard label="Early exits" value={String(summary.early_exits).padStart(2, "0")} note="Before office end time" icon={<TimerOff />} />
      <StatCard label="Absent today" value={String(summary.absent).padStart(2, "0")} note={`${summary.leave} on leave`} icon={<UserX />} />
    </div>
    <div className="attendance-policy-strip"><div><ShieldCheck/><span>ACTIVE SHIFT</span><b>09:30 AM â€” 06:30 PM</b></div><div><span>GRACE WINDOW</span><b>Until 09:35 AM</b></div><div><span>ATTENDANCE RATE</span><b>{summary.attendance_percentage}%</b></div><Link href="/admin/attendance/settings">Modify policy</Link></div>
    <Section title="Todayâ€™s register" kicker="LIVE / QR + LOCATION" action={<div className="table-filters"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Present</option><option>Late</option><option>Early Exit</option><option>Absent</option></select></div>}>
      <div className="data-table attendance-table"><div className="table-head"><span>Employee</span><span>Check in</span><span>Check out</span><span>Working hours</span><span>Arrival</span><span>Daily status</span><span>Verification</span></div>
      {rows.map(r=><div className="table-row" key={r.id}><div className="person-cell"><Avatar name={r.employee_name}/><div><b>{r.employee_name}</b><span>{r.employee_code} Â· {r.department}</span></div></div><div className="time-value"><b>{displayTime(r.check_in_time)}</b>{r.is_late&&<small>+{r.late_minutes} min</small>}</div><div className="time-value"><b>{displayTime(r.check_out_time)}</b>{r.is_early_exit&&<small className="red">-{r.early_exit_minutes} min</small>}</div><b>{Number(r.working_hours).toFixed(2)}h</b><Badge tone={statusTone(r)}>{r.check_in_status || "No check-in"}</Badge><span className="daily-status">{r.attendance_status}</span><span className={`verification ${r.location_verified?"verified":""}`}><MapPin size={13}/>{r.location_verified?"Location verified":"No record"}</span></div>)}</div>
    </Section>
    <Section title="Monthly attendance" kicker={`${date.slice(0, 7).toUpperCase()} / DAILY TREND`} action={<Link href="/admin/attendance/reports">Open full report</Link>}><AttendanceChart days={monthly?.days} /></Section>
  </>;
}

export function EmployeeAttendancePage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [record, setRecord] = useState<AttendanceRecord>(attendanceRecords[0]); const [message,setMessage]=useState(""); const [correction,setCorrection]=useState(false);
  const [records, setRecords] = useState(attendanceRecords);
  const [summary, setSummary] = useState<AttendanceSummary>(defaultSummary);
  const [monthly, setMonthly] = useState<MonthlyStatistics | null>(null);
  const loadAttendance = () => {
    api<{results: AttendanceRecord[]}>(`/attendance/?month=${currentMonth}`).then(data => {
      setRecords(data.results);
      const today = new Date().toISOString().slice(0, 10);
      setRecord(data.results.find(item => item.attendance_date === today) || data.results[0] || attendanceRecords[0]);
    }).catch(()=>{});
    api<AttendanceSummary>(`/attendance/summary/?month=${currentMonth}`).then(setSummary).catch(()=>{});
    api<MonthlyStatistics>(`/attendance/monthly-statistics/?month=${currentMonth}`).then(setMonthly).catch(()=>{});
  };
  useEffect(()=>{loadAttendance()},[]);
  async function action(kind:"check-in"|"check-out"){
    try{
      let location = { latitude: 12.971599, longitude: 77.594566 };
      if(kind==="check-in" && navigator.geolocation){
        const position = await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000}));
        location={latitude:position.coords.latitude,longitude:position.coords.longitude};
      }
      const updated=await api<AttendanceRecord>(`/attendance/${kind}/`,{method:"POST",body:JSON.stringify({source:"QR + Location",qr_reference:"FLUMENX-HQ-DEMO",...location})});
      setRecord(updated);loadAttendance();setMessage(kind==="check-in"?"Check-in recorded. Your QR and office location were verified.":"Checkout recorded. Working hours are now final.");
    }
    catch(e){setMessage(e instanceof Error?e.message:"Attendance action could not be completed.");}
  }
  return <>
    <PageHeader eyebrow="MY WORKSPACE / ATTENDANCE" title="Your attendance." subtitle="A transparent view of your time, status, and monthly rhythm." action={<button className="secondary-button" onClick={()=>setCorrection(true)}>Request correction</button>} />
    {message&&<div className="toast success"><CheckCircle2 size={18}/>{message}</div>}
    <div className="attendance-hero">
      <div className="clock-panel"><span>TODAY Â· {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long"}).toUpperCase()}</span><strong>{new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</strong><p><MapPin size={14}/> FLUMENX HQ Â· Location verified</p><div className="clock-actions"><button onClick={()=>action("check-in")}><LogIn size={18}/> Check in</button><button onClick={()=>action("check-out")}><LogOut size={18}/> Check out</button></div></div>
      <div className="today-record"><div className="record-head"><span>TODAYâ€™S RECORD</span><Badge tone={statusTone(record)}>{record.attendance_status}</Badge></div><div className="record-times"><div><LogIn/><span>CHECK IN</span><b>{displayTime(record.check_in_time)}</b><small>{record.check_in_status}</small></div><div><LogOut/><span>CHECK OUT</span><b>{displayTime(record.check_out_time)}</b><small>{record.is_early_exit?`${record.early_exit_minutes} min early`:"Normal checkout"}</small></div><div><Clock3/><span>WORKED</span><b>{record.working_hours}h</b><small>Shift target Â· 8h</small></div></div></div>
    </div>
    <div className="stats-grid">
      <StatCard label="Present days" value={String(summary.present)} note={`${summary.half_days} half days`} icon={<CalendarCheck/>}/>
      <StatCard label="Late this month" value={String(summary.late)} note="Calculated from your check-ins" icon={<TriangleAlert/>} accent/>
      <StatCard label="Early exits" value={String(summary.early_exits)} note="Before office end time" icon={<TimerOff/>}/>
      <StatCard label="Attendance rate" value={`${summary.attendance_percentage}%`} note="Month to date" icon={<ShieldCheck/>}/>
    </div>
    <div className="dashboard-grid"><Section title="Monthly rhythm" kicker={`${currentMonth.toUpperCase()} / ATTENDANCE`}><AttendanceChart employee days={monthly?.days}/></Section><Section title="Shift policy" kicker="YOUR WORKING HOURS"><div className="policy-timeline"><div><span>09:30</span><b>Office starts</b></div><i/><div><span>09:35</span><b>Grace ends</b></div><i/><div><span>18:30</span><b>Normal checkout</b></div></div></Section></div>
    <Section title="Attendance history" kicker="RECENT / RECORDS"><div className="data-table employee-attendance-table"><div className="table-head"><span>Date</span><span>Check in</span><span>Check out</span><span>Hours</span><span>Status</span></div>{records.slice(0,7).map(r=><div className="table-row" key={r.id}><b>{new Date(r.attendance_date).toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short"})}</b><span>{displayTime(r.check_in_time)}</span><span>{displayTime(r.check_out_time)}</span><span>{r.working_hours}h</span><Badge tone={statusTone(r)}>{r.attendance_status}</Badge></div>)}</div></Section>
    {correction&&<div className="modal-backdrop" onMouseDown={()=>setCorrection(false)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span>ATTENDANCE / CORRECTION</span><h2>Correct today’s record</h2></div><button onClick={()=>setCorrection(false)}>×</button></div><form className="modal-form" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{await api("/attendance-corrections/",{method:"POST",body:JSON.stringify({attendance_record:record.id,requested_check_in:data.get("check_in")||null,requested_check_out:data.get("check_out")||null,reason:data.get("reason")})});setMessage("Correction request sent to your administrator.");setCorrection(false);}catch(err){setMessage(err instanceof Error?err.message:"Could not submit correction.");}}}><div className="two-col"><label>Requested check-in<input name="check_in" type="time"/></label><label>Requested checkout<input name="check_out" type="time"/></label></div><label>Reason<textarea name="reason" required placeholder="Explain what needs to be corrected"/></label><PrimaryButton type="submit">Send request</PrimaryButton></form></div></div>}
  </>;
}

export function AttendanceSettingsPage(){
  const [saved,setSaved]=useState(false);
  const [policy,setPolicy]=useState<AttendancePolicy | null>(null);
  useEffect(()=>{api<AttendancePolicy>("/attendance-policy/").then(setPolicy).catch(()=>{})},[]);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);try{await api("/attendance-policy/1/",{method:"PUT",body:JSON.stringify({office_start_time:data.get("start"),grace_period_minutes:Number(data.get("grace")),office_end_time:data.get("end"),half_day_hours:Number(data.get("half_day")),full_day_hours:Number(data.get("full_day"))})});}catch{}setSaved(true);}
  return <><PageHeader eyebrow="ADMIN / ATTENDANCE POLICY" title="Shift settings." subtitle="Define the working-day boundaries used by every automatic attendance calculation."/>
  {saved&&<div className="toast success"><CheckCircle2 size={18}/>Attendance policy saved. Future check-ins and checkouts will use these rules.</div>}
  <form className="policy-editor" onSubmit={submit} key={policy?.office_start_time || "policy"}><div className="policy-editor-head"><div><ShieldCheck/><span>ACTIVE POLICY</span><h2>FLUMENX Standard Office Shift</h2></div><Badge tone="on-time">Active</Badge></div><div className="policy-fields"><label>Office start time<input name="start" type="time" defaultValue={(policy?.office_start_time || "09:30").slice(0,5)} required/><small>Arrivals before this are on time.</small></label><label>Grace period<input name="grace" type="number" min="0" max="60" defaultValue={policy?.grace_period_minutes || 5} required/><small>Minutes allowed after official start.</small></label><label>Office end time<input name="end" type="time" defaultValue={(policy?.office_end_time || "18:30").slice(0,5)} required/><small>Checkout before this is an early exit.</small></label><label>Half-day threshold<input name="half_day" type="number" step=".5" defaultValue={policy?.half_day_hours || "4"} required/><small>Worked hours below this become half day.</small></label><label>Full-day target<input name="full_day" type="number" step=".5" defaultValue={policy?.full_day_hours || "8"} required/><small>Used for monthly working-hour reporting.</small></label></div><div className="rule-preview"><span>LIVE RULE PREVIEW</span><div><b>09:20</b><Badge tone="on-time">On Time</Badge></div><div><b>09:31</b><Badge tone="grace">Grace Period</Badge></div><div><b>09:36</b><Badge tone="late">Late Â· 1 min</Badge></div><div><b>18:00</b><Badge tone="early-exit">Early Exit Â· 30 min</Badge></div><div><b>18:30</b><Badge tone="on-time">Normal Checkout</Badge></div></div><div className="form-actions"><Link href="/admin/attendance">Cancel</Link><PrimaryButton type="submit">Save policy</PrimaryButton></div></form></>;
}

export function AttendanceReportsPage(){
  const [report,setReport]=useState("Monthly Attendance"); const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const [monthly, setMonthly] = useState<MonthlyStatistics | null>(null);
  useEffect(()=>{api<MonthlyStatistics>(`/attendance/monthly-statistics/?month=${month}`).then(setMonthly).catch(()=>{})},[month]);
  async function download(){
    const blob = await apiBlob(`/attendance/export/?month=${month}`);
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`flumenx-${report.toLowerCase().replaceAll(" ","-")}-${month}.csv`;a.click();URL.revokeObjectURL(url);
  }
  const reportSummary = monthly?.summary || defaultSummary;
  return <><PageHeader eyebrow="ATTENDANCE / REPORTING" title="Attendance reports." subtitle="Operational records ready for review, payroll, and workforce planning." action={<PrimaryButton onClick={download}>Export CSV</PrimaryButton>}/><div className="report-controls"><div>{["Daily Attendance","Monthly Attendance","Late Arrival","Early Exit","Employee History"].map(x=><button key={x} className={report===x?"active":""} onClick={()=>setReport(x)}>{x}</button>)}</div><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div><div className="stats-grid"><StatCard label="Attendance rate" value={`${reportSummary.attendance_percentage}%`} note="Month to date" icon={<ShieldCheck/>}/><StatCard label="Late arrivals" value={String(reportSummary.late)} note="Across filtered records" icon={<Clock3/>} accent/><StatCard label="Early exits" value={String(reportSummary.early_exits)} note="Across filtered records" icon={<TimerOff/>}/><StatCard label="Present records" value={String(reportSummary.present)} note={`${reportSummary.absent} absent`} icon={<CalendarCheck/>}/></div><Section title={report} kicker={`${month} / GENERATED VIEW`}><AttendanceChart days={monthly?.days}/><div className="report-summary-grid"><div><span>PRESENT</span><b>{reportSummary.present}</b><small>Records in selected month</small></div><div><span>LATE ARRIVALS</span><b>{reportSummary.late}</b><small>Based on grace policy</small></div><div><span>EARLY EXITS</span><b>{reportSummary.early_exits}</b><small>Before office end time</small></div></div></Section></>;
}

function AttendanceChart({employee=false, days}:{employee?:boolean; days?: Array<{ day: number } & AttendanceSummary>}){
  const max=employee?1:150;
  const chartDays = days?.length ? days : monthlyAttendance.map(d => ({
    day: d.day, present: d.present, late: d.late, early_exits: d.early,
    absent: d.absent, half_days: 0, leave: 0, attendance_percentage: 0,
  }));
  return <div className="attendance-chart"><div className="chart-bars">{chartDays.map(d=><div key={d.day} className="bar-day"><div className="bar-stack">{employee?<><i className={d.late?"late":d.early_exits?"early":"present"} style={{height:d.present||d.half_days?"88%":"20%"}}/></>:<><i className="present" style={{height:`${Math.min(100, d.present/max*100)}%`}}/><i className="late" style={{height:`${Math.min(100, d.late/max*100)}%`}}/><i className="absent" style={{height:`${Math.min(100, d.absent/max*100)}%`}}/></>}</div><span>{String(d.day).padStart(2,"0")}</span></div>)}</div><div className="attendance-legend"><span><i className="present"/>Present / On Time</span><span><i className="late"/>Late</span><span><i className="absent"/>Absent / Early Exit</span></div></div>;
}
