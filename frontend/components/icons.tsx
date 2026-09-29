import React, { useState, useEffect } from "react";
import { User } from "lucide-react";

export function FlumenxMark({ small = false, height }: { small?: boolean; height?: number }) {
  if (small) {
    const h = height || 24;
    return (
      <div className="flumenx-mark small" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "visible", maxWidth: "100%" }}>
        <img
          src="/flumen-icon.png"
          alt="FLUMENX Logo"
          style={{ height: `${h}px`, width: "auto", maxWidth: "100%", objectFit: "contain", flexShrink: 0, display: "block" }}
        />
      </div>
    );
  }
  const h = height || 32;
  return (
    <div className="flumenx-mark" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "visible", maxWidth: "100%" }}>
      <img
        src="/flumenx-dashboard-official-logo.png"
        alt="FLUMENX"
        style={{ height: `${h}px`, width: "auto", maxWidth: "100%", objectFit: "contain", flexShrink: 0, display: "block" }}
      />
    </div>
  );
}

export function Avatar({ name = "", avatar = "", size = 38 }: { name?: string; avatar?: string; size?: number }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatar]);

  const safeName = (name || "User").trim();

  if (avatar && !imgError) {
    let src = avatar;
    if (!src.startsWith("http") && !src.startsWith("data:")) {
      src = src.startsWith("/") ? src : `/${src}`;
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={safeName}
        onError={() => setImgError(true)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1.5px solid rgba(255, 255, 255, 0.15)",
          display: "inline-block",
        }}
      />
    );
  }

  const iconSize = Math.max(12, Math.round(size * 0.5));

  return (
    <span
      className="avatar"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        border: "1.5px solid rgba(255, 255, 255, 0.14)",
        color: "#E2E8F0",
        flexShrink: 0,
      }}
    >
      <User size={iconSize} />
    </span>
  );
}
