"use client";

import React from "react";
import { ShieldCheck, Lock } from "lucide-react";

interface PrivacyBadgeProps {
  customText?: string;
  size?: "sm" | "md";
}

export function PrivacyBadge({ customText, size = "md" }: PrivacyBadgeProps) {
  const text = customText || "Processed locally in your browser — zero data leaves your device";

  if (size === "sm") {
    return (
      <div className="tools-privacy-badge-sm">
        <ShieldCheck size={13} className="text-emerald-500" />
        <span>{text}</span>
      </div>
    );
  }

  return (
    <div className="tools-privacy-badge">
      <div className="tools-privacy-icon">
        <ShieldCheck size={16} />
      </div>
      <div className="tools-privacy-content">
        <span className="tools-privacy-title">Client-Side Privacy Guarantee</span>
        <span className="tools-privacy-text">{text}</span>
      </div>
    </div>
  );
}
