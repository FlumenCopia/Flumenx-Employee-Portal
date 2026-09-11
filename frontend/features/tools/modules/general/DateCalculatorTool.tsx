"use client";

import React, { useState, useMemo } from "react";
import { Calendar, Plus, Minus, Calculator } from "lucide-react";

export function DateCalculatorTool() {
  const [tab, setTab] = useState<"diff" | "addsub" | "workdays">("diff");

  // Diff state
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 45);
    return d.toISOString().slice(0, 10);
  });

  // Add/Subtract state
  const [baseDate, setBaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [opType, setOpType] = useState<"add" | "sub">("add");
  const [amount, setAmount] = useState(30);
  const [unit, setUnit] = useState<"days" | "weeks" | "months" | "years">("days");

  // Working days state
  const [workStart, setWorkStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [workEnd, setWorkEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // Calculate difference
  const diffResult = useMemo(() => {
    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;

    const diffMs = Math.abs(d2.getTime() - d1.getTime());
    const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const totalWeeks = (totalDays / 7).toFixed(1);
    const totalHours = totalDays * 24;

    // Years and months estimation
    let years = d2.getFullYear() - d1.getFullYear();
    let months = d2.getMonth() - d1.getMonth();
    let days = d2.getDate() - d1.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(d2.getFullYear(), d2.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return {
      totalDays,
      totalWeeks,
      totalHours,
      formatted: `${Math.abs(years)} years, ${Math.abs(months)} months, ${Math.abs(days)} days`,
    };
  }, [startDate, endDate]);

  // Calculate Add/Sub
  const addSubResult = useMemo(() => {
    const d = new Date(baseDate);
    if (isNaN(d.getTime())) return null;
    const factor = opType === "add" ? 1 : -1;

    if (unit === "days") d.setDate(d.getDate() + factor * amount);
    if (unit === "weeks") d.setDate(d.getDate() + factor * amount * 7);
    if (unit === "months") d.setMonth(d.getMonth() + factor * amount);
    if (unit === "years") d.setFullYear(d.getFullYear() + factor * amount);

    return {
      iso: d.toISOString().slice(0, 10),
      formatted: d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    };
  }, [baseDate, opType, amount, unit]);

  // Calculate Working Days
  const workdaysResult = useMemo(() => {
    const d1 = new Date(workStart);
    const d2 = new Date(workEnd);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;

    let start = d1 < d2 ? new Date(d1) : new Date(d2);
    const end = d1 < d2 ? new Date(d2) : new Date(d1);

    let total = 0;
    let working = 0;
    let weekends = 0;

    while (start <= end) {
      total++;
      const day = start.getDay();
      if (day === 0 || day === 6) {
        weekends++;
      } else {
        working++;
      }
      start.setDate(start.getDate() + 1);
    }

    return { total, working, weekends };
  }, [workStart, workEnd]);

  return (
    <div>
      {/* Tab Switcher */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => setTab("diff")}
          className={`tool-dept-pill ${tab === "diff" ? "active" : ""}`}
        >
          Days Between Dates
        </button>
        <button
          type="button"
          onClick={() => setTab("addsub")}
          className={`tool-dept-pill ${tab === "addsub" ? "active" : ""}`}
        >
          Add / Subtract Days
        </button>
        <button
          type="button"
          onClick={() => setTab("workdays")}
          className={`tool-dept-pill ${tab === "workdays" ? "active" : ""}`}
        >
          Working Days Calculator
        </button>
      </div>

      {tab === "diff" && (
        <div className="tool-two-col">
          <div className="tool-controls-panel">
            <div className="tool-field-group">
              <label className="tool-label">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="tool-input" />
            </div>
            <div className="tool-field-group">
              <label className="tool-label">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="tool-input" />
            </div>
          </div>

          <div className="tool-output-panel">
            <div className="tool-output-header">
              <span className="tool-output-title">Duration Breakdown</span>
            </div>
            {diffResult && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ padding: "14px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Total Days</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--tools-primary)" }}>{diffResult.totalDays}</div>
                </div>
                <div style={{ padding: "14px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Total Weeks</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{diffResult.totalWeeks}</div>
                </div>
                <div style={{ padding: "14px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Total Hours</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{diffResult.totalHours} hrs</div>
                </div>
                <div style={{ padding: "14px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Detailed Split</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: "4px" }}>{diffResult.formatted}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "addsub" && (
        <div className="tool-two-col">
          <div className="tool-controls-panel">
            <div className="tool-field-group">
              <label className="tool-label">Start Date</label>
              <input type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} className="tool-input" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div className="tool-field-group">
                <label className="tool-label">Operation</label>
                <select value={opType} onChange={(e) => setOpType(e.target.value as any)} className="tool-select">
                  <option value="add">Add (+)</option>
                  <option value="sub">Subtract (-)</option>
                </select>
              </div>

              <div className="tool-field-group">
                <label className="tool-label">Amount</label>
                <input type="number" min="1" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="tool-input" />
              </div>

              <div className="tool-field-group">
                <label className="tool-label">Unit</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value as any)} className="tool-select">
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          </div>

          <div className="tool-output-panel">
            <div className="tool-output-header">
              <span className="tool-output-title">Resulting Date</span>
            </div>
            {addSubResult && (
              <div style={{ padding: "20px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", marginBottom: "6px" }}>Calculated Target Date:</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--tools-primary)", marginBottom: "6px" }}>{addSubResult.formatted}</div>
                <div style={{ fontFamily: "var(--tools-font-mono)", fontSize: "0.95rem", color: "var(--tools-text-secondary)" }}>ISO: {addSubResult.iso}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "workdays" && (
        <div className="tool-two-col">
          <div className="tool-controls-panel">
            <div className="tool-field-group">
              <label className="tool-label">Start Date</label>
              <input type="date" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="tool-input" />
            </div>
            <div className="tool-field-group">
              <label className="tool-label">End Date</label>
              <input type="date" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="tool-input" />
            </div>
          </div>

          <div className="tool-output-panel">
            <div className="tool-output-header">
              <span className="tool-output-title">Business Days Analysis</span>
            </div>
            {workdaysResult && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Working Days (Mon-Fri)</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#10B981" }}>{workdaysResult.working}</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Weekend Days (Sat-Sun)</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#F59E0B" }}>{workdaysResult.weekends}</div>
                </div>
                <div style={{ gridColumn: "span 2", padding: "12px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--tools-text-secondary)" }}>
                    Total Calendar Days: <b>{workdaysResult.total}</b>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
