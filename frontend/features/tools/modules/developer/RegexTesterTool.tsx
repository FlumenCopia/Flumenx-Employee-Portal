"use client";

import React, { useState, useMemo } from "react";
import { AlertCircle, Check, Search } from "lucide-react";

export function RegexTesterTool() {
  const [pattern, setPattern] = useState<string>("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
  const [flags, setFlags] = useState({ g: true, i: true, m: false, s: false });
  const [testString, setTestString] = useState<string>(
    `Employee Directory Contact List:\n- Contact Rahul: rahul@flumenx.com (Primary)\n- Support desk: support@flumenx.com\n- External vendor: info@partner-agency.org`
  );

  const activeFlagsString = Object.entries(flags)
    .filter(([_, active]) => active)
    .map(([flag]) => flag)
    .join("");

  const analysis = useMemo(() => {
    if (!pattern) return { matches: [], error: "" };
    try {
      const re = new RegExp(pattern, activeFlagsString);
      const matches: { text: string; index: number; groups?: string[] }[] = [];

      if (flags.g) {
        let m: RegExpExecArray | null;
        let guard = 0;
        while ((m = re.exec(testString)) !== null && guard < 1000) {
          guard++;
          matches.push({
            text: m[0],
            index: m.index,
            groups: m.slice(1),
          });
          if (m[0].length === 0) re.lastIndex++;
        }
      } else {
        const m = re.exec(testString);
        if (m) {
          matches.push({
            text: m[0],
            index: m.index,
            groups: m.slice(1),
          });
        }
      }

      return { matches, error: "" };
    } catch (err: any) {
      return { matches: [], error: err.message || "Invalid Regular Expression syntax." };
    }
  }, [pattern, activeFlagsString, testString, flags.g]);

  const toggleFlag = (flag: "g" | "i" | "m" | "s") => {
    setFlags((prev) => ({ ...prev, [flag]: !prev[flag] }));
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Regular Expression Pattern</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--tools-font-mono)", fontSize: "1.2rem", color: "var(--tools-text-muted)" }}>/</span>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. [0-9]+"
              className="tool-input tool-textarea-mono"
              style={{ flex: 1 }}
            />
            <span style={{ fontFamily: "var(--tools-font-mono)", fontSize: "1.2rem", color: "var(--tools-text-muted)" }}>/</span>
            <span style={{ fontFamily: "var(--tools-font-mono)", fontWeight: 700, color: "var(--tools-primary)" }}>{activeFlagsString}</span>
          </div>
        </div>

        {/* Flag toggles */}
        <div className="tool-field-group">
          <label className="tool-label">Flags</label>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {[
              { id: "g", label: "Global (g)" },
              { id: "i", label: "Case Insensitive (i)" },
              { id: "m", label: "Multiline (m)" },
              { id: "s", label: "DotAll (s)" },
            ].map((f) => (
              <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={flags[f.id as keyof typeof flags]}
                  onChange={() => toggleFlag(f.id as any)}
                  style={{ accentColor: "var(--tools-primary)" }}
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Test String</label>
          <textarea
            rows={8}
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            className="tool-textarea tool-textarea-mono"
          />
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Matches ({analysis.matches.length})</span>
        </div>

        {analysis.error ? (
          <div style={{ padding: "14px", backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid #EF4444", borderRadius: "8px", color: "#EF4444", fontSize: "0.85rem", display: "flex", gap: "8px" }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700 }}>Regex Syntax Error:</div>
              <div>{analysis.error}</div>
            </div>
          </div>
        ) : (
          <div>
            {analysis.matches.length === 0 ? (
              <div style={{ color: "var(--tools-text-muted)", fontSize: "0.9rem", padding: "40px 0", textAlign: "center" }}>
                No matches found in the test string.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "360px", overflowY: "auto" }}>
                {analysis.matches.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "10px 14px",
                      backgroundColor: "var(--tools-surface)",
                      borderRadius: "8px",
                      border: "1px solid var(--tools-border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--tools-primary)" }}>Match #{idx + 1}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)" }}>Index: {m.index}</span>
                    </div>
                    <div style={{ fontFamily: "var(--tools-font-mono)", fontSize: "0.92rem", fontWeight: 600, wordBreak: "break-all" }}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
