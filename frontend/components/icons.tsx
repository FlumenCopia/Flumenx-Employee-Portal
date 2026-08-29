import React, { useState } from "react";

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

  const safeName = (name || "User").trim();
  const words = safeName.split(/\s+/).filter(Boolean);
  let initials = "US";
  if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    initials = words[0].slice(0, 2).toUpperCase();
  } else if (words.length === 1 && words[0].length === 1) {
    initials = words[0].toUpperCase();
  }

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

  return (
    <span
      className="avatar"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.max(10, Math.floor(size * 0.38))}px`,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        backgroundColor: "#087A5B",
        color: "#FFFFFF",
        flexShrink: 0,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {initials}
    </span>
  );
}
