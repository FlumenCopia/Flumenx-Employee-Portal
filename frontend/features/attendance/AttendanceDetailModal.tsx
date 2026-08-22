"use client";

import { AttendanceRecord } from "@/lib/types";
import { Avatar } from "@/components/icons";
import { Badge } from "@/components/ui";
import { displayTime, statusTone } from "./helpers";
import { Calendar, CheckCircle2, Clock3, MapPin, User, X } from "lucide-react";

interface AttendanceDetailModalProps {
  record: AttendanceRecord;
  onClose: () => void;
}

export function AttendanceDetailModal({ record, onClose }: AttendanceDetailModalProps) {
  const photoUrl = record.photo ? (record.photo.startsWith("http") ? record.photo : record.photo) : null;

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
              ATTENDANCE VERIFICATION RECORD
            </span>
            <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "2px 0 0 0" }}>
              Attendance Details
            </h2>
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

        {/* Modal Content */}
        <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
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
              <Avatar name={record.employee_name} />
              <div>
                <b style={{ fontSize: "14px", display: "block" }}>{record.employee_name}</b>
                <span style={{ fontSize: "11px", color: "var(--muted, #8e8e93)" }}>
                  {record.employee_code} • {record.department}
                </span>
              </div>
            </div>
            <Badge tone={statusTone(record)}>{record.attendance_status}</Badge>
          </div>

          {/* Verification Photo */}
          {photoUrl ? (
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #8e8e93)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>
                Verification Selfie Photo
              </span>
              <div
                style={{
                  width: "100%",
                  maxHeight: "240px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid var(--border2, #333)",
                  background: "#000",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <img
                  src={photoUrl}
                  alt={`Verification photo for ${record.employee_name}`}
                  style={{ width: "100%", height: "240px", objectFit: "cover" }}
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

          {/* Details Grid */}
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
                Status: <span style={{ color: record.is_late ? "var(--danger, #ef4444)" : "var(--text)" }}>{record.check_in_status || "Recorded"}</span>
              </div>
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
