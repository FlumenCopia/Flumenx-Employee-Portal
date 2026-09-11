"use client";

import React, { useState } from "react";
import { Pipette, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function ColorPickerTool() {
  const [color, setColor] = useState("#087A5B");
  const [history, setHistory] = useState<string[]>(["#087A5B", "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B"]);

  const pickEyeDropper = async () => {
    // @ts-ignore
    if (typeof window !== "undefined" && window.EyeDropper) {
      try {
        // @ts-ignore
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          setColor(result.sRGBHex.toUpperCase());
          setHistory((prev) => [result.sRGBHex.toUpperCase(), ...prev.filter((c) => c !== result.sRGBHex.toUpperCase())].slice(0, 10));
          toast.success("Color picked from screen!");
        }
      } catch {
        // user canceled
      }
    } else {
      toast.info("EyeDropper is supported in Chromium browsers (Chrome/Edge). Use the color picker below!");
    }
  };

  const copyVal = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success(`Copied ${val}!`);
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Choose or Sample Color</label>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <input
              type="color"
              value={color}
              onChange={(e) => {
                const hex = e.target.value.toUpperCase();
                setColor(hex);
                setHistory((prev) => [hex, ...prev.filter((c) => c !== hex)].slice(0, 10));
              }}
              style={{
                width: "64px",
                height: "56px",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            />
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="tool-input"
                style={{ fontFamily: "var(--tools-font-mono)", fontSize: "1.2rem", fontWeight: 700 }}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={pickEyeDropper}
          className="tool-btn-primary"
          style={{ width: "100%", marginTop: "10px" }}
        >
          <Pipette size={16} />
          <span>Sample Any Screen Color (EyeDropper)</span>
        </button>

        {/* Recently Picked */}
        <div style={{ marginTop: "24px" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--tools-text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
            Palette History
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {history.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  backgroundColor: c,
                  border: color === c ? "2px solid #FFFFFF" : "1px solid var(--tools-border)",
                  boxShadow: color === c ? "0 0 0 2px var(--tools-primary)" : "none",
                  cursor: "pointer",
                }}
                title={c}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Active Color Details</span>
        </div>

        <div
          style={{
            height: "120px",
            backgroundColor: color,
            borderRadius: "12px",
            border: "1px solid var(--tools-border)",
            marginBottom: "16px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
          }}
        />

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => copyVal(color)}
            className="tool-btn-primary"
            style={{ flex: 1 }}
          >
            <Copy size={14} />
            <span>Copy HEX ({color})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
