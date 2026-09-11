"use client";

import React, { useState } from "react";
import { AlignLeft, Copy, Trash2, ArrowUpDown } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function TextCleanupTool() {
  const [text, setText] = useState<string>(
    `  Apple  \n\nBanana\n  Orange \nBanana\n\nGrape  `
  );

  const applyAction = (action: string) => {
    let lines = text.split("\n");

    switch (action) {
      case "trim":
        lines = lines.map((l) => l.trim());
        break;
      case "no-empty":
        lines = lines.filter((l) => l.trim().length > 0);
        break;
      case "no-extra-spaces":
        lines = lines.map((l) => l.replace(/\s+/g, " ").trim());
        break;
      case "dedup":
        lines = Array.from(new Set(lines));
        break;
      case "sort-asc":
        lines = [...lines].sort((a, b) => a.localeCompare(b));
        break;
      case "sort-desc":
        lines = [...lines].sort((a, b) => b.localeCompare(a));
        break;
      case "number-lines":
        lines = lines.map((l, i) => `${i + 1}. ${l}`);
        break;
      case "upper":
        setText(text.toUpperCase());
        toast.success("Converted to uppercase!");
        return;
      case "lower":
        setText(text.toLowerCase());
        toast.success("Converted to lowercase!");
        return;
      case "title":
        setText(
          text.replace(
            /\w\S*/g,
            (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          )
        );
        toast.success("Converted to Title Case!");
        return;
      case "snake":
        setText(
          text
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
        );
        toast.success("Converted to snake_case!");
        return;
      case "kebab":
        setText(
          text
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
        );
        toast.success("Converted to kebab-case!");
        return;
      default:
        break;
    }

    setText(lines.join("\n"));
    toast.success(`Action applied: ${action}`);
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
    toast.success("Cleaned text copied!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <label className="tool-label" style={{ marginBottom: 0 }}>Input / Working Text</label>
            <span style={{ fontSize: "0.8rem", color: "var(--tools-text-muted)" }}>
              {text.split("\n").length} lines · {text.length} chars
            </span>
          </div>
          <textarea
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="tool-textarea tool-textarea-mono"
            style={{ fontSize: "0.88rem" }}
          />
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Cleanup & Formatting Operations</span>
          <button type="button" onClick={copyText} className="tool-btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
            <Copy size={13} />
            <span>Copy Text</span>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--tools-text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
              Whitespace & Lines
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button type="button" onClick={() => applyAction("trim")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                Trim Line Margins
              </button>
              <button type="button" onClick={() => applyAction("no-empty")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                Remove Empty Lines
              </button>
              <button type="button" onClick={() => applyAction("no-extra-spaces")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                Collapse Extra Spaces
              </button>
              <button type="button" onClick={() => applyAction("dedup")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                Remove Duplicate Lines
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--tools-text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
              Ordering & Numbering
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button type="button" onClick={() => applyAction("sort-asc")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                Sort Lines A → Z
              </button>
              <button type="button" onClick={() => applyAction("sort-desc")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                Sort Lines Z → A
              </button>
              <button type="button" onClick={() => applyAction("number-lines")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px", gridColumn: "span 2" }}>
                Add Numbered Prefixes (1., 2., 3.)
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--tools-text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
              Letter Case Transformers
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button type="button" onClick={() => applyAction("upper")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                UPPERCASE
              </button>
              <button type="button" onClick={() => applyAction("lower")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                lowercase
              </button>
              <button type="button" onClick={() => applyAction("title")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                Title Case
              </button>
              <button type="button" onClick={() => applyAction("kebab")} className="tool-btn-secondary" style={{ fontSize: "0.8rem", padding: "8px" }}>
                kebab-case
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
