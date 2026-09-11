"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Clock, Trash2, ChevronDown, Check } from "lucide-react";
import { useEphemeralToolData } from "../hooks/useEphemeralToolData";

interface PrivacyBadgeProps {
  customText?: string;
  size?: "sm" | "md";
}

export function PrivacyBadge({ customText, size = "md" }: PrivacyBadgeProps) {
  const defaultDesc =
    customText ||
    "Processed 100% locally in your browser RAM. Zero files or data are uploaded to or stored on any server.";

  const {
    timeRemainingFormatted,
    ttlSeconds,
    changeTtl,
    wipeData,
  } = useEphemeralToolData({
    defaultTtlSeconds: 900, // 15 minutes
    hasData: true,
  });

  const [showTtlMenu, setShowTtlMenu] = useState(false);

  if (size === "sm") {
    return (
      <div className="tools-privacy-badge-sm">
        <ShieldCheck size={13} className="text-emerald-600" />
        <span>In-Memory Only · Zero Server Storage</span>
      </div>
    );
  }

  return (
    <div className="tools-privacy-banner">
      <div className="tools-privacy-left">
        <div className="tools-privacy-icon-wrap">
          <ShieldCheck size={18} />
        </div>
        <div className="tools-privacy-info">
          <div className="tools-privacy-headline">
            <span>Client-Side Privacy Guarantee</span>
            <span className="tools-privacy-tag">Zero Server Storage</span>
          </div>
          <p className="tools-privacy-desc">{defaultDesc}</p>
        </div>
      </div>

      <div className="tools-privacy-actions">
        {/* Auto-delete countdown & TTL selector */}
        <div className="tools-ttl-container">
          <div
            className="tools-ttl-pill"
            onClick={() => setShowTtlMenu((prev) => !prev)}
            title="Click to adjust auto-cleanup duration"
          >
            <Clock size={13} className="tools-ttl-clock" />
            <span>Auto-deletes in:</span>
            <strong className="tools-ttl-timer">{timeRemainingFormatted}</strong>
            <ChevronDown size={12} className="tools-ttl-chevron" />
          </div>

          {showTtlMenu && (
            <div className="tools-ttl-dropdown">
              <div className="tools-ttl-dropdown-header">Auto-Delete Timer</div>
              {[
                { label: "5 Minutes", sec: 300 },
                { label: "15 Minutes (Default)", sec: 900 },
                { label: "30 Minutes", sec: 1800 },
                { label: "1 Hour", sec: 3600 },
              ].map((opt) => (
                <button
                  key={opt.sec}
                  type="button"
                  className={`tools-ttl-option ${ttlSeconds === opt.sec ? "active" : ""}`}
                  onClick={() => {
                    changeTtl(opt.sec);
                    setShowTtlMenu(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {ttlSeconds === opt.sec && <Check size={13} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manual Wipe Button */}
        <button
          type="button"
          className="tools-wipe-btn"
          onClick={wipeData}
          title="Immediately wipe all loaded files, previews, and buffers from browser memory"
        >
          <Trash2 size={13} />
          <span>Wipe Memory</span>
        </button>
      </div>
    </div>
  );
}
