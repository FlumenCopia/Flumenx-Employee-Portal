import { AttendanceRecord } from "@/lib/types";
import { AttendanceSummary } from "./types";

export const statusTone = (record: AttendanceRecord) => record.is_early_exit ? "early-exit" : record.check_in_status === "Late" ? "late" : record.check_in_status === "Grace Period" ? "grace" : record.attendance_status === "Absent" ? "absent" : "on-time";
export const displayTime = (value: string | null) => value ? new Date(`2026-01-01T${value}`).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "â€”";

export const defaultSummary: AttendanceSummary = {
  present: 0, late: 0, early_exits: 0, absent: 0, half_days: 0, leave: 0, attendance_percentage: 0,
};
