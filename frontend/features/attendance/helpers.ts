import { AttendanceRecord } from "@/lib/types";
import { AttendanceSummary } from "./types";

export const statusTone = (record: AttendanceRecord) => record.is_early_exit ? "early-exit" : record.check_in_status === "Late" ? "late" : record.check_in_status === "Grace Period" ? "grace" : record.attendance_status === "Absent" ? "absent" : "on-time";
export const displayTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  if (value.includes("T")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
    }
  }
  const clean = value.trim();
  const isPM = clean.toUpperCase().includes("PM");
  const isAM = clean.toUpperCase().includes("AM");
  const parts = clean.split(":");
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10) || 0;
    const minutes = parts[1].replace(/[^\d]/g, "").padStart(2, "0").slice(0, 2);
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;
  }
  return value;
};

export const defaultSummary: AttendanceSummary = {
  present: 0, late: 0, early_exits: 0, absent: 0, half_days: 0, leave: 0, attendance_percentage: 0,
};

export const formatMinutesDuration = (mins: number): string => {
  if (!mins || mins <= 0) return "0 min";
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours === 0) {
    return `${remainingMins} min`;
  }
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMins}m`;
};

export const getTodayISTDateString = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const getCurrentISTMonthString = (date: Date = new Date()): string => {
  return getTodayISTDateString(date).slice(0, 7);
};
