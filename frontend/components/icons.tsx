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

export function Avatar({ name = "", size = 38 }: { name?: string; size?: number }) {
  const safeName = name || "User";
  const initials = safeName
    .split(" ")
    .map(x => (x ? x[0] : ""))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
  return <span className="avatar" style={{ width: size, height: size }}>{initials}</span>;
}
