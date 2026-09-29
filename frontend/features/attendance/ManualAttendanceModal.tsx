"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { Calendar, CheckCircle2, Clock3, PlusCircle, User, X } from "lucide-react";
import { getTodayISTDateString } from "./helpers";

interface ManualAttendanceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface EmployeeOption {
  id: string;
  _id?: string;
  name?: string;
  display_name?: string;
  employee_code?: string;
  department?: string;
}

export function ManualAttendanceModal({ onClose, onSuccess }: ManualAttendanceModalProps) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(() => getTodayISTDateString());
  const [checkInTime, setCheckInTime] = useState("09:30");
  const [checkOutTime, setCheckOutTime] = useState("18:30");
  const [attendanceStatus, setAttendanceStatus] = useState("Present");
  const [waiveLate, setWaiveLate] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoadingEmployees(true);
    api<any>("/employees/?status=Active")
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || [];
        setEmployees(list);
        if (list.length > 0) {
          setSelectedEmployeeId(list[0].id || list[0]._id || "");
        }
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      toast.error("Please select an employee.");
      return;
    }
    if (!attendanceDate) {
      toast.error("Please specify attendance date.");
      return;
    }

    setSubmitting(true);
    try {
      await api("/attendance/manual/", {
        method: "POST",
        body: JSON.stringify({
          employee_id: selectedEmployeeId,
          attendance_date: attendanceDate,
          check_in_time: checkInTime || "09:30",
          check_out_time: checkOutTime || null,
          attendance_status: attendanceStatus,
          waive_late: waiveLate,
          notes: notes || "Manual entry created by Management",
        }),
      });

      toast.success("Attendance record created successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create manual attendance entry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        zIndex: 1100,
        padding: "16px",
      }}
    >
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--panel, #1e1e24)",
          border: "1px solid var(--border2, #2e2e38)",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border2, rgba(255,255,255,0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                display: "grid",
                placeItems: "center",
              }}
            >
              <PlusCircle size={20} />
            </div>
            <div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "var(--goldD, #cba86e)",
                  textTransform: "uppercase",
                }}
              >
                ADMIN WORKFORCE CONTROL
              </span>
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "1px 0 0 0" }}>
                Manual Attendance Entry
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--muted, #8e8e93)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
              Select Employee *
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={loadingEmployees}
              required
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {loadingEmployees && <option>Loading team members...</option>}
              {!loadingEmployees &&
                employees.map((emp) => {
                  const empId = emp.id || emp._id || "";
                  const name = emp.name || emp.display_name || "Employee";
                  const code = emp.employee_code ? `(${emp.employee_code})` : "";
                  const dept = emp.department ? `- ${emp.department}` : "";
                  return (
                    <option key={empId} value={empId}>
                      {name} {code} {dept}
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
              Attendance Date *
            </label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                Check-In Time
              </label>
              <input
                type="text"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                placeholder="09:30"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              />
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setCheckInTime("09:30")}
                  style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
                >
                  9:30 AM
                </button>
                <button
                  type="button"
                  onClick={() => setCheckInTime("09:35")}
                  style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
                >
                  9:35 AM (Grace)
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                Check-Out Time
              </label>
              <input
                type="text"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                placeholder="18:30"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              />
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setCheckOutTime("18:30")}
                  style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
                >
                  6:30 PM (End)
                </button>
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
              Daily Attendance Status
            </label>
            <select
              value={attendanceStatus}
              onChange={(e) => setAttendanceStatus(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <option value="Present">Present (Full Day)</option>
              <option value="Half Day">Half Day</option>
              <option value="Absent">Absent</option>
              <option value="Leave">On Leave</option>
            </select>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: waiveLate ? "rgba(16, 185, 129, 0.1)" : "rgba(255,255,255,0.03)",
              border: waiveLate ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border)",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
              color: waiveLate ? "#10b981" : "var(--text)",
            }}
          >
            <input
              type="checkbox"
              checked={waiveLate}
              onChange={(e) => setWaiveLate(e.target.checked)}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            ✓ Mark as On Time / Waive Late arrival penalty
          </label>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
              Reason / Admin Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Worked on client site / Offline work approval"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: "13px",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingEmployees}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                borderRadius: "8px",
                border: 0,
                background: "#10b981",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
              }}
            >
              <CheckCircle2 size={15} />
              {submitting ? "Saving..." : "Save Attendance Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
