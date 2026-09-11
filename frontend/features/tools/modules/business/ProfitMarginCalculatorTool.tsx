"use client";

import React, { useState, useMemo } from "react";
import { TrendingUp, Copy } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function ProfitMarginCalculatorTool() {
  const [cost, setCost] = useState<number>(4500);
  const [revenue, setRevenue] = useState<number>(7500);

  // Target solver state
  const [targetMargin, setTargetMargin] = useState<number>(40);

  const analysis = useMemo(() => {
    const c = Math.max(0, cost || 0);
    const r = Math.max(0, revenue || 0);
    const profit = r - c;
    const margin = r > 0 ? (profit / r) * 100 : 0;
    const markup = c > 0 ? (profit / c) * 100 : 0;

    // Target selling price calculation: Price = Cost / (1 - (TargetMargin / 100))
    const targetPrice = targetMargin < 100 ? c / (1 - targetMargin / 100) : 0;

    return {
      profit,
      margin: margin.toFixed(2),
      markup: markup.toFixed(2),
      targetPrice: targetPrice.toFixed(2),
    };
  }, [cost, revenue, targetMargin]);

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Cost of Goods / Service (₹)</label>
          <input
            type="number"
            min="0"
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
            className="tool-input"
            style={{ fontSize: "1.1rem" }}
          />
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Selling / Retail Price (₹)</label>
          <input
            type="number"
            min="0"
            value={revenue}
            onChange={(e) => setRevenue(Number(e.target.value))}
            className="tool-input"
            style={{ fontSize: "1.1rem" }}
          />
        </div>

        {/* Target Margin Solver */}
        <div style={{ padding: "16px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "10px", border: "1px solid var(--tools-border)", marginTop: "24px" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px" }}>
            Target Price Solver
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", marginBottom: "12px" }}>
            Calculate required selling price based on desired margin %
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem" }}>Desired Margin:</span>
            <input
              type="number"
              min="0"
              max="99"
              value={targetMargin}
              onChange={(e) => setTargetMargin(Number(e.target.value))}
              className="tool-input"
              style={{ width: "80px" }}
            />
            <span style={{ fontSize: "0.85rem" }}>%</span>
          </div>
          <div style={{ marginTop: "12px", fontSize: "0.88rem" }}>
            Required Price: <b style={{ color: "var(--tools-primary)" }}>₹{Number(analysis.targetPrice).toLocaleString("en-IN")}</b>
          </div>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Profitability Analysis</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Gross Profit</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: analysis.profit >= 0 ? "var(--tools-primary)" : "#EF4444" }}>
              ₹{analysis.profit.toLocaleString("en-IN")}
            </div>
          </div>

          <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Profit Margin</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: Number(analysis.margin) >= 0 ? "#10B981" : "#EF4444" }}>
              {analysis.margin}%
            </div>
          </div>

          <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)", gridColumn: "span 2" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Markup Percentage (Profit / Cost)</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>
              {analysis.markup}%
            </div>
          </div>
        </div>

        <div style={{ padding: "12px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontSize: "0.82rem", color: "var(--tools-text-secondary)" }}>
          <b>Margin vs Markup Difference:</b> Margin is percentage of selling price that is profit. Markup is the percentage added on top of cost.
        </div>
      </div>
    </div>
  );
}
