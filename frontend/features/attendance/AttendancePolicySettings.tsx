"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, Save, ShieldAlert, CheckCircle2, RotateCw, ExternalLink, Navigation, Compass } from "lucide-react";
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

const HQ_LATITUDE = 8.5213442;
const HQ_LONGITUDE = 76.97848305555556;
const HQ_RADIUS_DEFAULT = 200;

const DEFAULT_POLICY: AttendancePolicy = {
  officeStartTime: "09:30",
  officeEndTime: "18:30",
  gracePeriodMinutes: 5,
  earlyCheckoutHalfDayCutoff: "18:00",
  halfDayHours: 4,
  fullDayHours: 8,
  officeLatitude: HQ_LATITUDE,
  officeLongitude: HQ_LONGITUDE,
  allowedRadiusMeters: HQ_RADIUS_DEFAULT,
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

  const handleSetHQCoordinates = () => {
    setPolicy((prev) => ({
      ...prev,
      officeLatitude: HQ_LATITUDE,
      officeLongitude: HQ_LONGITUDE,
    }));
    setMessage({
      type: "success",
      text: "Applied FLUMENX HQ Coordinates (Karithode Lane, Sasthamangalam, Thiruvananthapuram). Click 'Save Settings' to apply.",
    });
  };

  const handleGetCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPolicy((prev) => ({
            ...prev,
            officeLatitude: Number(pos.coords.latitude.toFixed(7)),
            officeLongitude: Number(pos.coords.longitude.toFixed(7)),
          }));
          setMessage({ type: "success", text: "Acquired current device GPS coordinates! Remember to save settings." });
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

  const googleMapsUrl = `https://www.google.com/maps?q=${policy.officeLatitude},${policy.officeLongitude}`;

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
        subtitle="Configure office GPS coordinates, geofence radius perimeter, working hours, and half-day cutoff policies."
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
        <div className="card" style={{ background: "var(--panel)", padding: "24px", borderRadius: "14px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "rgba(8, 122, 91, 0.15)", padding: "10px", borderRadius: "10px", color: "var(--brand-primary, #087A5B)" }}>
                <MapPin size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  Office GPS Location &amp; Geo-Fence Radius
                </h3>
                <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "2px 0 0" }}>
                  Employees must be physically within this radius from office coordinates to check-in.
                </p>
              </div>
            </div>

            {/* Google Maps Link */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "var(--panel2)",
                border: "1px solid var(--border)",
                color: "#087A5B",
                fontSize: "12px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <Compass size={14} />
              <span>Verify Pin in Google Maps</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Quick Preset Location Bar */}
          <div style={{ background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Navigation size={16} color="#087A5B" />
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text)" }}>
                HQ Location: <b>Karithode Lane, Sasthamangalam, Thiruvananthapuram</b>
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleSetHQCoordinates}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "#087A5B",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                📍 Apply Sasthamangalam HQ ({HQ_LATITUDE}, {HQ_LONGITUDE.toFixed(4)})
              </button>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "var(--panel)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                📡 Use Device GPS
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Office Latitude
              <input
                type="number"
                step="any"
                value={policy.officeLatitude}
                onChange={(e) => setPolicy({ ...policy, officeLatitude: parseFloat(e.target.value) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Office Longitude
              <input
                type="number"
                step="any"
                value={policy.officeLongitude}
                onChange={(e) => setPolicy({ ...policy, officeLongitude: parseFloat(e.target.value) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Allowed Radius (Meters)
              <input
                type="number"
                min="10"
                max="5000"
                value={policy.allowedRadiusMeters}
                onChange={(e) => setPolicy({ ...policy, allowedRadiusMeters: parseInt(e.target.value, 10) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>
          </div>

          {/* Quick Radius Preset Chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Quick Radius Presets:</span>
            {[
              { m: 50, label: "50m (Strict)" },
              { m: 100, label: "100m (Standard)" },
              { m: 200, label: "200m (Recommended)" },
              { m: 300, label: "300m" },
              { m: 500, label: "500m (Wide)" },
              { m: 1000, label: "1000m (1 KM)" },
            ].map(({ m, label }) => {
              const isSelected = policy.allowedRadiusMeters === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPolicy({ ...policy, allowedRadiusMeters: m })}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: isSelected ? "1px solid #087A5B" : "1px solid var(--border)",
                    background: isSelected ? "rgba(8, 122, 91, 0.15)" : "var(--panel2)",
                    color: isSelected ? "#087A5B" : "var(--text)",
                    fontSize: "12px",
                    fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* WORK TIMINGS & GRACE PERIOD */}
        <div className="card" style={{ background: "var(--panel)", padding: "24px", borderRadius: "14px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <div style={{ background: "rgba(8, 122, 91, 0.15)", padding: "10px", borderRadius: "10px", color: "var(--brand-primary, #087A5B)" }}>
              <Clock size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Work Timings &amp; Grace Period
              </h3>
              <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "2px 0 0" }}>
                Configure shift start/end times and late check-in rules.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Work Start Time
              <input
                type="time"
                value={policy.officeStartTime}
                onChange={(e) => setPolicy({ ...policy, officeStartTime: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Work End Time
              <input
                type="time"
                value={policy.officeEndTime}
                onChange={(e) => setPolicy({ ...policy, officeEndTime: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Grace Period (Minutes)
              <input
                type="number"
                value={policy.gracePeriodMinutes}
                onChange={(e) => setPolicy({ ...policy, gracePeriodMinutes: parseInt(e.target.value, 10) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Early Checkout Cutoff
              <input
                type="time"
                value={policy.earlyCheckoutHalfDayCutoff}
                onChange={(e) => setPolicy({ ...policy, earlyCheckoutHalfDayCutoff: e.target.value })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Full Day Required Hours
              <input
                type="number"
                value={policy.fullDayHours}
                onChange={(e) => setPolicy({ ...policy, fullDayHours: parseFloat(e.target.value) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Half Day Required Hours
              <input
                type="number"
                value={policy.halfDayHours}
                onChange={(e) => setPolicy({ ...policy, halfDayHours: parseFloat(e.target.value) || 0 })}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", fontSize: "14px", fontWeight: 600 }}
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
                <Save size={16} /> Save Attendance Policy &amp; Geo-Fence Settings
              </>
            )}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
