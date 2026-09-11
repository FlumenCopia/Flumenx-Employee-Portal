"use client";

import React, { useState, useMemo } from "react";
import { Copy, Link, QrCode, Check } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function UtmBuilderTool() {
  const [websiteUrl, setWebsiteUrl] = useState("https://flumenx.com/pricing");
  const [source, setSource] = useState("linkedin");
  const [medium, setMedium] = useState("cpc");
  const [campaign, setCampaign] = useState("q3_enterprise_launch");
  const [term, setTerm] = useState("employee_software");
  const [content, setContent] = useState("hero_cta_banner");

  const fullUrl = useMemo(() => {
    if (!websiteUrl.trim()) return "";
    try {
      let base = websiteUrl.trim();
      if (!/^https?:\/\//i.test(base)) {
        base = `https://${base}`;
      }
      const url = new URL(base);
      if (source.trim()) url.searchParams.set("utm_source", source.trim());
      if (medium.trim()) url.searchParams.set("utm_medium", medium.trim());
      if (campaign.trim()) url.searchParams.set("utm_campaign", campaign.trim());
      if (term.trim()) url.searchParams.set("utm_term", term.trim());
      if (content.trim()) url.searchParams.set("utm_content", content.trim());
      return url.toString();
    } catch {
      return "Invalid base URL format.";
    }
  }, [websiteUrl, source, medium, campaign, term, content]);

  const copyUrl = () => {
    if (!fullUrl || fullUrl.startsWith("Invalid")) return;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Tracking URL copied to clipboard!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Website URL *</label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com/landing"
            className="tool-input"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div className="tool-field-group">
            <label className="tool-label">Campaign Source (utm_source) *</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="google, newsletter, linkedin"
              className="tool-input"
            />
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Campaign Medium (utm_medium) *</label>
            <input
              type="text"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              placeholder="cpc, email, social, banner"
              className="tool-input"
            />
          </div>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Campaign Name (utm_campaign) *</label>
          <input
            type="text"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="summer_promo_2026"
            className="tool-input"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div className="tool-field-group">
            <label className="tool-label">Campaign Term (utm_term)</label>
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="paid search keyword"
              className="tool-input"
            />
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Campaign Content (utm_content)</label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="cta_button_blue"
              className="tool-input"
            />
          </div>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Generated Tracking URL</span>
          <button type="button" onClick={copyUrl} className="tool-btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
            <Copy size={13} />
            <span>Copy Link</span>
          </button>
        </div>

        <div
          style={{
            padding: "16px",
            backgroundColor: "var(--tools-surface)",
            borderRadius: "10px",
            border: "1px solid var(--tools-border)",
            fontFamily: "var(--tools-font-mono)",
            fontSize: "0.88rem",
            wordBreak: "break-all",
            lineHeight: "1.6",
            marginBottom: "20px",
          }}
        >
          {fullUrl}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--tools-text-muted)", textTransform: "uppercase" }}>
            Parameters Detected
          </div>
          {[
            { label: "Source", val: source },
            { label: "Medium", val: medium },
            { label: "Campaign", val: campaign },
            { label: "Term", val: term },
            { label: "Content", val: content },
          ]
            .filter((p) => p.val.trim())
            .map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.82rem",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  backgroundColor: "var(--tools-surface-muted)",
                }}
              >
                <span style={{ color: "var(--tools-text-muted)" }}>{p.label}</span>
                <span style={{ fontFamily: "var(--tools-font-mono)", fontWeight: 600 }}>{p.val}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
