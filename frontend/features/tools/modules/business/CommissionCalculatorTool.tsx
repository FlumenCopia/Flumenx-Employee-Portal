"use client";

import React, { useState, useMemo } from "react";
import { Coins, Copy } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function CommissionCalculatorTool() {
  const [salesAmount, setSalesAmount] = useState<number>(250000);
  const [commissionRate, setCommissionRate] = useState<number>(7.5);
  const [baseSalary, setBaseSalary] = useState<number>(35000);

  const calc = useMemo(() => {
    const s = Math.max(0, salesAmount || 0);
    const rate = Math.max(0, commissionRate || 0);
    const base = Math.max(0, baseSalary || 0);

    const comm = (s * rate) / 100;
    const total = base + comm;

    return {
      commission: comm,
      totalEarnings: total,
    };
  }, [salesAmount, commissionRate, baseSalary]);

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Total Sales Volume / Deal Amount (₹)</label>
          <input
            type="number"
            min="0"
            value={salesAmount}
            onChange={(e) => setSalesAmount(Number(e.target.value))}
            className="tool-input"
            style={{ fontSize: "1.1rem" }}
          />
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Commission Rate (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={commissionRate}
            onChange={(e) => setCommissionRate(Number(e.target.value))}
            className="tool-input"
          />
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Base Monthly Salary (₹, Optional)</label>
          <input
            type="number"
            min="0"
            value={baseSalary}
            onChange={(e) => setBaseSalary(Number(e.target.value))}
            className="tool-input"
          />
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Earnings Summary</span>
        </div>

        <div
          style={{
            padding: "24px",
            backgroundColor: "var(--tools-surface)",
            borderRadius: "12px",
            border: "1px solid var(--tools-border)",
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", textTransform: "uppercase" }}>
            Total Net Payout
          </div>
          <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--tools-primary)", margin: "4px 0" }}>
            ₹{calc.totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--tools-text-secondary)" }}>
            Base Salary + Commission Split
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontSize: "0.9rem" }}>
            <span style={{ color: "var(--tools-text-muted)" }}>Commission Earned ({commissionRate}%):</span>
            <b style={{ color: "#10B981" }}>+₹{calc.commission.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontSize: "0.9rem" }}>
            <span style={{ color: "var(--tools-text-muted)" }}>Base Salary:</span>
            <b>₹{baseSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
