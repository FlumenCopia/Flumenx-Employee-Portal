"use client";

import React, { useState, useMemo } from "react";
import { ShieldAlert, CheckCircle2, XCircle, Clock, Copy } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function JwtDecoderTool() {
  const [jwt, setJwt] = useState<string>(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlJhaHVsIFNoYXJtYSIsImVtYWlsIjoicmFodWxAZmx1bWVueC5jb20iLCJyb2xlIjoiRW1wbG95ZWUiLCJpYXQiOjE3NDAwMDAwMDAsImV4cCI6MTc3MTUzNjAwMH0.4zC42FfZjBqC742Z3QG31_Pq0mKkO5n_uB3xVqW46M4"
  );

  const decoded = useMemo(() => {
    if (!jwt.trim()) return null;
    const parts = jwt.trim().split(".");
    if (parts.length !== 3) {
      return { error: "Invalid JWT structure. A JWT must consist of 3 parts separated by dots (Header.Payload.Signature)." };
    }

    try {
      const decodePart = (str: string) => {
        let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) base64 += "=";
        const decodedStr = decodeURIComponent(
          window
            .atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        return JSON.parse(decodedStr);
      };

      const header = decodePart(parts[0]);
      const payload = decodePart(parts[1]);
      const signature = parts[2];

      let isExpired = false;
      let expDate: Date | null = null;
      let iatDate: Date | null = null;

      if (payload.exp && typeof payload.exp === "number") {
        expDate = new Date(payload.exp * 1000);
        isExpired = expDate.getTime() < Date.now();
      }

      if (payload.iat && typeof payload.iat === "number") {
        iatDate = new Date(payload.iat * 1000);
      }

      return {
        header,
        payload,
        signature,
        isExpired,
        expDate,
        iatDate,
        error: "",
      };
    } catch (err: any) {
      return { error: "Failed to decode JWT base64 parts. Please check token string." };
    }
  }, [jwt]);

  const copyVal = (data: any, label: string) => {
    navigator.clipboard.writeText(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    toast.success(`Copied ${label}!`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Notice Banner */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          padding: "12px 16px",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          borderRadius: "8px",
          fontSize: "0.85rem",
          color: "var(--tools-text-secondary)",
        }}
      >
        <ShieldAlert size={18} className="text-amber-500" style={{ flexShrink: 0 }} />
        <span>
          <b>Notice:</b> This tool decodes and parses JWT headers and payloads client-side. Client-side decoding does <b>not</b> cryptographically verify token signatures against secret keys.
        </span>
      </div>

      <div className="tool-two-col">
        {/* Left: Input */}
        <div className="tool-controls-panel">
          <div className="tool-field-group">
            <label className="tool-label">Encoded JWT Token</label>
            <textarea
              rows={10}
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
              placeholder="Paste eyJhbGciOiJIUzI1NiIs..."
              className="tool-textarea tool-textarea-mono"
              style={{ fontSize: "0.85rem", wordBreak: "break-all" }}
            />
          </div>

          {decoded && !decoded.error && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  backgroundColor: "var(--tools-surface-subtle)",
                  borderRadius: "8px",
                  border: "1px solid var(--tools-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {decoded.isExpired ? (
                    <XCircle size={18} className="text-red-500" />
                  ) : (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  )}
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    Token Status: {decoded.isExpired ? "Expired" : "Active / Valid Time"}
                  </span>
                </div>
              </div>

              {decoded.expDate && (
                <div style={{ padding: "10px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", fontSize: "0.82rem", border: "1px solid var(--tools-border)" }}>
                  <span style={{ color: "var(--tools-text-muted)" }}>Expiration (exp): </span>
                  <b>{decoded.expDate.toLocaleString()}</b>
                </div>
              )}

              {decoded.iatDate && (
                <div style={{ padding: "10px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", fontSize: "0.82rem", border: "1px solid var(--tools-border)" }}>
                  <span style={{ color: "var(--tools-text-muted)" }}>Issued At (iat): </span>
                  <b>{decoded.iatDate.toLocaleString()}</b>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Decoded Output */}
        <div className="tool-output-panel">
          {decoded?.error ? (
            <div style={{ padding: "16px", backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid #EF4444", borderRadius: "8px", color: "#EF4444", fontSize: "0.88rem" }}>
              {decoded.error}
            </div>
          ) : decoded ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Header */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#EF4444", textTransform: "uppercase" }}>Header: Algorithm & Type</span>
                  <button type="button" onClick={() => copyVal(decoded.header, "Header JSON")} style={{ background: "none", border: "none", color: "var(--tools-primary)", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>
                    Copy
                  </button>
                </div>
                <pre style={{ margin: 0, padding: "12px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontFamily: "var(--tools-font-mono)", fontSize: "0.82rem", overflowX: "auto" }}>
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
              </div>

              {/* Payload */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase" }}>Payload: Claims Data</span>
                  <button type="button" onClick={() => copyVal(decoded.payload, "Payload JSON")} style={{ background: "none", border: "none", color: "var(--tools-primary)", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>
                    Copy
                  </button>
                </div>
                <pre style={{ margin: 0, padding: "12px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontFamily: "var(--tools-font-mono)", fontSize: "0.82rem", overflowX: "auto" }}>
                  {JSON.stringify(decoded.payload, null, 2)}
                </pre>
              </div>

              {/* Signature */}
              <div>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0284C7", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Signature Part</span>
                <div style={{ padding: "10px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)", fontFamily: "var(--tools-font-mono)", fontSize: "0.78rem", wordBreak: "break-all" }}>
                  {decoded.signature}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--tools-text-muted)", textAlign: "center", padding: "40px" }}>Paste a token to inspect payload.</div>
          )}
        </div>
      </div>
    </div>
  );
}
