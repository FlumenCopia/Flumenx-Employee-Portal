"use client";

import React, { useState, useMemo } from "react";
import { Search, Copy, Check, Video } from "lucide-react";
import { videoPresetsConfig, VideoPreset } from "../../config/presets.config";
import { toast } from "@/components/ToastContext";

export function VideoResolutionPresetsTool() {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  const platforms = ["all", "YouTube", "Instagram", "TikTok", "LinkedIn", "Facebook", "Twitter / X"];

  const filteredPresets = useMemo(() => {
    return videoPresetsConfig.filter((item) => {
      const matchesPlatform = platformFilter === "all" || item.platform === platformFilter;
      const matchesSearch =
        search === "" ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase()) ||
        item.aspectRatio.includes(search) ||
        `${item.width}x${item.height}`.includes(search);
      return matchesPlatform && matchesSearch;
    });
  }, [search, platformFilter]);

  const copySpecs = (p: VideoPreset) => {
    const text = `${p.name} (${p.platform})
Resolution: ${p.width} × ${p.height} (${p.aspectRatio})
Format: ${p.recommendedFormat} | FPS: ${p.recommendedFps}
Max File Size: ${p.maxFileSize || "N/A"} | Max Duration: ${p.maxDuration || "N/A"}
Notes: ${p.notes || "None"}`;
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${p.name} specifications!`);
  };

  return (
    <div>
      {/* Search & Platform Filter */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "240px" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter presets (e.g. 'Shorts', '1080', 'Reels', '4K')..."
            className="tool-input"
          />
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatformFilter(p)}
              className={`tool-dept-pill ${platformFilter === p ? "active" : ""}`}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
            >
              {p === "all" ? "All Platforms" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Preset Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
        {filteredPresets.map((preset, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: "var(--tools-surface)",
              border: "1px solid var(--tools-border)",
              borderRadius: "12px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--tools-primary)", textTransform: "uppercase" }}>
                  {preset.platform} · {preset.category}
                </span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    backgroundColor: "var(--tools-surface-muted)",
                    fontFamily: "var(--tools-font-mono)",
                  }}
                >
                  {preset.aspectRatio}
                </span>
              </div>

              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 6px 0" }}>{preset.name}</h3>

              <div style={{ fontSize: "1.25rem", fontWeight: 800, fontFamily: "var(--tools-font-mono)", color: "var(--tools-text-primary)", marginBottom: "12px" }}>
                {preset.width} × {preset.height} px
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.82rem", color: "var(--tools-text-secondary)" }}>
                <div>Format: <b>{preset.recommendedFormat}</b></div>
                <div>Framerate: <b>{preset.recommendedFps}</b></div>
                {preset.maxDuration && <div>Max Duration: <b>{preset.maxDuration}</b></div>}
                {preset.maxFileSize && <div>Max Size: <b>{preset.maxFileSize}</b></div>}
                {preset.notes && <div style={{ color: "var(--tools-text-muted)", fontSize: "0.78rem", marginTop: "4px" }}>{preset.notes}</div>}
              </div>
            </div>

            <button
              type="button"
              onClick={() => copySpecs(preset)}
              className="tool-btn-secondary"
              style={{ marginTop: "16px", width: "100%", fontSize: "0.82rem", padding: "8px" }}
            >
              <Copy size={13} />
              <span>Copy Resolution Specs</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
