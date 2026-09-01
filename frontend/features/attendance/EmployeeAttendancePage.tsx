"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Compass,
  HelpCircle,
  Info,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { AttendanceRecord, Paginated } from "@/lib/types";
import { Badge, EmptyState, PageHeader, PrimaryButton, Section, StatCard } from "@/components/ui";
import { AttendanceChart } from "./AttendanceChart";
import { defaultSummary, displayTime, formatMinutesDuration, statusTone, getTodayISTDateString, getCurrentISTMonthString } from "./helpers";
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
  const currentMonth = getCurrentISTMonthString();
  const today = getTodayISTDateString();
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

  // GPS Diagnostic & Permission State
  const [gpsStatus, setGpsStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "timeout" | "insecure" | "unsupported">("idle");
  const [gpsInfo, setGpsInfo] = useState<{
    lat?: number;
    lng?: number;
    accuracy?: number;
    distance?: number;
    allowedRadius?: number;
    isInside?: boolean;
    errorMsg?: string;
  } | null>(null);
  const [showGpsHelpModal, setShowGpsHelpModal] = useState(false);

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

  const getGpsPosition = (enableHighAccuracy = true, timeoutMs = 8000): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 0,
      });
    });
  };

  const checkOrRequestGps = async (showModalIfDenied = true) => {
    if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setGpsStatus("insecure");
      setGpsInfo({
        errorMsg: "Location requires a secure connection (HTTPS). Please access this portal via https://...",
      });
      return null;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("unsupported");
      setGpsInfo({
        errorMsg: "Geolocation is not supported by this browser.",
      });
      return null;
    }

    setGpsStatus("requesting");
    setErrorMessage("");

    const officeLat = policy ? (parseFloat(String((policy as any).officeLatitude || (policy as any).office_latitude || "8.521310")) || 8.521310) : 8.521310;
    const officeLng = policy ? (parseFloat(String((policy as any).officeLongitude || (policy as any).office_longitude || "76.978630")) || 76.978630) : 76.978630;
    const allowedRadius = Number((policy as any)?.allowedRadiusMeters || (policy as any)?.allowed_radius_meters || 200);

    try {
      // 1. Try High Accuracy (GPS hardware)
      let pos: GeolocationPosition;
      try {
        pos = await getGpsPosition(true, 8000);
      } catch (err: any) {
        // 2. Fallback to standard accuracy (Cell/Wi-Fi triangulation) if GPS timed out indoors
        if (err && (err.code === 3 || err.code === 2)) {
          pos = await getGpsPosition(false, 12000);
        } else {
          throw err;
        }
      }

      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 0);
      const calcDist = calculateHaversine(userLat, userLng, officeLat, officeLng);
      const distance = isNaN(calcDist) ? 0 : calcDist;
      const isInside = distance <= allowedRadius;

      setGpsStatus("granted");
      setGpsInfo({
        lat: userLat,
        lng: userLng,
        accuracy,
        distance,
        allowedRadius,
        isInside,
      });

      return { lat: userLat, lng: userLng, distance, accuracy, allowedRadius, isInside };
    } catch (err: any) {
      if (err && err.code === 1) { // PERMISSION_DENIED
        setGpsStatus("denied");
        setGpsInfo({
          errorMsg: "Location permission is blocked or denied. Please enable GPS in your browser address bar (🔒 / ⚙️) or phone settings.",
        });
        if (showModalIfDenied) {
          setShowGpsHelpModal(true);
        }
      } else if (err && err.code === 3) { // TIMEOUT
        setGpsStatus("timeout");
        setGpsInfo({
          errorMsg: "Location request timed out. Please check that GPS / Location is turned ON in your device settings and try again.",
        });
      } else {
        setGpsStatus("idle");
        setGpsInfo({
          errorMsg: err?.message || "Could not retrieve GPS location.",
        });
      }
      return null;
    }
  };

  const initiateAttendanceAction = async (actionType: "check-in" | "check-out") => {
    if (actionPending) return;
    setMessage("");
    setErrorMessage("");
    setRefreshError("");
    setActionPending(true);

    const location = await checkOrRequestGps(true);
    if (!location) {
      setActionPending(false);
      setErrorMessage("GPS location could not be verified. Please click 'Check / Enable GPS' to grant permission.");
      return;
    }

    const allowedRadius = location.allowedRadius || 200;
    if (actionType === "check-in" && !location.isInside) {
      setErrorMessage(`You are outside the allowed office attendance area (${location.distance}m away). You must be within ${allowedRadius} meters of the office to check in.`);
      setActionPending(false);
      return;
    }

    setPendingLocation({ lat: location.lat, lng: location.lng, distance: location.distance });
    setActiveModal(actionType);
    setActionPending(false);
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
      {errorMessage && (
        <div className="toast error" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TriangleAlert size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
          {(errorMessage.toLowerCase().includes("location") || errorMessage.toLowerCase().includes("gps") || errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("area")) && (
            <button
              type="button"
              onClick={() => {
                setShowGpsHelpModal(true);
                checkOrRequestGps(true);
              }}
              style={{
                background: "rgba(220, 38, 38, 0.2)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <MapPin size={12} /> Fix GPS Permission / Retry
            </button>
          )}
        </div>
      )}
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

          {/* GPS Quick Diagnostic & Permission Bar */}
          <div
            style={{
              marginTop: "16px",
              background: gpsStatus === "granted" ? "rgba(16, 185, 129, 0.18)" : gpsStatus === "denied" ? "rgba(220, 38, 38, 0.22)" : "rgba(0, 0, 0, 0.22)",
              border: `1px solid ${gpsStatus === "granted" ? "rgba(16, 185, 129, 0.45)" : gpsStatus === "denied" ? "rgba(248, 113, 113, 0.5)" : "rgba(255, 255, 255, 0.2)"}`,
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              {gpsStatus === "granted" ? (
                <CheckCircle2 size={16} color="#34D399" style={{ flexShrink: 0 }} />
              ) : gpsStatus === "denied" ? (
                <ShieldAlert size={16} color="#F87171" style={{ flexShrink: 0 }} />
              ) : (
                <Navigation size={16} color="#ffffff" style={{ flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#ffffff", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {gpsStatus === "granted"
                    ? `GPS Ready • ${gpsInfo?.distance}m from office ${gpsInfo?.isInside ? "(Inside Zone)" : "(Outside Zone)"}`
                    : gpsStatus === "denied"
                    ? "GPS Permission Blocked / Denied"
                    : gpsStatus === "requesting"
                    ? "Acquiring GPS Position..."
                    : gpsStatus === "insecure"
                    ? "HTTPS Required for GPS Access"
                    : "GPS Location & Permission Check"}
                </span>
                <small style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.78)", display: "block" }}>
                  {gpsStatus === "granted"
                    ? `Accuracy: ±${gpsInfo?.accuracy}m • Lat: ${gpsInfo?.lat?.toFixed(4)}, Lng: ${gpsInfo?.lng?.toFixed(4)}`
                    : "Click to grant, test, or re-verify GPS permission"}
                </small>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() => checkOrRequestGps(true)}
                disabled={gpsStatus === "requesting" || actionPending}
                style={{
                  background: "#ffffff",
                  color: "#087A5B",
                  border: 0,
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                }}
              >
                {gpsStatus === "requesting" ? <RefreshCw size={12} className="animate-spin" /> : <MapPin size={12} />}
                {gpsStatus === "granted" ? "Re-check GPS" : gpsStatus === "denied" ? "Re-grant Permission" : "Check / Enable GPS"}
              </button>

              <button
                type="button"
                onClick={() => setShowGpsHelpModal(true)}
                title="GPS Permission Guide"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: "6px",
                  padding: "6px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <HelpCircle size={13} />
                <span>Guide</span>
              </button>
            </div>
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
          <div className="data-table employee-attendance-table" style={{ width: "100%" }}>
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

      {/* GPS Troubleshooting & Permission Guide Modal */}
      {showGpsHelpModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowGpsHelpModal(false)}>
          <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ maxWidth: "540px" }}>
            <div className="modal-head">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(8,122,91,0.15)", color: "#087A5B", display: "grid", placeItems: "center" }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "var(--muted)" }}>LOCATION PERMISSION GUIDE</span>
                  <h2 style={{ fontSize: "16px", margin: 0 }}>Enable GPS on Your Device</h2>
                </div>
              </div>
              <button onClick={() => setShowGpsHelpModal(false)} aria-label="Close modal">✕</button>
            </div>

            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ background: "var(--panel2, rgba(255,255,255,0.04))", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px" }}>
                <b style={{ fontSize: "12.5px", color: "var(--text)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  📱 Android (Google Chrome / Brave)
                </b>
                <ol style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.6 }}>
                  <li>Tap the <b>Lock (🔒)</b> or <b>Tune (⚙️)</b> icon next to the website address at the top.</li>
                  <li>Tap <b>Permissions</b> &rarr; <b>Location</b> &rarr; choose <b>Allow</b> (or tap <i>Reset permissions</i>).</li>
                  <li>Pull down your phone notification tray and ensure <b>Location / GPS</b> is turned <b>ON</b>.</li>
                </ol>
              </div>

              <div style={{ background: "var(--panel2, rgba(255,255,255,0.04))", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px" }}>
                <b style={{ fontSize: "12.5px", color: "var(--text)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  🍏 iPhone / iPad (Safari)
                </b>
                <ol style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.6 }}>
                  <li>Open iPhone <b>Settings</b> &rarr; <b>Privacy & Security</b> &rarr; <b>Location Services</b> &rarr; Make sure it is <b>ON</b>.</li>
                  <li>Scroll down and tap <b>Safari Websites</b> &rarr; Select <b>While Using the App</b> (and enable <i>Precise Location</i>).</li>
                  <li>Return to Safari, tap the <b>aA</b> or <b>Lock</b> icon in the address bar &rarr; <i>Website Settings</i> &rarr; <b>Location: Allow</b>.</li>
                </ol>
              </div>

              <div style={{ background: "var(--panel2, rgba(255,255,255,0.04))", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 14px" }}>
                <b style={{ fontSize: "12.5px", color: "var(--text)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  💻 Laptop / Desktop (Chrome / Edge / Firefox)
                </b>
                <ol style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.6 }}>
                  <li>Click the <b>Tune (⚙️) / Lock (🔒)</b> icon to the left of the website address in the address bar.</li>
                  <li>Toggle the <b>Location</b> permission switch to <b>ON / Allow</b>.</li>
                </ol>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowGpsHelpModal(false)}
                >
                  Close
                </button>
                <PrimaryButton
                  type="button"
                  onClick={async () => {
                    setShowGpsHelpModal(false);
                    await checkOrRequestGps(false);
                  }}
                >
                  <MapPin size={14} /> Test / Re-request GPS Permission
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
