export function FlumenxMark({ small = false }: { small?: boolean }) {
  return <div className={small ? "flumenx-mark small" : "flumenx-mark"}><span>F</span><b>LUMENX</b><i /></div>;
}

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(x => x[0]).slice(0, 2).join("");
  return <span className="avatar" style={{ width: size, height: size }}>{initials}</span>;
}
