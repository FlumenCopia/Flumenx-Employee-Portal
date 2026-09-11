"use client";

import React, { useState, useMemo } from "react";
import { Tag, Copy } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function DiscountCalculatorTool() {
  const [originalPrice, setOriginalPrice] = useState<number>(10000);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState<number>(20);
  const [taxPercent, setTaxPercent] = useState<number>(18); // e.g. 18% GST

  const calculation = useMemo(() => {
    const orig = Math.max(0, originalPrice || 0);
    let discAmt = 0;
    if (discountType === "percent") {
      discAmt = (orig * Math.min(100, Math.max(0, discountValue || 0))) / 100;
    } else {
      discAmt = Math.min(orig, Math.max(0, discountValue || 0));
    }

    const priceAfterDiscount = orig - discAmt;
    const taxAmt = (priceAfterDiscount * Math.max(0, taxPercent || 0)) / 100;
    const finalPrice = priceAfterDiscount + taxAmt;
    const effectiveDiscountPercent = orig > 0 ? ((orig - priceAfterDiscount) / orig) * 100 : 0;

    return {
      discountAmount: discAmt,
      priceAfterDiscount,
      taxAmount: taxAmt,
      finalPrice,
      effectiveDiscountPercent: effectiveDiscountPercent.toFixed(1),
    };
  }, [originalPrice, discountType, discountValue, taxPercent]);

  const copyVal = (val: number, label: string) => {
    navigator.clipboard.writeText(val.toFixed(2));
    toast.success(`Copied ${label}!`);
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Original Price</label>
          <input
            type="number"
            min="0"
            value={originalPrice}
            onChange={(e) => setOriginalPrice(Number(e.target.value))}
            className="tool-input"
            style={{ fontSize: "1.1rem" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div className="tool-field-group">
            <label className="tool-label">Discount Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as any)}
              className="tool-select"
            >
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>

          <div className="tool-field-group">
            <label className="tool-label">
              Discount {discountType === "percent" ? "(%)" : "(Amount)"}
            </label>
            <input
              type="number"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
              className="tool-input"
            />
          </div>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Optional Tax / GST (%)</label>
          <input
            type="number"
            min="0"
            value={taxPercent}
            onChange={(e) => setTaxPercent(Number(e.target.value))}
            className="tool-input"
          />
          <span className="tool-help-text">Standard rates: 0%, 5%, 12%, 18%, 28%</span>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Pricing Breakdown</span>
        </div>

        {/* Final Price Card */}
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
            Final Payable Price
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--tools-primary)", margin: "4px 0" }}>
            ₹{calculation.finalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#10B981", fontWeight: 600 }}>
            You save ₹{calculation.discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({calculation.effectiveDiscountPercent}% off)
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--tools-text-muted)" }}>Original Price:</span>
            <b>₹{originalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--tools-text-muted)" }}>Total Discount:</span>
            <b style={{ color: "#EF4444" }}>-₹{calculation.discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontSize: "0.88rem" }}>
            <span style={{ color: "var(--tools-text-muted)" }}>Price After Discount:</span>
            <b>₹{calculation.priceAfterDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
          </div>

          {taxPercent > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontSize: "0.88rem" }}>
              <span style={{ color: "var(--tools-text-muted)" }}>Tax / GST ({taxPercent}%):</span>
              <b>+₹{calculation.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
