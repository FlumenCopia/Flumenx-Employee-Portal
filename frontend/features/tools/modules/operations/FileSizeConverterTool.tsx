"use client";

import React, { useState, useMemo } from "react";
import { HardDrive, Copy } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function FileSizeConverterTool() {
  const [val, setVal] = useState<number>(500);
  const [unit, setUnit] = useState<"B" | "KB" | "MB" | "GB" | "TB">("MB");

  const bytes = useMemo(() => {
    if (isNaN(val) || val < 0) return 0;
    const factor: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    };
    return val * (factor[unit] || 1);
  }, [val, unit]);

  const binaryUnits = [
    { label: "Bytes (B)", val: bytes },
    { label: "Kibibytes (KiB)", val: bytes / 1024 },
    { label: "Mebibytes (MiB)", val: bytes / 1024 ** 2 },
    { label: "Gibibytes (GiB)", val: bytes / 1024 ** 3 },
    { label: "Tebibytes (TiB)", val: bytes / 1024 ** 4 },
  ];

  const decimalUnits = [
    { label: "Bytes (B)", val: bytes },
    { label: "Kilobytes (KB)", val: bytes / 1000 },
    { label: "Megabytes (MB)", val: bytes / 1000 ** 2 },
    { label: "Gigabytes (GB)", val: bytes / 1000 ** 3 },
    { label: "Terabytes (TB)", val: bytes / 1000 ** 4 },
  ];

  const copyVal = (v: number) => {
    navigator.clipboard.writeText(v.toLocaleString("en-US", { maximumFractionDigits: 4 }));
    toast.success("Copied size!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">File Size Amount</label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="number"
              min="0"
              value={val}
              onChange={(e) => setVal(Number(e.target.value))}
              className="tool-input"
              style={{ flex: 1, fontSize: "1.1rem" }}
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as any)}
              className="tool-select"
              style={{ width: "120px" }}
            >
              <option value="B">Bytes</option>
              <option value="KB">KB</option>
              <option value="MB">MB</option>
              <option value="GB">GB</option>
              <option value="TB">TB</option>
            </select>
          </div>
        </div>

        <div style={{ padding: "16px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "10px", border: "1px solid var(--tools-border)", marginTop: "20px" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "8px" }}>Binary vs Decimal Standard</div>
          <p style={{ fontSize: "0.82rem", color: "var(--tools-text-secondary)", margin: 0, lineHeight: "1.5" }}>
            Operating systems (Windows, Linux) use <b>1024-based binary</b> (1 KiB = 1024 B). Storage manufacturers and network transfer speeds typically use <b>1000-based decimal</b> (1 KB = 1000 B).
          </p>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Equivalent File Sizes</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--tools-primary)", textTransform: "uppercase" }}>
            Binary Scale (1024-based · OS Standard)
          </div>
          {binaryUnits.map((u, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                backgroundColor: "var(--tools-surface)",
                borderRadius: "8px",
                border: "1px solid var(--tools-border)",
              }}
            >
              <span style={{ fontSize: "0.82rem", color: "var(--tools-text-muted)" }}>{u.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: "var(--tools-font-mono)", fontWeight: 700, fontSize: "0.95rem" }}>
                  {u.val.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </span>
                <button
                  type="button"
                  onClick={() => copyVal(u.val)}
                  style={{ background: "none", border: "none", color: "var(--tools-text-muted)", cursor: "pointer", padding: "2px" }}
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>
          ))}

          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0284C7", textTransform: "uppercase", marginTop: "12px" }}>
            Decimal Scale (1000-based · Disk Spec)
          </div>
          {decimalUnits.map((u, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                backgroundColor: "var(--tools-surface)",
                borderRadius: "8px",
                border: "1px solid var(--tools-border)",
              }}
            >
              <span style={{ fontSize: "0.82rem", color: "var(--tools-text-muted)" }}>{u.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: "var(--tools-font-mono)", fontWeight: 700, fontSize: "0.95rem" }}>
                  {u.val.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </span>
                <button
                  type="button"
                  onClick={() => copyVal(u.val)}
                  style={{ background: "none", border: "none", color: "var(--tools-text-muted)", cursor: "pointer", padding: "2px" }}
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
