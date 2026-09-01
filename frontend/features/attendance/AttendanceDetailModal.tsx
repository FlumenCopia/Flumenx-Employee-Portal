"use client";

import { useState } from "react";
import { AttendanceRecord } from "@/lib/types";
import { Avatar } from "@/components/icons";
import { Badge } from "@/components/ui";
import { displayTime, statusTone } from "./helpers";
import { Calendar, CheckCircle2, Clock3, Edit3, MapPin, RotateCcw, Save, ShieldAlert, Sparkles, User, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";

interface AttendanceDetailModalProps {
  record: AttendanceRecord;
  onClose: () => void;
  onUpdated?: () => void;
}

export function AttendanceDetailModal({ record, onClose, onUpdated }: AttendanceDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [checkInTime, setCheckInTime] = useState(record.check_in_time || "09:30");
  const [checkOutTime, setCheckOutTime] = useState(record.check_out_time || "");
  const [waiveLate, setWaiveLate] = useState(record.is_late || false);
  const [attendanceStatus, setAttendanceStatus] = useState(record.attendance_status || "Present");
  const [adminNote, setAdminNote] = useState(record.notes || "");
  const [saving, setSaving] = useState(false);

  const photoUrl = record.photo ? (record.photo.startsWith("http") ? record.photo : record.photo) : null;

  const handleSaveAdjustment = async () => {
    setSaving(true);
    try {
      await api(`/attendance/${record.id}/adjust-time/`, {
        method: "PATCH",
        body: JSON.stringify({
          check_in_time: checkInTime,
          check_out_time: checkOutTime || null,
          waive_late: waiveLate,
          is_late: !waiveLate && record.is_late,
          check_in_status: waiveLate ? "On Time" : undefined,
          attendance_status: waiveLate && (attendanceStatus === "Half Day" || attendanceStatus === "Present (Late)") ? "Present" : attendanceStatus,
          notes: adminNote ? `${adminNote} (Admin Adjusted)` : "Adjusted by Admin",
        }),
      });

      toast.success("Attendance record successfully updated & recalculated!");
      if (onUpdated) onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update attendance record");
    } finally {
      setSaving(false);
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
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "560px",
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
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border2, rgba(255,255,255,0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
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
              ATTENDANCE VERIFICATION &amp; CORRECTION
            </span>
            <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "2px 0 0 0" }}>
              Attendance Details
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                background: isEditing ? "var(--accent, #087A5B)" : "rgba(255,255,255,0.06)",
                color: isEditing ? "#fff" : "var(--text)",
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              <Edit3 size={13} />
              {isEditing ? "View Details" : "Quick Correct"}
            </button>
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
        </div>

        {/* Modal Content */}
        <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Employee Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "14px",
              background: "var(--panel2, rgba(255,255,255,0.03))",
              borderRadius: "12px",
              border: "1px solid var(--border, rgba(255,255,255,0.06))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Avatar name={record.employee_name} avatar={(record as any).employee_avatar || (record as any).avatar} />
              <div>
                <b style={{ fontSize: "15px", display: "block" }}>{record.employee_name}</b>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {record.employee_code} • {record.department}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <Badge tone={statusTone(record)}>{record.check_in_status || (record.is_late ? "Late" : "On Time")}</Badge>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                {record.attendance_date}
              </span>
            </div>
          </div>

          {/* Quick Correction Editor Mode */}
          {isEditing ? (
            <div
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "rgba(8, 122, 91, 0.04)",
                border: "1px solid rgba(8, 122, 91, 0.25)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 800, color: "#10b981" }}>
                <Sparkles size={15} />
                QUICK ATTENDANCE CORRECTION &amp; TIME ADJUSTMENT
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                    Check-In Time
                  </label>
                  <input
                    type="text"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    placeholder="e.g. 09:30 AM or 09:30"
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
                      onClick={() => { setCheckInTime("09:30"); setWaiveLate(true); }}
                      style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
                    >
                      9:30 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCheckInTime("09:35"); setWaiveLate(true); }}
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
                    placeholder="e.g. 06:30 PM or 18:30"
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
                      6:30 PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Waive Late Checkbox */}
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
                  onChange={(e) => {
                    setWaiveLate(e.target.checked);
                    if (e.target.checked) {
                      setAttendanceStatus("Present");
                    }
                  }}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                ✓ Waive Late Penalty &amp; Mark as On Time (Remove Half Day penalty)
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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
                      fontSize: "12.5px",
                      fontWeight: 600,
                    }}
                  >
                    <option value="Present">Present (Full Day)</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Absent">Absent</option>
                    <option value="Leave">On Leave</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                    Admin Justification / Note
                  </label>
                  <input
                    type="text"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="e.g. Traffic waiver approved by HR"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      fontSize: "12.5px",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdjustment}
                  disabled={saving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: 0,
                    background: "var(--accent, #087A5B)",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(8, 122, 91, 0.3)",
                  }}
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Apply & Save Correction"}
                </button>
              </div>
            </div>
          ) : null}

          {/* Verification Photo */}
          {photoUrl ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #8e8e93)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Verification Selfie Photo (Full View)
                </span>
                <span style={{ fontSize: "11px", color: "var(--neon, #00e889)", fontWeight: 600 }}>
                  Click to Expand
                </span>
              </div>
              <div
                onClick={() => window.open(photoUrl, "_blank")}
                style={{
                  width: "100%",
                  maxHeight: "360px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid var(--border2, #333)",
                  background: "#09090b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "zoom-in",
                  padding: "8px",
                }}
                title="Click to view full original photo in new tab"
              >
                <img
                  src={photoUrl}
                  alt={`Verification photo for ${record.employee_name}`}
                  style={{ maxWidth: "100%", maxHeight: "340px", objectFit: "contain", borderRadius: "8px" }}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed var(--border2, #444)",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--muted, #8e8e93)",
              }}
            >
              No photo uploaded for this attendance record.
            </div>
          )}

          {/* Time & Distance Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {/* Check In Box */}
            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                background: "var(--panel2, rgba(255,255,255,0.03))",
                border: "1px solid var(--border, rgba(255,255,255,0.06))",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>
                <Clock3 size={13} />
                CHECK IN
              </div>
              <b style={{ fontSize: "16px" }}>{displayTime(record.check_in_time)}</b>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                Status: <span style={{ color: record.check_in_status === "Late" || record.is_late ? "var(--danger, #ef4444)" : record.check_in_status === "Grace Period" ? "var(--goldD, #d97706)" : "#10b981", fontWeight: 700 }}>{record.check_in_status || (record.is_late ? "Late" : "On Time")}</span>
              </div>
              {record.is_late && (
                <div style={{ fontSize: "11px", color: "var(--danger, #ef4444)", fontWeight: 700 }}>
                  Late Arrival: {record.late_minutes} minutes
                </div>
              )}
              {record.check_in_distance_meters !== null && record.check_in_distance_meters !== undefined && (
                <div style={{ fontSize: "11px", color: "#4ade80", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                  <MapPin size={12} /> {record.check_in_distance_meters}m from office
                </div>
              )}
            </div>

            {/* Check Out Box */}
            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                background: "var(--panel2, rgba(255,255,255,0.03))",
                border: "1px solid var(--border, rgba(255,255,255,0.06))",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>
                <Clock3 size={13} />
                CHECK OUT
              </div>
              <b style={{ fontSize: "16px" }}>{displayTime(record.check_out_time)}</b>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                Working Hours: <span>{record.working_hours ? `${Number(record.working_hours).toFixed(2)}h` : "N/A"}</span>
              </div>
              {record.check_out_distance_meters !== null && record.check_out_distance_meters !== undefined && (
                <div style={{ fontSize: "11px", color: "#4ade80", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                  <MapPin size={12} /> {record.check_out_distance_meters}m from office
                </div>
              )}
            </div>
          </div>

          {/* Daily Status & Notes */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "var(--panel2, rgba(255,255,255,0.03))",
              border: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12.5px",
            }}
          >
            <span style={{ color: "var(--muted)" }}>Daily Attendance Status:</span>
            <b style={{ color: record.attendance_status === "Half Day" || record.is_late ? "#f59e0b" : "#10b981" }}>
              {record.attendance_status || "Present"}
            </b>
          </div>

          {record.notes && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
                fontSize: "12px",
                color: "var(--text)",
              }}
            >
              <b style={{ color: "var(--muted)", display: "block", marginBottom: "2px" }}>Notes:</b>
              {record.notes}
            </div>
          )}

          {/* Auto Forced Checkout Notice if Applicable */}
          {record.is_auto_checkout && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "12px",
              }}
            >
              <span style={{ fontWeight: 800, color: "#f59e0b", display: "flex", alignItems: "center", gap: "6px" }}>
                ⚡ Auto-Checkout System Notice
              </span>
              <span style={{ color: "#e2e8f0" }}>
                {record.auto_checkout_reason || "Employee forgot to check out. Automatically checked out by the system at midnight with standard shift end time."}
              </span>
            </div>
          )}

          {/* Verification Status */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: record.location_verified ? "rgba(34, 197, 94, 0.08)" : "rgba(255,255,255,0.03)",
              border: record.location_verified ? "1px solid rgba(34, 197, 94, 0.2)" : "1px solid var(--border, #333)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
            }}
          >
            <span style={{ color: "var(--muted)" }}>GPS Location Verification:</span>
            <span style={{ fontWeight: 700, color: record.location_verified ? "#4ade80" : "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              <CheckCircle2 size={14} />
              {record.location_verified ? "Backend Verified (Within 100m)" : "Unverified"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
