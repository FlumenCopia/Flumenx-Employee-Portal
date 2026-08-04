import { ReactNode } from "react";
import { ArrowUpRight, MoreHorizontal } from "lucide-react";

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
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
        {action || <button className="ghost-icon"><MoreHorizontal size={20} /></button>}
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
      <ArrowUpRight size={17} />
    </button>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <span>F</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
