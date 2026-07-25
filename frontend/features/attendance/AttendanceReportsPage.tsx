"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Clock3, ShieldCheck, TimerOff } from "lucide-react";
import { api, apiBlob } from "@/lib/api";
import { PageHeader, PrimaryButton, Section, StatCard } from "@/components/ui";
import { AttendanceChart } from "./AttendanceChart";
import { defaultSummary } from "./helpers";
import { MonthlyStatistics } from "./types";

export function AttendanceReportsPage(){
  const [report,setReport]=useState("Monthly Attendance"); const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const [monthly, setMonthly] = useState<MonthlyStatistics | null>(null);
  useEffect(()=>{
    const controller = new AbortController();
    api<MonthlyStatistics>(`/attendance/monthly-statistics/?month=${month}`, { signal: controller.signal })
      .then(setMonthly)
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  },[month]);
  async function download(){
    const blob = await apiBlob(`/attendance/export/?month=${month}`);
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`flumenx-${report.toLowerCase().replaceAll(" ","-")}-${month}.csv`;a.click();URL.revokeObjectURL(url);
  }
  const reportSummary = monthly?.summary || defaultSummary;
  return <><PageHeader eyebrow="ATTENDANCE / REPORTING" title="Attendance reports." subtitle="Operational records ready for review, payroll, and workforce planning." action={<PrimaryButton onClick={download}>Export CSV</PrimaryButton>}/><div className="report-controls"><div>{["Daily Attendance","Monthly Attendance","Late Arrival","Early Exit","Employee History"].map(x=><button key={x} className={report===x?"active":""} onClick={()=>setReport(x)}>{x}</button>)}</div><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div><div className="stats-grid"><StatCard label="Attendance rate" value={`${reportSummary.attendance_percentage}%`} note="Month to date" icon={<ShieldCheck/>}/><StatCard label="Late arrivals" value={String(reportSummary.late)} note="Across filtered records" icon={<Clock3/>} accent/><StatCard label="Early exits" value={String(reportSummary.early_exits)} note="Across filtered records" icon={<TimerOff/>}/><StatCard label="Present records" value={String(reportSummary.present)} note={`${reportSummary.absent} absent`} icon={<CalendarCheck/>}/></div><Section title={report} kicker={`${month} / GENERATED VIEW`}><AttendanceChart days={monthly?.days}/><div className="report-summary-grid"><div><span>PRESENT</span><b>{reportSummary.present}</b><small>Records in selected month</small></div><div><span>LATE ARRIVALS</span><b>{reportSummary.late}</b><small>Based on grace policy</small></div><div><span>EARLY EXITS</span><b>{reportSummary.early_exits}</b><small>Before office end time</small></div></div></Section></>;
}
