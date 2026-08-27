"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, Save, ShieldAlert, CheckCircle2, RotateCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader, PrimaryButton } from "@/components/ui";

type AttendancePolicy = {
  id?: string;
  officeStartTime: string;
  officeEndTime: string;
  gracePeriodMinutes: number;
  earlyCheckoutHalfDayCutoff: string;
  halfDayHours: number;
  fullDayHours: number;
  officeLatitude: number;
  officeLongitude: number;
  allowedRadiusMeters: number;
  activeQrReference: string;
};

const DEFAULT_POLICY: AttendancePolicy = {
  officeStartTime: "09:30",
  officeEndTime: "18:30",
  gracePeriodMinutes: 5,
  earlyCheckoutHalfDayCutoff: "18:00",
  halfDayHours: 4,
  fullDayHours: 8,
  officeLatitude: 9.9312328,
  officeLongitude: 76.2673041,
  allowedRadiusMeters: 500,
  activeQrReference: "FLUMENX-HQ",
};

export function AttendancePolicySettings() {
  const [policy, setPolicy] = useState<AttendancePolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPolicy = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await api<AttendancePolicy>("/attendance-policy/");
      if (data) {
        setPolicy({
          ...DEFAULT_POLICY,
          ...data,
          officeLatitude: Number(data.officeLatitude || DEFAULT_POLICY.officeLatitude),
          officeLongitude: Number(data.officeLongitude || DEFAULT_POLICY.officeLongitude),
          allowedRadiusMeters: Number(data.allowedRadiusMeters || DEFAULT_POLICY.allowedRadiusMeters),
          gracePeriodMinutes: Number(data.gracePeriodMinutes || DEFAULT_POLICY.gracePeriodMinutes),
          halfDayHours: Number(data.halfDayHours || DEFAULT_POLICY.halfDayHours),
          fullDayHours: Number(data.fullDayHours || DEFAULT_POLICY.fullDayHours),
        });
      }
    } catch (err) {
      console.error("Failed to load attendance policy", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleGetCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPolicy((prev) => ({
            ...prev,
            officeLatitude: Number(pos.coords.latitude.toFixed(7)),
            officeLongitude: Number(pos.coords.longitude.toFixed(7)),
          }));
          setMessage({ type: "success", text: "Acquired current GPS location successfully!" });
        },
        (err) => {
          setMessage({ type: "error", text: `GPS location error: ${err.message}` });
        },
        { enableHighAccuracy: true }
      );
    } else {
      setMessage({ type: "error", text: "Geolocation is not supported by your browser." });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api("/attendance-policy/", {
        method: "PUT",
        body: JSON.stringify(policy),
      });
      setMessage({ type: "success", text: "Attendance policy & Geo-fence settings saved successfully!" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : "Failed to update attendance policy.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell" style={{ padding: "32px", textAlign: "center" }}>
        <RotateCw className="animate-spin" size={24} style={{ margin: "0 auto 12px" }} />
        <p style={{ color: "var(--muted)", fontWeight: 600 }}>Loading Attendance Policy Settings...</p>
      </div>
    );
  }

  return (
    <div className="page-shell" style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}>
      <PageHeader
        title="Attendance & Geo-Fence Settings"
        subtitle="Manage office location coordinates, geofence radius, working hours, and grace periods."
      />

      {message && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "10px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
            fontWeight: 600,
            background: message.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: message.type === "success" ? "#10b981" : "#ef4444",
            border: `1px solid ${message.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          }}
        >
          {message.type === "success" ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* OFFICE LOCATION & GEOFENCE */}
        <div className="card" style={{ background: "var(--card-bg, #ffffff)", padding: "24px", borderRadius: "14px", border: "1px solid var(--border-color, #e2e8f0)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <div style={{ background: "rgba(8, 122, 91, 0.1)", padding: "8px", borderRadius: "8px", color: "var(--brand-primary, #087A5B)" }}>
              <MapPin size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Office Location & Geo-Fence Radius</h3>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>Set office coordinates for employee mobile check-in verification.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Office Latitude
              <input
                type="number"
                step="any"
                value={policy.officeLatitude}
                onChange={(e) => setPolicy({ ...policy, officeLatitude: parseFloat(e.target.value) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Office Longitude
              <input
                type="number"
                step="any"
                value={policy.officeLongitude}
                onChange={(e) => setPolicy({ ...policy, officeLongitude: parseFloat(e.target.value) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Allowed Radius (Meters)
              <input
                type="number"
                value={policy.allowedRadiusMeters}
                onChange={(e) => setPolicy({ ...policy, allowedRadiusMeters: parseInt(e.target.value, 10) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleGetCurrentLocation}
            className="secondary-button"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "1px solid var(--border-color, #cbd5e1)", background: "var(--subtle-bg, #f8fafc)", cursor: "pointer" }}
          >
            <MapPin size={16} /> Get Current Browser GPS Coordinates
          </button>
        </div>

        {/* WORK TIMINGS & GRACE PERIOD */}
        <div className="card" style={{ background: "var(--card-bg, #ffffff)", padding: "24px", borderRadius: "14px", border: "1px solid var(--border-color, #e2e8f0)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <div style={{ background: "rgba(8, 122, 91, 0.1)", padding: "8px", borderRadius: "8px", color: "var(--brand-primary, #087A5B)" }}>
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>Work Timings & Grace Period</h3>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>Configure shift start/end times and late check-in rules.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Work Start Time
              <input
                type="time"
                value={policy.officeStartTime}
                onChange={(e) => setPolicy({ ...policy, officeStartTime: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Work End Time
              <input
                type="time"
                value={policy.officeEndTime}
                onChange={(e) => setPolicy({ ...policy, officeEndTime: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Grace Period (Minutes)
              <input
                type="number"
                value={policy.gracePeriodMinutes}
                onChange={(e) => setPolicy({ ...policy, gracePeriodMinutes: parseInt(e.target.value, 10) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Early Checkout Cutoff
              <input
                type="time"
                value={policy.earlyCheckoutHalfDayCutoff}
                onChange={(e) => setPolicy({ ...policy, earlyCheckoutHalfDayCutoff: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Full Day Required Hours
              <input
                type="number"
                value={policy.fullDayHours}
                onChange={(e) => setPolicy({ ...policy, fullDayHours: parseFloat(e.target.value) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
              Half Day Required Hours
              <input
                type="number"
                value={policy.halfDayHours}
                onChange={(e) => setPolicy({ ...policy, halfDayHours: parseFloat(e.target.value) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? (
              <>
                <RotateCw className="animate-spin" size={16} /> Saving Policy...
              </>
            ) : (
              <>
                <Save size={16} /> Save Attendance Policy & Geo-Fence
              </>
            )}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
