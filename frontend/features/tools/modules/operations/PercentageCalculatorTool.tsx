"use client";

import React, { useState } from "react";
import { Percent, ArrowRight, Copy } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function PercentageCalculatorTool() {
  // Mode 1: What is X% of Y?
  const [m1X, setM1X] = useState<number>(15);
  const [m1Y, setM1Y] = useState<number>(500);

  // Mode 2: X is what percent of Y?
  const [m2X, setM2X] = useState<number>(75);
  const [m2Y, setM2Y] = useState<number>(300);

  // Mode 3: Percentage change from X to Y
  const [m3X, setM3X] = useState<number>(200);
  const [m3Y, setM3Y] = useState<number>(260);

  // Calculations
  const m1Result = (m1X * m1Y) / 100;
  const m2Result = m2Y !== 0 ? ((m2X / m2Y) * 100).toFixed(2) : "0";
  const m3Diff = m3Y - m3X;
  const m3Result = m3X !== 0 ? ((m3Diff / m3X) * 100).toFixed(2) : "0";
  const isIncrease = m3Diff >= 0;

  const copyVal = (val: string | number) => {
    navigator.clipboard.writeText(val.toString());
    toast.success("Result copied!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Card 1: What is X% of Y? */}
      <div style={{ padding: "20px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "12px", border: "1px solid var(--tools-border)" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--tools-primary)", textTransform: "uppercase", marginBottom: "12px" }}>
          1. Direct Percentage (What is X% of Y?)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
          <span>What is</span>
          <input
            type="number"
            value={m1X}
            onChange={(e) => setM1X(Number(e.target.value))}
            className="tool-input"
            style={{ width: "90px" }}
          />
          <span>% of</span>
          <input
            type="number"
            value={m1Y}
            onChange={(e) => setM1Y(Number(e.target.value))}
            className="tool-input"
            style={{ width: "120px" }}
          />
          <ArrowRight size={16} style={{ color: "var(--tools-text-muted)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--tools-primary)" }}>
              {m1Result.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => copyVal(m1Result)}
              className="tool-btn-secondary"
              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: X is what percent of Y? */}
      <div style={{ padding: "20px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "12px", border: "1px solid var(--tools-border)" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--tools-primary)", textTransform: "uppercase", marginBottom: "12px" }}>
          2. Proportion (X is what % of Y?)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
          <input
            type="number"
            value={m2X}
            onChange={(e) => setM2X(Number(e.target.value))}
            className="tool-input"
            style={{ width: "100px" }}
          />
          <span>is what % of</span>
          <input
            type="number"
            value={m2Y}
            onChange={(e) => setM2Y(Number(e.target.value))}
            className="tool-input"
            style={{ width: "120px" }}
          />
          <ArrowRight size={16} style={{ color: "var(--tools-text-muted)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--tools-primary)" }}>
              {m2Result}%
            </span>
            <button
              type="button"
              onClick={() => copyVal(`${m2Result}%`)}
              className="tool-btn-secondary"
              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: Percentage increase / decrease */}
      <div style={{ padding: "20px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "12px", border: "1px solid var(--tools-border)" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--tools-primary)", textTransform: "uppercase", marginBottom: "12px" }}>
          3. Percentage Change (Increase / Decrease)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
          <span>From</span>
          <input
            type="number"
            value={m3X}
            onChange={(e) => setM3X(Number(e.target.value))}
            className="tool-input"
            style={{ width: "110px" }}
          />
          <span>to</span>
          <input
            type="number"
            value={m3Y}
            onChange={(e) => setM3Y(Number(e.target.value))}
            className="tool-input"
            style={{ width: "110px" }}
          />
          <ArrowRight size={16} style={{ color: "var(--tools-text-muted)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "1.4rem",
                fontWeight: 800,
                color: isIncrease ? "#10B981" : "#EF4444",
              }}
            >
              {isIncrease ? `+${m3Result}%` : `${m3Result}%`}
            </span>
            <button
              type="button"
              onClick={() => copyVal(m3Result)}
              className="tool-btn-secondary"
              style={{ padding: "4px 8px", fontSize: "0.75rem" }}
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--tools-text-muted)", marginTop: "10px" }}>
          Absolute change: <b>{m3Diff > 0 ? `+${m3Diff}` : m3Diff}</b>
        </div>
      </div>
    </div>
  );
}
