export function FlumenxMark({ small = false }: { small?: boolean }) {
  if (small) {
    return (
      <div className="flumenx-mark small" style={{ display: "inline-flex", alignItems: "center" }}>
        <img src="/flumen-icon.png" alt="FLUMENX Logo" style={{ height: "24px", width: "auto", objectFit: "contain" }} />
      </div>
    );
  }
  return (
    <div className="flumenx-mark" style={{ display: "inline-flex", alignItems: "center" }}>
      <img src="/flumenx-logo.webp" alt="FLUMENX" style={{ height: "28px", width: "auto", objectFit: "contain" }} />
    </div>
  );
}

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(x => x[0]).slice(0, 2).join("");
  return <span className="avatar" style={{ width: size, height: size }}>{initials}</span>;
}
