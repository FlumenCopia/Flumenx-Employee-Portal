"use client";

import React, { useState, useMemo } from "react";
import { Copy, Code2, Globe, Eye } from "lucide-react";
import { toast } from "@/components/ToastContext";

export function MetaTagGeneratorTool() {
  const [pageTitle, setPageTitle] = useState("Flumenx Toolbox · Free Enterprise Employee Utilities");
  const [description, setDescription] = useState(
    "Unified suite of browser-based client-side tools for marketing, design, accounting, video, and web engineering teams."
  );
  const [canonicalUrl, setCanonicalUrl] = useState("https://flumenx.com/tools");
  const [robots, setRobots] = useState("index, follow");
  const [ogImage, setOgImage] = useState("https://flumenx.com/og-image.jpg");
  const [twitterCard, setTwitterCard] = useState("summary_large_image");
  const [author, setAuthor] = useState("Flumenx Inc.");

  const generatedHtml = useMemo(() => {
    return `<!-- Primary Meta Tags -->
<title>${pageTitle}</title>
<meta name="title" content="${pageTitle}" />
<meta name="description" content="${description}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${canonicalUrl}" />
${author ? `<meta name="author" content="${author}" />\n` : ""
}<!-- Open Graph / Facebook -->
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonicalUrl}" />
<meta property="og:title" content="${pageTitle}" />
<meta property="og:description" content="${description}" />
${ogImage ? `<meta property="og:image" content="${ogImage}" />\n` : ""
}<!-- Twitter -->
<meta property="twitter:card" content="${twitterCard}" />
<meta property="twitter:url" content="${canonicalUrl}" />
<meta property="twitter:title" content="${pageTitle}" />
<meta property="twitter:description" content="${description}" />
${ogImage ? `<meta property="twitter:image" content="${ogImage}" />` : ""}`.trim();
  }, [pageTitle, description, canonicalUrl, robots, ogImage, twitterCard, author]);

  const copyHtml = () => {
    navigator.clipboard.writeText(generatedHtml);
    toast.success("HTML Meta Tags copied to clipboard!");
  };

  return (
    <div className="tool-two-col">
      <div className="tool-controls-panel">
        <div className="tool-field-group">
          <label className="tool-label">Page Title</label>
          <input
            type="text"
            value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            className="tool-input"
          />
          <span className="tool-help-text">{pageTitle.length} / 60 recommended characters</span>
        </div>

        <div className="tool-field-group">
          <label className="tool-label">Meta Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="tool-textarea"
          />
          <span className="tool-help-text">{description.length} / 160 recommended characters</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div className="tool-field-group">
            <label className="tool-label">Canonical URL</label>
            <input
              type="url"
              value={canonicalUrl}
              onChange={(e) => setCanonicalUrl(e.target.value)}
              className="tool-input"
            />
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Robots Indexing</label>
            <select value={robots} onChange={(e) => setRobots(e.target.value)} className="tool-select">
              <option value="index, follow">index, follow (Standard)</option>
              <option value="noindex, follow">noindex, follow</option>
              <option value="noindex, nofollow">noindex, nofollow</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div className="tool-field-group">
            <label className="tool-label">OG / Social Image URL</label>
            <input
              type="url"
              value={ogImage}
              onChange={(e) => setOgImage(e.target.value)}
              className="tool-input"
            />
          </div>

          <div className="tool-field-group">
            <label className="tool-label">Twitter Card Type</label>
            <select value={twitterCard} onChange={(e) => setTwitterCard(e.target.value)} className="tool-select">
              <option value="summary_large_image">Large Image Card (Recommended)</option>
              <option value="summary">Small Thumbnail Card</option>
            </select>
          </div>
        </div>
      </div>

      <div className="tool-output-panel">
        <div className="tool-output-header">
          <span className="tool-output-title">Generated HTML Tags</span>
          <button type="button" onClick={copyHtml} className="tool-btn-primary" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
            <Copy size={13} />
            <span>Copy HTML</span>
          </button>
        </div>

        <pre
          style={{
            padding: "16px",
            backgroundColor: "var(--tools-surface)",
            borderRadius: "10px",
            border: "1px solid var(--tools-border)",
            fontFamily: "var(--tools-font-mono)",
            fontSize: "0.8rem",
            overflowX: "auto",
            maxHeight: "340px",
            color: "var(--tools-text-primary)",
            lineHeight: "1.6",
          }}
        >
          {generatedHtml}
        </pre>

        {/* Social Share Preview Card */}
        <div style={{ marginTop: "16px" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--tools-text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
            Social Card Preview (LinkedIn / Twitter / Meta)
          </div>
          <div style={{ border: "1px solid var(--tools-border)", borderRadius: "10px", overflow: "hidden", backgroundColor: "var(--tools-surface)" }}>
            <div style={{ height: "120px", backgroundColor: "var(--tools-surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tools-text-muted)", fontSize: "0.85rem" }}>
              Social Image: 1200 × 630 px
            </div>
            <div style={{ padding: "12px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--tools-text-muted)", textTransform: "uppercase" }}>{canonicalUrl}</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", margin: "4px 0" }}>{pageTitle}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--tools-text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {description}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
