"use client";

import React, { useState, useEffect } from "react";
import { Copy, RefreshCw, Check } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function ColorConverterTool() {
  const [hex, setHex] = useState("#087A5B");
  const [r, setR] = useState(8);
  const [g, setG] = useState(122);
  const [b, setB] = useState(91);

  // Convert RGB to HEX
  const rgbToHex = (red: number, green: number, blue: number) => {
    const toHex = (n: number) => {
      const clamped = Math.max(0, Math.min(255, n));
      return clamped.toString(16).padStart(2, "0");
    };
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();
  };

  // Convert RGB to HSL
  const rgbToHsl = (red: number, green: number, blue: number) => {
    const rNorm = red / 255;
    const gNorm = green / 255;
    const bNorm = blue / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm:
          h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
          break;
        case gNorm:
          h = (bNorm - rNorm) / d + 2;
          break;
        case bNorm:
          h = (rNorm - gNorm) / d + 4;
          break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  };

  // Convert RGB to CMYK
  const rgbToCmyk = (red: number, green: number, blue: number) => {
    const rNorm = red / 255;
    const gNorm = green / 255;
    const bNorm = blue / 255;
    const k = 1 - Math.max(rNorm, gNorm, bNorm);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    const c = (1 - rNorm - k) / (1 - k);
    const m = (1 - gNorm - k) / (1 - k);
    const y = (1 - bNorm - k) / (1 - k);
    return {
      c: Math.round(c * 100),
      m: Math.round(m * 100),
      y: Math.round(y * 100),
      k: Math.round(k * 100),
    };
  };

  const handleHexChange = (val: string) => {
    setHex(val);
    const clean = val.replace("#", "");
    if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
      setR(parseInt(clean.slice(0, 2), 16));
      setG(parseInt(clean.slice(2, 4), 16));
      setB(parseInt(clean.slice(4, 6), 16));
    }
  };

  const handleRgbChange = (newR: number, newG: number, newB: number) => {
    setR(newR);
    setG(newG);
    setB(newB);
    setHex(rgbToHex(newR, newG, newB));
  };

  const hsl = rgbToHsl(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);

  const copyVal = (str: string, label: string) => {
    navigator.clipboard.writeText(str);
    toast.success(`Copied ${label}!`);
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Color Swatch & Picker</label>
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <input
              type="color"
              value={hex.length === 7 ? hex : "#000000"}
              onChange={(e) => handleHexChange(e.target.value)}
              style={{
                width: "56px",
                height: "50px",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            />
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={hex}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#087A5B"
                className="tool-input"
                style={{ fontFamily: "var(--tools-font-mono)", fontSize: "1.1rem", fontWeight: 700 }}
              />
            </div>
          </div>
        </div>

        {/* RGB Sliders */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "20px" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "4px" }}>
              <span>Red (R)</span>
              <span style={{ fontFamily: "var(--tools-font-mono)", fontWeight: 700 }}>{r}</span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={r}
              onChange={(e) => handleRgbChange(Number(e.target.value), g, b)}
              style={{ width: "100%", accentColor: "#EF4444" }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "4px" }}>
              <span>Green (G)</span>
              <span style={{ fontFamily: "var(--tools-font-mono)", fontWeight: 700 }}>{g}</span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={g}
              onChange={(e) => handleRgbChange(r, Number(e.target.value), b)}
              style={{ width: "100%", accentColor: "#10B981" }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "4px" }}>
              <span>Blue (B)</span>
              <span style={{ fontFamily: "var(--tools-font-mono)", fontWeight: 700 }}>{b}</span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={b}
              onChange={(e) => handleRgbChange(r, g, Number(e.target.value))}
              style={{ width: "100%", accentColor: "#3B82F6" }}
            />
          </div>
        </div>
      </div>

      {/* Output Panel with values */}
      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Color Representations</span>
        </div>

        {/* Big Preview Swatch */}
        <div
          style={{
            height: "90px",
            backgroundColor: hex,
            borderRadius: "10px",
            marginBottom: "16px",
            border: "1px solid var(--tools-border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { label: "HEX", val: hex },
            { label: "RGB", val: `rgb(${r}, ${g}, ${b})` },
            { label: "HSL", val: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
            { label: "CMYK", val: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)` },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "var(--tools-surface)",
                borderRadius: "8px",
                border: "1px solid var(--tools-border)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--tools-text-muted)", textTransform: "uppercase" }}>{item.label}</div>
                <div style={{ fontFamily: "var(--tools-font-mono)", fontWeight: 700, fontSize: "0.95rem" }}>{item.val}</div>
              </div>
              <button
                type="button"
                onClick={() => copyVal(item.val, item.label)}
                className="tool-btn-secondary"
                style={{ padding: "6px 10px", fontSize: "0.8rem" }}
              >
                <Copy size={13} />
                <span>Copy</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
