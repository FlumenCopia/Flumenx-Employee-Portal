"use client";

import React, { useState, useMemo } from "react";
import { Copy, ArrowLeftRight, Check, AlertCircle } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function Base64Tool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState<string>("Hello, Flumenx World! 🚀");
  const [urlSafe, setUrlSafe] = useState(false);

  // UTF-8 safe encode/decode
  const result = useMemo(() => {
    if (!input) return { text: "", error: "" };
    try {
      if (mode === "encode") {
        // Encode UTF-8 text to base64
        const utf8Bytes = new TextEncoder().encode(input);
        let binaryStr = "";
        for (let i = 0; i < utf8Bytes.length; i++) {
          binaryStr += String.fromCharCode(utf8Bytes[i]);
        }
        let b64 = window.btoa(binaryStr);
        if (urlSafe) {
          b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        }
        return { text: b64, error: "" };
      } else {
        // Decode Base64
        let str = input.trim();
        if (urlSafe) {
          str = str.replace(/-/g, "+").replace(/_/g, "/");
          while (str.length % 4) {
            str += "=";
          }
        }
        const binaryStr = window.atob(str);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const decoded = new TextDecoder().decode(bytes);
        return { text: decoded, error: "" };
      }
    } catch (err: any) {
      return { text: "", error: "Invalid Base64 string format for decoding." };
    }
  }, [input, mode, urlSafe]);

  const copyResult = () => {
    if (!result.text) return;
    navigator.clipboard.writeText(result.text);
    toast.success("Copied to clipboard!");
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
            Text → Base64 (Encode)
          </button>
          <button
            type="button"
            onClick={() => setMode("decode")}
            className={`tool-dept-pill ${mode === "decode" ? "active" : ""}`}
            style={{ flex: 1, textAlign: "center" }}
          >
            Base64 → Text (Decode)
          </button>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">
            {mode === "encode" ? "Source Text" : "Base64 Input"}
          </label>
          <textarea
            rows={10}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "Enter text to encode..." : "Paste Base64 to decode..."}
            className="tool-textarea tool-textarea-mono"
          />
        </div>

        <div className="tool-field-group">
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={urlSafe}
              onChange={(e) => setUrlSafe(e.target.checked)}
              style={{ accentColor: "var(--tools-primary)" }}
            />
            <span>URL-Safe Base64 (replaces + and / with - and _)</span>
          </label>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">
            {mode === "encode" ? "Encoded Base64" : "Decoded Text"}
          </span>
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
