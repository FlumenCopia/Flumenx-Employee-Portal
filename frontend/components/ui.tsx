import { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="page-header" style={{ marginBottom: "16px" }}>
      <div>
        {eyebrow && <div className="eyebrow" style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--neon)", fontWeight: 700, marginBottom: "4px" }}>{eyebrow}</div>}
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.25, letterSpacing: "-0.02em" }}>{title}</h1>
        {subtitle && <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0 0", lineHeight: 1.45 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, note, icon, accent }: { label: string; value: string | number; note: string; icon: ReactNode; accent?: boolean }) {
  return (
    <div className={`stat-card ${accent ? "accent" : ""}`}>
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon">{icon}</div>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export function Section({ title, kicker, children, action }: { title: string; kicker?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          {kicker && <span>{kicker}</span>}
          <h2>{title}</h2>
        </div>
        {action || <button type="button" className="ghost-icon" aria-label="More options"><MoreHorizontal size={18} /></button>}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone.toLowerCase()}`}>{children}</span>;
}

export function PrimaryButton({ children, type = "button", onClick, disabled }: { children: ReactNode; type?: "button" | "submit"; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type={type} className="primary-button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <span style={{ fontSize: "36px", fontWeight: 800, color: "var(--neon)", display: "block", marginBottom: "12px" }}>F</span>
      <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--text)" }}>{title}</h3>
      <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}
