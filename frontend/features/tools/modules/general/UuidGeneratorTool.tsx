"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Copy, Download, Check } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function UuidGeneratorTool() {
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [removeHyphens, setRemoveHyphens] = useState(false);
  const [uuids, setUuids] = useState<string[]>([]);

  const generateUuids = () => {
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      let id = window.crypto.randomUUID ? window.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      if (removeHyphens) {
        id = id.replace(/-/g, "");
      }
      if (uppercase) {
        id = id.toUpperCase();
      }
      list.push(id);
    }
    setUuids(list);
  };

  useEffect(() => {
    generateUuids();
  }, [count, uppercase, removeHyphens]);

  const copySingle = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("UUID copied!");
  };

  const copyAll = () => {
    navigator.clipboard.writeText(uuids.join("\n"));
    toast.success(`Copied ${uuids.length} UUIDs to clipboard!`);
  };

  const downloadTxt = () => {
    const blob = new Blob([uuids.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `uuids_${Date.now()}.txt`;
    a.click();
    toast.success("UUIDs downloaded as text file!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Quantity to Generate: {count}</label>
          <input
            type="range"
            min="1"
            max="50"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--tools-primary)" }}
          />
        </div>

        <div className="tool-field-group" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              style={{ accentColor: "var(--tools-primary)" }}
            />
            <span>Uppercase format (e.g. 7C9E6679-7425...)</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={removeHyphens}
              onChange={(e) => setRemoveHyphens(e.target.checked)}
              style={{ accentColor: "var(--tools-primary)" }}
            />
            <span>Remove hyphens (compact 32 hex chars)</span>
          </label>
        </div>

        <button type="button" onClick={generateUuids} className="tool-btn-primary" style={{ width: "100%", marginTop: "10px" }}>
          <RefreshCw size={16} />
          <span>Generate New UUIDs</span>
        </button>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">{uuids.length} UUID v4 Generated</span>
          <div className="tool-output-actions">
            <button type="button" onClick={copyAll} className="tool-btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
              <Copy size={13} />
              <span>Copy All</span>
            </button>
            <button type="button" onClick={downloadTxt} className="tool-btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
              <Download size={13} />
              <span>Download .txt</span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "400px", overflowY: "auto" }}>
          {uuids.map((id, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: "var(--tools-surface)",
                borderRadius: "8px",
                border: "1px solid var(--tools-border)",
                fontFamily: "var(--tools-font-mono)",
                fontSize: "0.88rem",
              }}
            >
              <span>{id}</span>
              <button
                type="button"
                onClick={() => copySingle(id)}
                style={{ background: "none", border: "none", color: "var(--tools-text-muted)", cursor: "pointer", padding: "4px" }}
                title="Copy single UUID"
              >
                <Copy size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
