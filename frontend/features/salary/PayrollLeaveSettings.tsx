"use client";

import { useEffect, useState, FormEvent } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  HelpCircle,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { PrimaryButton } from "@/components/ui";

interface PayrollSettingsData {
  _id?: string;
  leaveEncashmentIntervalMonths?: number;
  lastEncashmentMonth?: number;
  lastEncashmentYear?: number;
  lastEncashmentDate?: string;
  enableQuarterlyEncashment?: boolean;
  attendanceCutoffDay?: number;
  salaryDisbursementDay?: number;
  standardSalaryDays?: number;
  standardCalendarDays?: number;
  autoRoundNetSalary?: boolean;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function PayrollLeaveSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [intervalMonths, setIntervalMonths] = useState(3);
  const [lastEncashDate, setLastEncashDate] = useState("2026-09-07");
  const [lastEncashMonth, setLastEncashMonth] = useState(9);
  const [lastEncashYear, setLastEncashYear] = useState(2026);
  const [enableEncashment, setEnableEncashment] = useState(true);
  const [cutoffDay, setCutoffDay] = useState(25);
  const [disbursementDay, setDisbursementDay] = useState(7);
  const [standardSalaryDays, setStandardSalaryDays] = useState(26);
  const [standardCalendarDays, setStandardCalendarDays] = useState(30);
  const [autoRound, setAutoRound] = useState(true);

