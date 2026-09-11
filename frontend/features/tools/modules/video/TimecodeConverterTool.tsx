"use client";

import React, { useState, useMemo } from "react";
import { Timer, ArrowLeftRight, Copy } from "lucide-react";
import { timecodeFpsList } from "../../config/presets.config";
import { toast } from "@/components/ToastContext";

export function TimecodeConverterTool() {
  const [fps, setFps] = useState<number>(24);
  const [mode, setMode] = useState<"framesToTc" | "tcToFrames">("framesToTc");

  // Frames to TC state
  const [inputFrames, setInputFrames] = useState<number>(3648);

  // TC to Frames state
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(2);
  const [seconds, setSeconds] = useState<number>(32);
  const [frames, setFrames] = useState<number>(0);

  // Conversion: Frames to Timecode
  const timecodeResult = useMemo(() => {
    if (inputFrames < 0 || isNaN(inputFrames)) {
      return {
        timecode: "00:00:00:00",
        totalSeconds: "0.000",
        milliseconds: 0,
      };
    }
    const totalSec = Math.floor(inputFrames / fps);
    const ff = Math.floor(inputFrames % fps);
    const ss = totalSec % 60;
    const mm = Math.floor(totalSec / 60) % 60;
    const hh = Math.floor(totalSec / 3600);

    const pad = (n: number) => n.toString().padStart(2, "0");
    const ms = Math.round((inputFrames / fps) * 1000);

    return {
      timecode: `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`,
      totalSeconds: (inputFrames / fps).toFixed(3),
      milliseconds: ms,
    };
  }, [inputFrames, fps]);

  // Conversion: Timecode to Frames
  const framesResult = useMemo(() => {
    const totalSec = (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0);
    const totalFrames = Math.round(totalSec * fps + (frames || 0));
    const ms = Math.round((totalFrames / fps) * 1000);

    return {
      totalFrames,
      milliseconds: ms,
    };
  }, [hours, minutes, seconds, frames, fps]);

  const copyVal = (val: string | number) => {
    navigator.clipboard.writeText(val.toString());
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Framerate (FPS)</label>
          <select
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="tool-select"
          >
            {timecodeFpsList.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => setMode("framesToTc")}
            className={`tool-dept-pill ${mode === "framesToTc" ? "active" : ""}`}
            style={{ flex: 1, textAlign: "center" }}
          >
            Frames → Timecode
          </button>
          <button
            type="button"
            onClick={() => setMode("tcToFrames")}
            className={`tool-dept-pill ${mode === "tcToFrames" ? "active" : ""}`}
            style={{ flex: 1, textAlign: "center" }}
          >
            Timecode → Frames
          </button>
        </div>

        {mode === "framesToTc" ? (
          <div className="tool-field-group">
            <label className="tool-label">Total Frame Count</label>
            <input
              type="number"
              min="0"
              value={inputFrames}
              onChange={(e) => setInputFrames(Number(e.target.value))}
              className="tool-input"
              style={{ fontFamily: "var(--tools-font-mono)", fontSize: "1.1rem" }}
            />
          </div>
        ) : (
          <div>
            <label className="tool-label">SMPTE Timecode (HH:MM:SS:FF)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Hours</span>
                <input type="number" min="0" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="tool-input" />
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Minutes</span>
                <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="tool-input" />
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Seconds</span>
                <input type="number" min="0" max="59" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="tool-input" />
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Frames</span>
                <input type="number" min="0" max={Math.ceil(fps) - 1} value={frames} onChange={(e) => setFrames(Number(e.target.value))} className="tool-input" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Calculation Results</span>
        </div>

        {mode === "framesToTc" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                padding: "24px",
                backgroundColor: "var(--tools-surface)",
                borderRadius: "12px",
                border: "1px solid var(--tools-border)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
                SMPTE Timecode (HH:MM:SS:FF)
              </div>
              <div style={{ fontSize: "2.4rem", fontWeight: 800, fontFamily: "var(--tools-font-mono)", color: "var(--tools-primary)" }}>
                {timecodeResult.timecode}
              </div>
              <button
                type="button"
                onClick={() => copyVal(timecodeResult.timecode)}
                className="tool-btn-secondary"
                style={{ marginTop: "12px", padding: "6px 14px", fontSize: "0.8rem" }}
              >
                <Copy size={13} />
                <span>Copy Timecode</span>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ padding: "12px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Total Duration (s)</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{timecodeResult.totalSeconds} s</div>
              </div>
              <div style={{ padding: "12px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Milliseconds</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{timecodeResult.milliseconds} ms</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                padding: "24px",
                backgroundColor: "var(--tools-surface)",
                borderRadius: "12px",
                border: "1px solid var(--tools-border)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)", textTransform: "uppercase", marginBottom: "6px" }}>
                Total Frames
              </div>
              <div style={{ fontSize: "2.4rem", fontWeight: 800, fontFamily: "var(--tools-font-mono)", color: "var(--tools-primary)" }}>
                {framesResult.totalFrames.toLocaleString()}
              </div>
              <button
                type="button"
                onClick={() => copyVal(framesResult.totalFrames)}
                className="tool-btn-secondary"
                style={{ marginTop: "12px", padding: "6px 14px", fontSize: "0.8rem" }}
              >
                <Copy size={13} />
                <span>Copy Frame Count</span>
              </button>
            </div>

            <div style={{ padding: "12px", backgroundColor: "var(--tools-surface)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Total Duration</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                {(framesResult.totalFrames / fps).toFixed(3)} seconds ({framesResult.milliseconds} ms)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
