"use client";

import React, { useState, useMemo } from "react";
import { AlignLeft, Copy, Trash2 } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function CharacterCounterTool() {
  const [text, setText] = useState(
    "Boost team velocity and streamline daily workflows with Flumenx Internal Toolbox. All operations run directly in your browser with zero data retention."
  );

  const stats = useMemo(() => {
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s+/g, "").length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const sentences = text.trim() ? text.split(/[.!?]+/).filter(Boolean).length : 0;
    const paragraphs = text.trim() ? text.split(/\n+/).filter(Boolean).length : 0;

    const readingTimeMinutes = (words / 200).toFixed(1);
    const speakingTimeMinutes = (words / 130).toFixed(1);

    return {
      chars,
      charsNoSpaces,
      words,
      sentences,
      paragraphs,
      readingTime: `${readingTimeMinutes} min`,
      speakingTime: `${speakingTimeMinutes} min`,
    };
  }, [text]);

  const limits = [
    { name: "Google Meta Description", max: 160, current: stats.chars },
    { name: "Twitter / X Post", max: 280, current: stats.chars },
    { name: "Meta Ad Headline", max: 40, current: stats.chars },
    { name: "Instagram Caption", max: 2200, current: stats.chars },
    { name: "LinkedIn Post", max: 3000, current: stats.chars },
  ];

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label className="tool-label" style={{ marginBottom: 0 }}>Input Copy / Text</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  toast.success("Text copied!");
                }}
                style={{ background: "none", border: "none", color: "var(--tools-primary)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => setText("")}
                style={{ background: "none", border: "none", color: "var(--tools-text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
              >
                Clear
              </button>
            </div>
          </div>
          <textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your text here to count characters, words and check social limits..."
            className="tool-textarea"
          />
        </div>

        {/* Social Limits */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--tools-text-muted)", textTransform: "uppercase" }}>
            Platform Length Checkers
          </div>
          {limits.map((lim, idx) => {
            const pct = Math.min(100, Math.round((lim.current / lim.max) * 100));
            const isOver = lim.current > lim.max;
            return (
              <div key={idx} style={{ padding: "8px 12px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600 }}>{lim.name}</span>
                  <span style={{ color: isOver ? "#EF4444" : "var(--tools-text-muted)", fontWeight: isOver ? 700 : 500 }}>
                    {lim.current} / {lim.max}
                  </span>
                </div>
                <div style={{ height: "5px", backgroundColor: "var(--tools-surface-muted)", borderRadius: "9999px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      backgroundColor: isOver ? "#EF4444" : pct > 85 ? "#F59E0B" : "var(--tools-primary)",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Text Metrics</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Total Characters</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--tools-primary)" }}>{stats.chars}</div>
          </div>

          <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Without Spaces</div>
            <div style={{ fontSize: "2rem", fontWeight: 800 }}>{stats.charsNoSpaces}</div>
          </div>

          <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Words</div>
            <div style={{ fontSize: "2rem", fontWeight: 800 }}>{stats.words}</div>
          </div>

          <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Sentences</div>
            <div style={{ fontSize: "2rem", fontWeight: 800 }}>{stats.sentences}</div>
          </div>

          <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Paragraphs</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>{stats.paragraphs}</div>
          </div>

          <div style={{ padding: "16px", backgroundColor: "var(--tools-surface)", borderRadius: "10px", border: "1px solid var(--tools-border)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Estimated Reading</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>{stats.readingTime}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