  const loadSettings = () => {
    setLoading(true);
    setError("");
    api<{ settings: PayrollSettingsData }>("/payroll/settings/")
      .then((res) => {
        const s = res?.settings || (res as any);
        if (s) {
          setIntervalMonths(s.leaveEncashmentIntervalMonths ?? 3);
          setLastEncashDate(s.lastEncashmentDate || "2026-09-07");
          setLastEncashMonth(s.lastEncashmentMonth ?? 9);
          setLastEncashYear(s.lastEncashmentYear ?? 2026);
          setEnableEncashment(s.enableQuarterlyEncashment !== false);
          setCutoffDay(s.attendanceCutoffDay ?? 25);
          setDisbursementDay(s.salaryDisbursementDay ?? 7);
          setStandardSalaryDays(s.standardSalaryDays ?? 26);
          setStandardCalendarDays(s.standardCalendarDays ?? 30);
          setAutoRound(s.autoRoundNetSalary !== false);
        }
      })
      .catch((err: any) => {
        setError(err.message || "Failed to load payroll & leave encashment settings");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleDateChange = (newDate: string) => {
    setLastEncashDate(newDate);
    if (newDate) {
      const parts = newDate.split("-");
      if (parts.length === 3) {
        setLastEncashYear(parseInt(parts[0], 10));
        setLastEncashMonth(parseInt(parts[1], 10));
      }
    }
  };

  // Compute next scheduled encashment month & year
  const computeNextSchedule = () => {
    const totalMonths = lastEncashYear * 12 + (lastEncashMonth - 1) + intervalMonths;
    const nextYear = Math.floor(totalMonths / 12);
    const nextMonth = (totalMonths % 12) + 1;
    return {
      nextMonth,
      nextYear,
      monthName: monthNames[nextMonth - 1],
    };
  };

  const nextSchedule = computeNextSchedule();

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api("/payroll/settings/", {
        method: "PUT",
        body: JSON.stringify({
          leaveEncashmentIntervalMonths: Number(intervalMonths),
          lastEncashmentDate: lastEncashDate,
          lastEncashmentMonth: Number(lastEncashMonth),
          lastEncashmentYear: Number(lastEncashYear),
          enableQuarterlyEncashment: Boolean(enableEncashment),
          attendanceCutoffDay: Number(cutoffDay),
          salaryDisbursementDay: Number(disbursementDay),
          standardSalaryDays: Number(standardSalaryDays),
          standardCalendarDays: Number(standardCalendarDays),
          autoRoundNetSalary: Boolean(autoRound),
        }),
      });

      setSuccess("Payroll & Leave Encashment settings saved successfully!");
      toast.success("Payroll settings updated successfully");
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>
        Loading configuration...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {success && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#ECFDF5",
            border: "1px solid #A7F3D0",
            borderRadius: "8px",
            color: "#065F46",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 style={{ width: "18px", height: "18px", flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "8px",
            color: "#991B1B",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle style={{ width: "18px", height: "18px", flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Real-time Cycle Projection Card */}
      <div
        style={{
          background: "linear-gradient(135deg, #064E3B 0%, #087A5B 100%)",
          borderRadius: "12px",
          padding: "20px 24px",
          color: "#FFFFFF",
          boxShadow: "0 4px 12px rgba(6, 78, 59, 0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                padding: "3px 8px",
                borderRadius: "4px",
              }}
            >
              Quarterly Leave Encashment Projection
            </span>
            <h3 style={{ margin: "8px 0 4px", fontSize: "20px", fontWeight: 700 }}>
              Next Scheduled Encashment: {nextSchedule.monthName} {nextSchedule.nextYear}
            </h3>
            <p style={{ margin: 0, fontSize: "13px", opacity: 0.9 }}>
              Calculated from baseline date: <strong>{lastEncashDate} ({monthNames[lastEncashMonth - 1]} {lastEncashYear})</strong> with a <strong>{intervalMonths}-month gap cycle</strong>.
            </p>
          </div>

          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              padding: "12px 16px",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: "11px", opacity: 0.85 }}>Cycle Status</div>
            <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "2px" }}>
              {enableEncashment ? "Active & Enforcing" : "Disabled"}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.85, marginTop: "2px" }}>
              Every {intervalMonths} Months
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* SECTION 1: Carry Forward & Encashment Settings */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <Sliders style={{ width: "20px", height: "20px", color: "#087A5B" }} />
            <div>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                Carry Forward & Leave Encashment Rules
              </h4>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#64748B" }}>
                Configure the interval gap and baseline date from which 3-month leave conversion to salary is triggered.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {/* Enable Periodic Encashment */}
            <div style={{ gridColumn: "1 / -1", padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600, color: "#0F172A" }}>
                <input
                  type="checkbox"
                  checked={enableEncashment}
                  onChange={(e) => setEnableEncashment(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#087A5B" }}
                />
                <span>Enable Periodic Leave Encashment (Auto-convert unused carry forward leaves into salary)</span>
              </label>
            </div>

            {/* Interval Gap (Months) */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Encashment Interval (Months) <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  fontWeight: 500,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <option value={1}>Every Month (1 Month)</option>
                <option value={2}>Every 2 Months</option>
                <option value={3}>Every 3 Months (Standard Quarterly - Default)</option>
                <option value={4}>Every 4 Months</option>
                <option value={6}>Every 6 Months (Half-Yearly)</option>
                <option value={12}>Every 12 Months (Annually)</option>
              </select>
              <span style={{ fontSize: "11px", color: "#64748B", display: "block", marginTop: "4px" }}>
                Default is 3 months. Leaves roll over each month and encash after this interval.
              </span>
            </div>

            {/* Last Encashed Baseline Date */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Last Manual Encashment Date <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="date"
                value={lastEncashDate}
                onChange={(e) => handleDateChange(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                }}
              />
              <span style={{ fontSize: "11px", color: "#64748B", display: "block", marginTop: "4px" }}>
                System baseline: <strong>2026-09-07 (7 September)</strong>
              </span>
            </div>

            {/* Last Encashed Month */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Baseline Month
              </label>
              <select
                value={lastEncashMonth}
                onChange={(e) => setLastEncashMonth(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  backgroundColor: "#FFFFFF",
                }}
              >
                {monthNames.map((name, i) => (
                  <option key={name} value={i + 1}>{name} (Month {i + 1})</option>
                ))}
              </select>
            </div>

            {/* Last Encashed Year */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Baseline Year
              </label>
              <input
                type="number"
                value={lastEncashYear}
                onChange={(e) => setLastEncashYear(Number(e.target.value))}
                min={2020}
                max={2030}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: General Payroll & Attendance Cycle Settings */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <Calendar style={{ width: "20px", height: "20px", color: "#087A5B" }} />
            <div>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                Canonical Payroll Cycle & Days Configuration
              </h4>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#64748B" }}>
                Standard salary calculation days and monthly cutoff thresholds.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Attendance Cutoff Day of Month
              </label>
              <input
                type="number"
                value={cutoffDay}
                onChange={(e) => setCutoffDay(Number(e.target.value))}
                min={1}
                max={31}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
              <span style={{ fontSize: "11px", color: "#64748B", display: "block", marginTop: "4px" }}>
                Standard: 25th (Cycle: 26th of prev month → 25th of current)
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Salary Disbursement Target Day
              </label>
              <input
                type="number"
                value={disbursementDay}
                onChange={(e) => setDisbursementDay(Number(e.target.value))}
                min={1}
                max={31}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
              <span style={{ fontSize: "11px", color: "#64748B", display: "block", marginTop: "4px" }}>
                Target payout date (e.g. 7th of following month)
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Standard Salary Days (Working Pool)
              </label>
              <input
                type="number"
                value={standardSalaryDays}
                onChange={(e) => setStandardSalaryDays(Number(e.target.value))}
                min={20}
                max={31}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
              <span style={{ fontSize: "11px", color: "#64748B", display: "block", marginTop: "4px" }}>
                Standard: 26 days (excluding Sundays)
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Per-Day Pay Calculation Divisor
              </label>
              <input
                type="number"
                value={standardCalendarDays}
                onChange={(e) => setStandardCalendarDays(Number(e.target.value))}
                min={26}
                max={31}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
              <span style={{ fontSize: "11px", color: "#64748B", display: "block", marginTop: "4px" }}>
                Standard: 30 days for daily rate calculation
              </span>
            </div>

            <div style={{ gridColumn: "1 / -1", padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600, color: "#0F172A" }}>
                <input
                  type="checkbox"
                  checked={autoRound}
                  onChange={(e) => setAutoRound(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#087A5B" }}
                />
                <span>Auto-Round Final Net Salary (Round up decimal paisa to nearest whole rupee)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={loadSettings}
            style={{
              padding: "10px 18px",
              backgroundColor: "#F1F5F9",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13.5px",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            Reset
          </button>
          <PrimaryButton type="submit" disabled={saving}>
            <Save style={{ width: "16px", height: "16px", marginRight: "6px" }} />
            {saving ? "Saving Configuration..." : "Save Payroll Settings"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
