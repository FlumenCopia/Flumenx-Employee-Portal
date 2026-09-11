"use client";

import React, { useState, useMemo } from "react";
import { Copy, Sparkles, Check } from "lucide-react";
import { toast } from "@/components/ToastContext";

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "about", "above", "after", "along", "for", "from", "in", "into", "of", "off", "on", "onto", "out", "over", "to", "with", "at", "by"
]);

export function SlugGeneratorTool() {
  const [inputTitle, setInputTitle] = useState("10 Best Digital Marketing Tips for High ROI in 2026!");
  const [separator, setSeparator] = useState<"-" | "_">("-");
  const [lowercase, setLowercase] = useState(true);
  const [removeStopWords, setRemoveStopWords] = useState(false);
  const [maxLength, setMaxLength] = useState<number>(80);

  const slug = useMemo(() => {
    if (!inputTitle.trim()) return "";

    // 1. Normalize accents (e.g. café -> cafe)
    let str = inputTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 2. Case
    if (lowercase) {
      str = str.toLowerCase();
    }

    // 3. Clean special characters and split
    let words = str
      .replace(/[^a-zA-Z0-9\s-_]/g, "")
      .trim()
      .split(/[\s-_]+/);

    // 4. Filter stop words if enabled
    if (removeStopWords) {
      words = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
    }

    // 5. Join
    let res = words.join(separator);

    // 6. Max length trim
    if (maxLength > 0 && res.length > maxLength) {
      res = res.slice(0, maxLength).replace(new RegExp(`[${separator}]+$`), "");
    }

    return res;
  }, [inputTitle, separator, lowercase, removeStopWords, maxLength]);

  const copySlug = () => {
    if (!slug) return;
    navigator.clipboard.writeText(slug);
    toast.success("Slug copied to clipboard!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Article / Page Title</label>
          <input
            type="text"
            value={inputTitle}
            onChange={(e) => setInputTitle(e.target.value)}
            placeholder="e.g. 10 Best Digital Marketing Tips 2026"
            className="tool-input"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div className="tool-field-group">
            <label className="tool-label">Word Separator</label>
            <select value={separator} onChange={(e) => setSeparator(e.target.value as any)} className="tool-select">
              <option value="-">Hyphen (-)</option>
              <option value="_">Underscore (_)</option>
            </select>
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Max Length (chars): {maxLength || "No limit"}</label>
            <input
              type="number"
              min="0"
              max="200"
              value={maxLength}
              onChange={(e) => setMaxLength(Number(e.target.value))}
              className="tool-input"
            />
          </div>
        </div>

        <div className="tool-field-group" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={lowercase}
              onChange={(e) => setLowercase(e.target.checked)}
              style={{ accentColor: "var(--tools-primary)" }}
            />
            <span>Convert to Lowercase</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={removeStopWords}
              onChange={(e) => setRemoveStopWords(e.target.checked)}
              style={{ accentColor: "var(--tools-primary)" }}
            />
            <span>Remove common stop words (a, the, in, for, of)</span>
          </label>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Clean URL Slug</span>
          <button type="button" onClick={copySlug} className="tool-btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
            <Copy size={13} />
            <span>Copy Slug</span>
          </button>
        </div>

        <div
          style={{
            padding: "16px",
            backgroundColor: "var(--tools-surface)",
            borderRadius: "10px",
            border: "1px solid var(--tools-border)",
            fontFamily: "var(--tools-font-mono)",
            fontSize: "1.05rem",
            fontWeight: 700,
            color: "var(--tools-primary)",
            wordBreak: "break-all",
            marginBottom: "16px",
          }}
        >
          {slug || "your-slug-appears-here"}
        </div>

        <div style={{ padding: "14px", backgroundColor: "var(--tools-surface-subtle)", borderRadius: "8px", border: "1px solid var(--tools-border)" }}>
          <div style={{ fontSize: "0.78rem", color: "var(--tools-text-muted)", marginBottom: "4px" }}>Full URL Preview:</div>
          <div style={{ fontFamily: "var(--tools-font-mono)", fontSize: "0.85rem", color: "var(--tools-text-secondary)", wordBreak: "break-all" }}>
            https://flumenx.com/blog/{slug || "slug"}
          </div>
        </div>
      </div>
    </div>
  );
}
