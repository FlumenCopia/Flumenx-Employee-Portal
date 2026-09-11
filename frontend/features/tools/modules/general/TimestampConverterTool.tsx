"use client";

import React, { useState, useEffect } from "react";
import { Clock, ArrowDown, ArrowUp, Copy, Check } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function TimestampConverterTool() {
  const [currentEpoch, setCurrentEpoch] = useState<number>(Math.floor(Date.now() / 1000));
  const [isLive, setIsLive] = useState(true);

  // Timestamp to Date state
  const [inputEpoch, setInputEpoch] = useState<string>(Math.floor(Date.now() / 1000).toString());
  const [epochType, setEpochType] = useState<"sec" | "ms">("sec");

  // Date to Timestamp state
  const [inputDate, setInputDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  // Ticking current timestamp
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      setCurrentEpoch(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  // Derived Date from input epoch
  const convertedDate = (() => {
    try {
      const num = Number(inputEpoch);
      if (isNaN(num) || !num) return null;
      const ms = epochType === "sec" ? num * 1000 : num;
      const d = new Date(ms);
      if (isNaN(d.getTime())) return null;
      return d;
    } catch {
      return null;
    }
  })();

  // Derived Epoch from input date
  const convertedEpoch = (() => {
    try {
      const d = new Date(inputDate);
      if (isNaN(d.getTime())) return null;
      return {
        sec: Math.floor(d.getTime() / 1000),
        ms: d.getTime(),
      };
    } catch {
      return null;
    }
  })();

  const copyVal = (val: string | number, label: string) => {
    navigator.clipboard.writeText(val.toString());
    toast.success(`Copied ${label}!`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Live Current Epoch Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          backgroundColor: "var(--tools-surface-subtle)",
          borderRadius: "12px",
          border: "1px solid var(--tools-border)",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: isLive ? "#10B981" : "#F59E0B",
              boxShadow: isLive ? "0 0 10px #10B981" : "none",
            }}
          />
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--tools-text-muted)" }}>
            Current Unix Timestamp:
          </span>
          <span style={{ fontFamily: "var(--tools-font-mono)", fontSize: "1.2rem", fontWeight: 700, color: "var(--tools-text-primary)" }}>
            {currentEpoch}
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => copyVal(currentEpoch, "current timestamp")}
            className="tool-btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.82rem" }}
          >
            <Copy size={13} />
            <span>Copy</span>
          </button>
          <button
            type="button"
            onClick={() => setIsLive(!isLive)}
            className="tool-btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.82rem" }}
          >
            {isLive ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      <div className="tool-two-col">
        {/* Section 1: Timestamp to Date */}
        <div className="tool-output-panel">
          <div className="tool-output-header">
            <span className="tool-output-title">Unix Timestamp → Date</span>
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Enter Timestamp</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                value={inputEpoch}
                onChange={(e) => setInputEpoch(e.target.value)}
                placeholder="1741673842"
                className="tool-input"
                style={{ fontFamily: "var(--tools-font-mono)" }}
              />
              <select
                value={epochType}
                onChange={(e) => setEpochType(e.target.value as any)}
                className="tool-select"
                style={{ width: "130px" }}
              >
                <option value="sec">Seconds (10)</option>
                <option value="ms">Milliseconds (13)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setInputEpoch(currentEpoch.toString())}
              style={{ background: "none", border: "none", color: "var(--tools-primary)", fontSize: "0.78rem", cursor: "pointer", marginTop: "6px", fontWeight: 600 }}
            >
              Insert current time
            </button>
          </div>

          {convertedDate ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ padding: "10px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)", marginBottom: "2px" }}>Local Time</div>
                <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{convertedDate.toString()}</div>
              </div>

              <div style={{ padding: "10px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)", marginBottom: "2px" }}>UTC / GMT</div>
                <div style={{ fontFamily: "var(--tools-font-mono)", fontSize: "0.88rem" }}>{convertedDate.toUTCString()}</div>
              </div>

              <div style={{ padding: "10px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)", marginBottom: "2px" }}>ISO 8601 Format</div>
                <div style={{ fontFamily: "var(--tools-font-mono)", fontSize: "0.88rem" }}>{convertedDate.toISOString()}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--tools-text-muted)", fontSize: "0.88rem" }}>Please enter a valid numeric timestamp.</div>
          )}
        </div>

        {/* Section 2: Date to Timestamp */}
        <div className="tool-output-panel">
          <div className="tool-output-header">
            <span className="tool-output-title">Date → Unix Timestamp</span>
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Select Date & Time</label>
            <input
              type="datetime-local"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              className="tool-input"
            />
          </div>

          {convertedEpoch && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  backgroundColor: "var(--tools-surface)",
                  borderRadius: "8px",
                  border: "1px solid var(--tools-border)",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Seconds (Epoch)</div>
                  <div style={{ fontFamily: "var(--tools-font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
                    {convertedEpoch.sec}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyVal(convertedEpoch.sec, "epoch seconds")}
                  className="tool-btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  backgroundColor: "var(--tools-surface)",
                  borderRadius: "8px",
                  border: "1px solid var(--tools-border)",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Milliseconds (JS Timestamp)</div>
                  <div style={{ fontFamily: "var(--tools-font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
                    {convertedEpoch.ms}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyVal(convertedEpoch.ms, "epoch ms")}
                  className="tool-btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
