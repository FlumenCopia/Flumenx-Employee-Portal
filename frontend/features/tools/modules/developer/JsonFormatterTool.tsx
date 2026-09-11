"use client";

import React, { useState, useMemo } from "react";
import { Copy, Download, Check, AlertCircle, Sparkles, Minimize2 } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function JsonFormatterTool() {
  const [inputJson, setInputJson] = useState<string>(
    `{\n  "project": "Flumenx Employee Portal",\n  "status": "active",\n  "version": 1.0,\n  "features": ["Task Management", "KPI Engine", "Utility Toolbox"],\n  "metadata": {\n    "clientSide": true,\n    "privacyFirst": true\n  }\n}`
  );
  const [indentation, setIndentation] = useState<number | "tab">(2);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const parsedData = useMemo(() => {
    if (!inputJson.trim()) {
      setErrorMsg("");
      return null;
    }
    try {
      const parsed = JSON.parse(inputJson);
      setErrorMsg("");
      return parsed;
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid JSON syntax.");
      return null;
    }
  }, [inputJson]);

  const formattedJson = useMemo(() => {
    if (!parsedData) return "";
    const space = indentation === "tab" ? "\t" : indentation;
    return JSON.stringify(parsedData, null, space);
  }, [parsedData, indentation]);

  const handleMinify = () => {
    if (!parsedData) return;
    setInputJson(JSON.stringify(parsedData));
    toast.success("JSON minified!");
  };

  const handleFormat = () => {
    if (!parsedData) return;
    const space = indentation === "tab" ? "\t" : indentation;
    setInputJson(JSON.stringify(parsedData, null, space));
    toast.success("JSON formatted!");
  };

  const copyJson = () => {
    if (!formattedJson) return;
    navigator.clipboard.writeText(formattedJson);
    toast.success("JSON copied to clipboard!");
  };

  const downloadJson = () => {
    if (!formattedJson) return;
    const blob = new Blob([formattedJson], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `data_${Date.now()}.json`;
    a.click();
    toast.success("Downloaded JSON file!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label className="tool-label" style={{ marginBottom: 0 }}>Input JSON</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <select
                value={indentation}
                onChange={(e) => setIndentation(e.target.value === "tab" ? "tab" : Number(e.target.value))}
                className="tool-select"
                style={{ width: "120px", padding: "4px 8px", fontSize: "0.8rem" }}
              >
                <option value={2}>2 Spaces</option>
                <option value={4}>4 Spaces</option>
                <option value="tab">Tabs</option>
              </select>
            </div>
          </div>
          <textarea
            rows={14}
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            placeholder="Paste your JSON here..."
            className="tool-textarea tool-textarea-mono"
            style={{ fontSize: "0.85rem" }}
          />
        </div>

        {errorMsg ? (
          <div style={{ padding: "12px 14px", backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid #EF4444", borderRadius: "8px", color: "#EF4444", fontSize: "0.85rem", display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div style={{ fontWeight: 700 }}>Syntax Error:</div>
              <div style={{ fontFamily: "var(--tools-font-mono)", fontSize: "0.8rem", marginTop: "2px" }}>{errorMsg}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" onClick={handleFormat} className="tool-btn-primary" style={{ flex: 1 }}>
              <Sparkles size={14} />
              <span>Format & Clean</span>
            </button>
            <button type="button" onClick={handleMinify} className="tool-btn-secondary" style={{ flex: 1 }}>
              <Minimize2 size={14} />
              <span>Minify (Compact)</span>
            </button>
          </div>
        )}
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Formatted Output</span>
          <div className="tool-output-actions">
            <button type="button" onClick={copyJson} disabled={!formattedJson} className="tool-btn-primary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
              <Copy size={13} />
              <span>Copy</span>
            </button>
            <button type="button" onClick={downloadJson} disabled={!formattedJson} className="tool-btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
              <Download size={13} />
              <span>Download</span>
            </button>
          </div>
        </div>

        <textarea
          readOnly
          rows={14}
          value={formattedJson}
          className="tool-textarea tool-textarea-mono"
          style={{
            backgroundColor: "var(--tools-surface)",
            fontSize: "0.85rem",
            color: "var(--tools-text-primary)",
            lineHeight: "1.5",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--tools-text-muted)", marginTop: "10px" }}>
          <span>Input: {new Blob([inputJson]).size} Bytes</span>
          <span>Output: {new Blob([formattedJson]).size} Bytes</span>
        </div>
      </div>
    </div>
  );
}
