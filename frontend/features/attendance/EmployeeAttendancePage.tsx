"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, CalendarCheck, CheckCircle2, Clock3, LogIn, LogOut, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { AttendanceRecord, Paginated } from "@/lib/types";
import { Badge, EmptyState, PageHeader, PrimaryButton, Section, StatCard } from "@/components/ui";
import { AttendanceChart } from "./AttendanceChart";
import { defaultSummary, displayTime, formatMinutesDuration, statusTone } from "./helpers";
import { AttendanceSummary, MonthlyStatistics } from "./types";
import { AttendanceCameraModal } from "./AttendanceCameraModal";

function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function EmployeeAttendancePage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [correction, setCorrection] = useState(false);
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

  // Camera & Location modal states
  const [activeModal, setActiveModal] = useState<"check-in" | "check-out" | null>(null);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number; distance: number } | null>(null);

  const applyAttendanceRecord = useCallback((updated: any) => {
    const rawDate = updated.attendance_date || (updated.attendanceDate ? String(updated.attendanceDate).split('T')[0] : '');
    const formattedRecord: AttendanceRecord = {
      id: updated.id || updated._id,
      employee: updated.employee,
      employee_name: updated.employee_name || '',
      employee_code: updated.employee_code || '',
      department: updated.department || '',
      attendance_date: rawDate || today,
      check_in_time: updated.check_in_time || updated.checkInTime || null,
      check_out_time: updated.check_out_time || updated.checkOutTime || null,
      check_in_status: updated.check_in_status || updated.checkInStatus || '',
      attendance_status: updated.attendance_status || updated.attendanceStatus || '',
      is_late: Boolean(updated.is_late ?? updated.isLate),
      late_minutes: updated.late_minutes ?? updated.lateMinutes ?? 0,
      is_early_exit: Boolean(updated.is_early_exit ?? updated.isEarlyExit),
      early_exit_minutes: updated.early_exit_minutes ?? updated.earlyExitMinutes ?? 0,
      working_hours: String(updated.working_hours ?? updated.workingHours ?? '0'),
      source: updated.source || '',
      location_verified: Boolean(updated.location_verified ?? updated.locationVerified),
      photo: updated.photo || null,
      latitude: updated.latitude || null,
      longitude: updated.longitude || null,
    };

    setRecord(formattedRecord);
    setRecords(current => {
      const exists = current.some(item => item.id === formattedRecord.id || item.attendance_date === formattedRecord.attendance_date);
      const next = exists
        ? current.map(item => item.id === formattedRecord.id || item.attendance_date === formattedRecord.attendance_date ? formattedRecord : item)
        : [formattedRecord, ...current];
      return next.sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
    });
  }, [today]);

  const refreshAggregates = useCallback(async () => {
    const requestId = ++aggregateRequestRef.current;
    setRefreshError("");
    setSummaryError("");
    setMonthlyError("");
    try {
      const monthlyResult = await api<MonthlyStatistics>(`/attendance/monthly-statistics/?my_attendance=true&month=${currentMonth}`);
      if (requestId !== aggregateRequestRef.current) return;
      setMonthly(monthlyResult);
      if (monthlyResult.summary) {
        setSummary(monthlyResult.summary);
      }
    } catch (err) {
      if (requestId !== aggregateRequestRef.current) return;
      const errorMsg = err instanceof Error ? err.message : "Could not refresh monthly statistics.";
      setMonthlyError(errorMsg);
      setSummaryError(errorMsg);
      setRefreshError("Office entry was recorded, but attendance totals could not refresh.");
    }
  }, [currentMonth]);

  const loadAttendance = useCallback(() => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setRecordsError("");
    setSummaryError("");
    setMonthlyError("");
    setRefreshError("");

    api<Paginated<AttendanceRecord>>(`/attendance/?my_attendance=true&month=${currentMonth}`)
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

    api<AttendanceSummary>(`/attendance/summary/?my_attendance=true&month=${currentMonth}`)
      .then(value => {
        if (requestId !== loadRequestRef.current) return;
        setSummary(value);
      })
      .catch(err => {
        if (requestId !== loadRequestRef.current) return;
        setSummary(defaultSummary);
        setSummaryError(err instanceof Error ? err.message : "Could not load attendance summary.");
      });

    api<MonthlyStatistics>(`/attendance/monthly-statistics/?my_attendance=true&month=${currentMonth}`)
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

  useEffect(() => {
    loadAttendance();
    return () => {
      loadRequestRef.current += 1;
      aggregateRequestRef.current += 1;
    };
  }, [loadAttendance]);

  const [policy, setPolicy] = useState<{ office_latitude: string; office_longitude: string; allowed_radius_meters: number } | null>(null);

  useEffect(() => {
    api<{ office_latitude: string; office_longitude: string; allowed_radius_meters: number }>("/attendance-policy/")
      .then(res => setPolicy(res))
      .catch(() => {});
  }, []);

  const initiateAttendanceAction = (actionType: "check-in" | "check-out") => {
    if (actionPending) return;
    setMessage("");
    setErrorMessage("");
    setRefreshError("");
    setActionPending(true);

    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser.");
      setActionPending(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const officeLat = policy ? (parseFloat(String((policy as any).officeLatitude || (policy as any).office_latitude || "8.521310")) || 8.521310) : 8.521310;
        const officeLng = policy ? (parseFloat(String((policy as any).officeLongitude || (policy as any).office_longitude || "76.978630")) || 76.978630) : 76.978630;
        const allowedRadius = Number((policy as any)?.allowedRadiusMeters || (policy as any)?.allowed_radius_meters || 200);
        const calcDist = calculateHaversine(userLat, userLng, officeLat, officeLng);
        const distance = isNaN(calcDist) ? 0 : calcDist;

        // Location radius check applies ONLY for Check-In (Checkout permitted from anywhere)
        if (actionType === "check-in" && distance > allowedRadius) {
          setErrorMessage(`You are outside the allowed office attendance area (${distance}m away). You must be within ${allowedRadius} meters of the office to check in.`);
          setActionPending(false);
          return;
        }

        setPendingLocation({ lat: userLat, lng: userLng, distance });
        setActiveModal(actionType);
        setActionPending(false);
      },
      (error) => {
        setActionPending(false);
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMessage("Location permission was denied. Please enable GPS/location access in your browser settings to mark attendance.");
        } else {
          setErrorMessage("Could not obtain your current location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleModalConfirm = async (photoBlob: Blob | null) => {
    if (!pendingLocation || !activeModal) return;
    setActionPending(true);
    setMessage("");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("latitude", String(pendingLocation.lat));
      formData.append("longitude", String(pendingLocation.lng));
      if (photoBlob && activeModal === "check-in") {
        formData.append("photo", photoBlob, "attendance.jpg");
      }

      const endpoint = activeModal === "check-in" ? "/attendance/check-in/" : "/attendance/check-out/";
      const updated = await api<AttendanceRecord>(endpoint, {
        method: "POST",
        body: formData,
      });

      applyAttendanceRecord(updated);
      setMessage(activeModal === "check-in" ? "Office check-in recorded successfully!" : "Office checkout recorded successfully!");
      setActiveModal(null);
      setPendingLocation(null);
      loadAttendance();
      refreshAggregates();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Attendance action could not be completed.");
    } finally {
      setActionPending(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="MY WORKSPACE / ATTENDANCE"
        title="Your attendance."
        subtitle="A transparent view of your time, status, and monthly rhythm."
        action={
          <button className="secondary-button" onClick={() => setCorrection(true)}>
            Request correction
          </button>
        }
      />

      {/* Office Timing & Half Day Policy Banner */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border2)",
          borderRadius: "12px",
          padding: "14px 18px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(203,168,110,0.15)",
              border: "1px solid rgba(203,168,110,0.3)",
              color: "var(--goldD)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Clock3 size={18} />
          </div>
          <div>
            <b style={{ fontSize: "13px", color: "var(--text)", display: "block" }}>
              Attendance Timing & Half-Day Policy
            </b>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              Office hours: <b>09:30 AM – 06:30 PM</b>. Check-ins after <b>09:35 AM</b> or checkouts before <b>06:00 PM</b> automatically record as <b>Half Day</b>.
            </span>
          </div>
        </div>
      </div>

      {message && <div className="toast success"><CheckCircle2 size={18} />{message}</div>}
      {errorMessage && <div className="toast error"><TriangleAlert size={18} />{errorMessage}</div>}
      {refreshError && <div className="toast error">{refreshError}</div>}
      {recordsError && <EmptyState title="Could not load attendance" text={recordsError} />}

      <div className="attendance-hero">
        <div
          className="clock-panel"
          style={{
            background: "linear-gradient(135deg, #cba86e 0%, #a8874e 100%)",
            borderRadius: "14px",
            padding: "22px",
            color: "#ffffff",
            boxShadow: "0 4px 15px rgba(203,168,110,0.25)",
          }}
        >
          <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            MARK TODAY'S ATTENDANCE • {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase()}
          </span>
          <strong style={{ fontSize: "42px", fontWeight: 900, display: "block", margin: "8px 0" }}>
            {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </strong>
          <p style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", margin: "0 0 16px 0", opacity: 0.9 }}>
            <Building2 size={14} /> Verify location & photo to mark attendance
          </p>
          <div className="clock-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => initiateAttendanceAction("check-in")}
              disabled={actionPending || Boolean(record?.check_in_time)}
              style={{
                background: record?.check_in_time ? "rgba(255,255,255,0.2)" : "#ffffff",
                color: record?.check_in_time ? "#ffffff" : "#1a1b1e",
                border: 0,
                borderRadius: "8px",
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: "12.5px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: record?.check_in_time ? "not-allowed" : "pointer",
                boxShadow: record?.check_in_time ? "none" : "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              {actionPending ? <Clock3 size={18} /> : <LogIn size={18} />}
              {actionPending ? "Verifying..." : record?.check_in_time ? "Checked In Today" : "Enter Office (Check In)"}
            </button>

            <button
              onClick={() => initiateAttendanceAction("check-out")}
              disabled={actionPending || !record?.check_in_time || Boolean(record?.check_out_time)}
              style={{
                background: !record?.check_in_time || record?.check_out_time ? "rgba(255,255,255,0.2)" : "#1a1b1e",
                color: "#ffffff",
                border: 0,
                borderRadius: "8px",
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: "12.5px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: !record?.check_in_time || record?.check_out_time ? "not-allowed" : "pointer",
                boxShadow: !record?.check_in_time || record?.check_out_time ? "none" : "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <LogOut size={18} />
              {record?.check_out_time ? "Checked Out Today" : "Check Out of Office"}
            </button>
          </div>
        </div>

        <div className="today-record">
          <div className="record-head">
            <span>TODAY'S RECORD</span>
            {record ? (
              <Badge tone={statusTone(record)}>
                {record.attendance_status || (record.is_late ? "Present (Late)" : "Present")}
              </Badge>
            ) : (
              <Badge>No attendance recorded</Badge>
            )}
          </div>
          {record ? (
            <div className="record-times">
              <div>
                <LogIn />
                <span>OFFICE ENTRY</span>
                <b>{displayTime(record.check_in_time)}</b>
                <small style={{ color: record.is_late ? "var(--danger)" : "var(--muted)", fontWeight: record.is_late ? 700 : 400 }}>
                  {record.check_in_status || (record.is_late ? "Late Arrival" : "On Time")}
                </small>
              </div>
              <div>
                <LogOut />
                <span>OFFICE EXIT</span>
                <b>{displayTime(record.check_out_time)}</b>
                <small style={{ color: record.is_early_exit ? "var(--goldD)" : "var(--muted)" }}>
                  {record.check_out_time ? (record.is_early_exit ? "Early Exit" : "Full Day") : "Not checked out"}
                </small>
              </div>
            </div>
          ) : (
            <EmptyState title="No attendance recorded today" text="Click 'Enter Office' on the clock panel to record your attendance for today." />
          )}
        </div>
      </div>

      {summaryError && <EmptyState title="Could not load summary" text={summaryError} />}
      <div className="stats-grid">
        <StatCard label="Present days" value={summaryError ? "Not available" : String(summary.present)} note={summaryError ? "Summary unavailable" : `${summary.half_days} half days`} icon={<CalendarCheck />} />
        <StatCard label="Late this month" value={summaryError ? "Not available" : String(summary.late)} note="Calculated from your check-ins" icon={<TriangleAlert />} accent />
        <StatCard label="Attendance rate" value={summaryError ? "Not available" : `${summary.attendance_percentage}%`} note="Month to date" icon={<ShieldCheck />} />
      </div>

      <Section title="Attendance history" kicker="RECENT / RECORDS">
        <div className="table-responsive-wrapper" style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "8px" }}>
          <div className="data-table employee-attendance-table" style={{ minWidth: "550px" }}>
            <div className="table-head">
              <span>Date</span>
              <span>Check in</span>
              <span>Check out</span>
              <span>Status</span>
            </div>
            {!loading && !recordsError && records.slice(0, 7).map(r => (
              <div className="table-row" key={r.id}>
                <b>{new Date(r.attendance_date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}</b>
                <span>{displayTime(r.check_in_time)}</span>
                <span>{displayTime(r.check_out_time)}</span>
                <Badge tone={statusTone(r)}>{r.attendance_status}</Badge>
              </div>
            ))}
          </div>
        </div>
        {loading && <EmptyState title="Loading attendance history" text="Fetching attendance records." />}
        {!loading && !recordsError && !records.length && <EmptyState title="No attendance history" text="No attendance records are available." />}
      </Section>

      {/* Camera Capture Modal */}
      {activeModal && pendingLocation && (
        <AttendanceCameraModal
          mode={activeModal}
          distanceMeters={pendingLocation.distance}
          onConfirm={handleModalConfirm}
          onCancel={() => {
            setActiveModal(null);
            setPendingLocation(null);
          }}
          submitting={actionPending}
        />
      )}

      {/* Correction Modal */}
      {correction && (
        <div className="modal-backdrop" onMouseDown={() => setCorrection(false)}>
          <div className="modal" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span>ATTENDANCE / CORRECTION</span>
                <h2>Request attendance correction</h2>
              </div>
              <button onClick={() => setCorrection(false)}>x</button>
            </div>
            <form
              className="modal-form"
              onSubmit={async e => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                try {
                  await api("/attendance-corrections/", {
                    method: "POST",
                    body: JSON.stringify({
                      attendance_record_id: record?.id || null,
                      requested_check_in: data.get("check_in") || null,
                      requested_check_out: data.get("check_out") || null,
                      reason: data.get("reason"),
                    }),
                  });
                  setMessage("Correction request submitted successfully! Your administrator will review and approve it.");
                  setCorrection(false);
                } catch (err) {
                  setErrorMessage(err instanceof Error ? err.message : "Could not submit correction request.");
                }
              }}
            >
              <label>Requested office entry<input name="check_in" type="time" /></label>
              <label>Requested office exit<input name="check_out" type="time" /></label>
              <label>Reason<textarea name="reason" required placeholder="Explain why entry/exit time needs correction" /></label>
              <PrimaryButton type="submit">Submit Correction Request</PrimaryButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
