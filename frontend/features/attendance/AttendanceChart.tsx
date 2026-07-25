import { EmptyState } from "@/components/ui";
import { AttendanceSummary } from "./types";

export function AttendanceChart({employee=false, days}:{employee?:boolean; days?: Array<{ day: number } & AttendanceSummary>}){
  if (!days?.length) return <EmptyState title="No attendance trend" text="No chart data is available for this period." />;
  const max = Math.max(1, ...days.map(d => Math.max(d.present, d.late, d.absent)));
  return <div className="attendance-chart"><div className="chart-bars">{days.map(d=><div key={d.day} className="bar-day"><div className="bar-stack">{employee?<><i className={d.late?"late":d.early_exits?"early":"present"} style={{height:d.present||d.half_days?"88%":"20%"}}/></>:<><i className="present" style={{height:`${Math.min(100, d.present/max*100)}%`}}/><i className="late" style={{height:`${Math.min(100, d.late/max*100)}%`}}/><i className="absent" style={{height:`${Math.min(100, d.absent/max*100)}%`}}/></>}</div><span>{String(d.day).padStart(2,"0")}</span></div>)}</div><div className="attendance-legend"><span><i className="present"/>Present / On Time</span><span><i className="late"/>Late</span><span><i className="absent"/>Absent / Early Exit</span></div></div>;
}
