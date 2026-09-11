"use client";

import React, { useState, useMemo } from "react";
import { Calculator, Copy, Receipt } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function GstTaxCalculatorTool() {
  const [mode, setMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [amount, setAmount] = useState<number>(50000);
  const [gstRate, setGstRate] = useState<number>(18);
  const [taxType, setTaxType] = useState<"intra" | "inter">("intra"); // Intra-state (CGST+SGST) vs Inter-state (IGST)

  const calculation = useMemo(() => {
    const val = Math.max(0, amount || 0);
    const rate = Math.max(0, gstRate || 0);

    let baseAmount = 0;
    let gstAmount = 0;
    let totalAmount = 0;

    if (mode === "exclusive") {
      // Amount is Base Price, Add GST
      baseAmount = val;
      gstAmount = (val * rate) / 100;
      totalAmount = baseAmount + gstAmount;
    } else {
      // Amount is Total Inclusive Price, Extract Base & GST
      totalAmount = val;
      baseAmount = val / (1 + rate / 100);
      gstAmount = totalAmount - baseAmount;
    }

    const cgst = taxType === "intra" ? gstAmount / 2 : 0;
    const sgst = taxType === "intra" ? gstAmount / 2 : 0;
    const igst = taxType === "inter" ? gstAmount : 0;

    return {
      baseAmount,
      gstAmount,
      totalAmount,
      cgst,
      sgst,
      igst,
    };
  }, [mode, amount, gstRate, taxType]);

  const copyInvoiceSummary = () => {
    const text = `GST Tax Breakdown:
Base Price: ₹${calculation.baseAmount.toFixed(2)}
GST (${gstRate}%): ₹${calculation.gstAmount.toFixed(2)}
${taxType === "intra" ? `CGST (${gstRate / 2}%): ₹${calculation.cgst.toFixed(2)}\nSGST (${gstRate / 2}%): ₹${calculation.sgst.toFixed(2)}` : `IGST (${gstRate}%): ₹${calculation.igst.toFixed(2)}`}
Total Invoice Amount: ₹${calculation.totalAmount.toFixed(2)}`;
    navigator.clipboard.writeText(text);
    toast.success("GST breakdown copied for invoice!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        {/* Mode Toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => setMode("exclusive")}
            className={`tool-dept-pill ${mode === "exclusive" ? "active" : ""}`}
            style={{ flex: 1, textAlign: "center" }}
          >
            GST Exclusive (Add GST)
          </button>
          <button
            type="button"
            onClick={() => setMode("inclusive")}
            className={`tool-dept-pill ${mode === "inclusive" ? "active" : ""}`}
            style={{ flex: 1, textAlign: "center" }}
          >
            GST Inclusive (Reverse GST)
          </button>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">
            {mode === "exclusive" ? "Net / Base Amount (₹)" : "Gross Total Amount (₹)"}
          </label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="tool-input"
            style={{ fontSize: "1.15rem", fontFamily: "var(--tools-font-mono)" }}
          />
        </div>

        {/* GST Slab Selector */}
        <div className="tool-field-group">
          <label className="tool-label">GST Tax Slab</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", marginBottom: "8px" }}>
            {[0, 5, 12, 18, 28].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setGstRate(rate)}
                className={`tool-cat-pill ${gstRate === rate ? "active" : ""}`}
                style={{ textAlign: "center", padding: "8px" }}
              >
                {rate}%
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--tools-text-muted)" }}>Custom GST Rate:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value))}
              className="tool-input"
              style={{ width: "80px", padding: "6px" }}
            />
            <span style={{ fontSize: "0.85rem" }}>%</span>
          </div>
        </div>

        {/* Tax Jurisdiction */}
        <div className="tool-field-group">
          <label className="tool-label">Supply Jurisdiction</label>
          <div style={{ display: "flex", gap: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.88rem" }}>
              <input
                type="radio"
                name="taxType"
                checked={taxType === "intra"}
                onChange={() => setTaxType("intra")}
                style={{ accentColor: "var(--tools-primary)" }}
              />
              <span>Intra-State (CGST + SGST)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.88rem" }}>
              <input
                type="radio"
                name="taxType"
                checked={taxType === "inter"}
                onChange={() => setTaxType("inter")}
                style={{ accentColor: "var(--tools-primary)" }}
              />
              <span>Inter-State (IGST)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Tax Invoice Ledger</span>
          <button type="button" onClick={copyInvoiceSummary} className="tool-btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
            <Copy size={13} />
            <span>Copy Breakdown</span>
          </button>
        </div>

        <div
          style={{
            padding: "20px",
            backgroundColor: "var(--tools-surface)",
            borderRadius: "12px",
            border: "1px solid var(--tools-border)",
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", textTransform: "uppercase" }}>
            Total Invoice Payable
          </div>
          <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--tools-primary)", margin: "4px 0" }}>
            ₹{calculation.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--tools-text-secondary)" }}>
            Includes ₹{calculation.gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GST ({gstRate}%)
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--tools-text-muted)" }}>Net Base Amount:</span>
            <b>₹{calculation.baseAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--tools-text-muted)" }}>Total GST ({gstRate}%):</span>
            <b style={{ color: "#D97706" }}>₹{calculation.gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </div>

          {taxType === "intra" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "6px", fontSize: "0.82rem" }}>
                <span>• Central GST (CGST @ {gstRate / 2}%):</span>
                <span>₹{calculation.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "6px", fontSize: "0.82rem" }}>
                <span>• State GST (SGST @ {gstRate / 2}%):</span>
                <span>₹{calculation.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "6px", fontSize: "0.82rem" }}>
              <span>• Integrated GST (IGST @ {gstRate}%):</span>
              <span>₹{calculation.igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
