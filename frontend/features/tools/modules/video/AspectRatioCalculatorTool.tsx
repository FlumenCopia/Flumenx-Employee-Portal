"use client";

import React, { useState, useMemo } from "react";
import { Maximize2, ArrowRight, Copy } from "lucide-react";
import { aspectRatiosList } from "../../config/presets.config";
import { toast } from "@/components/ToastContext";

export function AspectRatioCalculatorTool() {
  const [width, setWidth] = useState<number>(1920);
  const [height, setHeight] = useState<number>(1080);

  // Scaler state
  const [scaleW, setScaleW] = useState<number>(1280);
  const [scaleH, setScaleH] = useState<number>(720);

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

  const ratioData = useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    const divisor = gcd(width, height);
    const simpleW = width / divisor;
    const simpleH = height / divisor;
    const decimal = (width / height).toFixed(2);

    // Find closest standard
    let closest = aspectRatiosList[0];
    let minDiff = Infinity;
    const currentDec = width / height;

    for (const item of aspectRatiosList) {
      const itemDec = item.w / item.h;
      const diff = Math.abs(currentDec - itemDec);
      if (diff < minDiff) {
        minDiff = diff;
        closest = item;
      }
    }

    return {
      simplified: `${simpleW}:${simpleH}`,
      decimal: `${decimal}:1`,
      closestMatch: closest.name,
      isExactMatch: minDiff < 0.01,
    };
  }, [width, height]);

  const handleScaleWChange = (newW: number) => {
    setScaleW(newW);
    if (width > 0 && height > 0) {
      setScaleH(Math.round((newW * height) / width));
    }
  };

  const handleScaleHChange = (newH: number) => {
    setScaleH(newH);
    if (width > 0 && height > 0) {
      setScaleW(Math.round((newH * width) / height));
    }
  };

  const setPresetDimensions = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
    setScaleW(w);
    setScaleH(h);
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div className="tool-field-group">
            <label className="tool-label">Source Width (px)</label>
            <input
              type="number"
              min="1"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="tool-input"
            />
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Source Height (px)</label>
            <input
              type="number"
              min="1"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="tool-input"
            />
          </div>
        </div>

        {/* Quick Ratio Presets */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", marginBottom: "6px" }}>
            Common Format Presets
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {[
              { label: "16:9 Landscape (1920×1080)", w: 1920, h: 1080 },
              { label: "9:16 Vertical (1080×1920)", w: 1080, h: 1920 },
              { label: "1:1 Square (1080×1080)", w: 1080, h: 1080 },
              { label: "4:5 Portrait (1080×1350)", w: 1080, h: 1350 },
              { label: "21:9 Ultrawide (2560×1080)", w: 2560, h: 1080 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPresetDimensions(p.w, p.h)}
                className="tool-cat-pill"
                style={{ fontSize: "0.75rem", padding: "4px 8px" }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dimension Scaler Tool */}
        <div style={{ padding: "16px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "12px" }}>
            Dimension Scaler (Preserve Aspect)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "10px", alignItems: "center" }}>
            <div>
              <label className="tool-label" style={{ fontSize: "0.78rem" }}>New Width</label>
              <input
                type="number"
                value={scaleW}
                onChange={(e) => handleScaleWChange(Number(e.target.value))}
                className="tool-input"
              />
            </div>
            <ArrowRight size={16} style={{ color: "var(--tools-text-muted)", marginTop: "18px" }} />
            <div>
              <label className="tool-label" style={{ fontSize: "0.78rem" }}>New Height</label>
              <input
                type="number"
                value={scaleH}
                onChange={(e) => handleScaleHChange(Number(e.target.value))}
                className="tool-input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Calculated Aspect Ratio</span>
        </div>

        {ratioData && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                padding: "24px",
                backgroundColor: "var(--tools-surface)",
                borderRadius: "12px",
                border: "1px solid var(--tools-border)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                Simplified Ratio
              </div>
              <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "var(--tools-primary)", fontFamily: "var(--tools-font-mono)" }}>
                {ratioData.simplified}
              </div>
              <div style={{ fontSize: "0.95rem", color: "var(--tools-text-secondary)", marginTop: "4px" }}>
                Decimal: <b>{ratioData.decimal}</b>
              </div>
            </div>

            <div style={{ padding: "14px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--tools-text-muted)", marginBottom: "4px" }}>Standard Preset Category:</div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{ratioData.closestMatch}</div>
              <div style={{ fontSize: "0.8rem", color: ratioData.isExactMatch ? "#10B981" : "#F59E0B", marginTop: "4px", fontWeight: 600 }}>
                {ratioData.isExactMatch ? "✓ Exact standard match" : "~ Approximate match"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
