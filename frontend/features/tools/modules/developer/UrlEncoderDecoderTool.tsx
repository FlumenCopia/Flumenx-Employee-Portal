"use client";

import React, { useState, useMemo } from "react";
import { Copy, AlertCircle } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function UrlEncoderDecoderTool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [componentMode, setComponentMode] = useState(true);
  const [input, setInput] = useState<string>("https://flumenx.com/search?q=enterprise tools & utilities+v1#section");

  const result = useMemo(() => {
    if (!input) return { text: "", error: "" };
    try {
      if (mode === "encode") {
        const enc = componentMode ? encodeURIComponent(input) : encodeURI(input);
        return { text: enc, error: "" };
      } else {
        const dec = componentMode ? decodeURIComponent(input) : decodeURI(input);
        return { text: dec, error: "" };
      }
    } catch (err: any) {
      return { text: "", error: "Malformed URI sequence encountered during decoding." };
    }
  }, [input, mode, componentMode]);

  const copyResult = () => {
    if (!result.text) return;
    navigator.clipboard.writeText(result.text);
    toast.success("URL copied to clipboard!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => setMode("encode")}
            className={`tool-dept-pill ${mode === "encode" ? "active" : ""}`}
            style={{ flex: 1, textAlign: "center" }}
          >
            Encode URL
          </button>
          <button
            type="button"
            onClick={() => setMode("decode")}
            className={`tool-dept-pill ${mode === "decode" ? "active" : ""}`}
            style={{ flex: 1, textAlign: "center" }}
          >
            Decode URL
          </button>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">{mode === "encode" ? "URL to Encode" : "Encoded URL Input"}</label>
          <textarea
            rows={10}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="tool-textarea tool-textarea-mono"
          />
        </div>

        <div className="tool-field-group">
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={componentMode}
              onChange={(e) => setComponentMode(e.target.checked)}
              style={{ accentColor: "var(--tools-primary)" }}
            />
            <span>Strict Component Encoding (encodes slashes, colons, ampersands)</span>
          </label>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Result</span>
          {result.text && (
            <button type="button" onClick={copyResult} className="tool-btn-primary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
              <Copy size={13} />
              <span>Copy</span>
            </button>
          )}
        </div>

        {result.error ? (
          <div style={{ padding: "14px", backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid #EF4444", borderRadius: "8px", color: "#EF4444", fontSize: "0.85rem", display: "flex", gap: "8px" }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>{result.error}</div>
          </div>
        ) : (
          <textarea
            readOnly
            rows={10}
            value={result.text}
            className="tool-textarea tool-textarea-mono"
            style={{ backgroundColor: "var(--tools-surface)", color: "var(--tools-text-primary)" }}
          />
        )}
      </div>
    </div>
  );
}
