import { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { TOKENS } from "./design-system/tokens";

export * from "./design-system";

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="page-header" style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
      <div>
        {eyebrow && <div className="eyebrow" style={{ fontSize: "11px", letterSpacing: "0.08em", color: TOKENS.colors.brandPrimary, fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>{eyebrow}</div>}
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: TOKENS.colors.textPrimary, margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{title}</h1>
        {subtitle && <p style={{ fontSize: "13px", color: TOKENS.colors.textSecondary, margin: "6px 0 0 0", lineHeight: 1.45, maxWidth: "700px" }}>{subtitle}</p>}
      </div>
      {action && <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, note, icon, accent }: { label: string; value: string | number; note: string; icon: ReactNode; accent?: boolean }) {
  return (
    <div className={`stat-card ${accent ? "accent" : ""}`} style={{
      backgroundColor: TOKENS.colors.surfacePanel,
      border: `1px solid ${TOKENS.colors.borderLight}`,
      borderTop: accent ? `3px solid ${TOKENS.colors.brandPrimary}` : `1px solid ${TOKENS.colors.borderLight}`,
      borderRadius: TOKENS.radius.lg,
      padding: "20px",
      boxShadow: TOKENS.shadows.sm,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      minHeight: "120px",
    }}>
      <div className="stat-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: TOKENS.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        <div className="stat-icon" style={{
          width: "32px",
          height: "32px",
          borderRadius: TOKENS.radius.sm,
          backgroundColor: accent ? TOKENS.colors.brandSubtle : TOKENS.colors.surfaceSubtle,
          color: accent ? TOKENS.colors.brandPrimary : TOKENS.colors.textSecondary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${accent ? TOKENS.colors.brandBorder : TOKENS.colors.borderLight}`,
        }}>{icon}</div>
      </div>
      <strong style={{ fontSize: "26px", fontWeight: 700, color: TOKENS.colors.textPrimary, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</strong>
      <small style={{ fontSize: "12px", color: TOKENS.colors.textMuted, marginTop: "4px" }}>{note}</small>
    </div>
  );
}

export function Section({ title, kicker, children, action }: { title: string; kicker?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel" style={{
      backgroundColor: TOKENS.colors.surfacePanel,
      border: `1px solid ${TOKENS.colors.borderLight}`,
      borderRadius: TOKENS.radius.lg,
      boxShadow: TOKENS.shadows.sm,
      marginBottom: "24px",
      overflow: "hidden",
    }}>
      <div className="panel-head" style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${TOKENS.colors.borderLight}`,
        backgroundColor: TOKENS.colors.surfaceSubtle,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
      }}>
        <div>
          {kicker && <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: TOKENS.colors.brandPrimary, textTransform: "uppercase", display: "block", marginBottom: "2px" }}>{kicker}</span>}
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: TOKENS.colors.textPrimary }}>{title}</h2>
        </div>
        {action || <button type="button" className="ghost-icon" aria-label="More options" style={{ background: "transparent", border: "none", color: TOKENS.colors.textSecondary, cursor: "pointer" }}><MoreHorizontal size={18} /></button>}
      </div>
      <div style={{ padding: "20px" }}>
        {children}
      </div>
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone.toLowerCase()}`}>{children}</span>;
}

export function PrimaryButton({ children, type = "button", onClick, disabled }: { children: ReactNode; type?: "button" | "submit"; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type={type}
      className="primary-button"
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: TOKENS.colors.brandPrimary,
        color: "#FFFFFF",
        border: `1px solid ${TOKENS.colors.brandPrimary}`,
        padding: "0 16px",
        height: "38px",
        fontSize: "13px",
        fontWeight: 600,
        borderRadius: TOKENS.radius.md,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        boxShadow: TOKENS.shadows.sm,
      }}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state" style={{
      textAlign: "center",
      padding: "48px 24px",
      backgroundColor: TOKENS.colors.surfacePanel,
      border: `1px dashed ${TOKENS.colors.borderMedium}`,
      borderRadius: TOKENS.radius.lg,
    }}>
      <div style={{
        width: "44px",
        height: "44px",
        borderRadius: TOKENS.radius.full,
        backgroundColor: TOKENS.colors.brandSubtle,
        color: TOKENS.colors.brandPrimary,
        fontSize: "20px",
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "14px",
      }}>
        F
      </div>
      <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 6px 0", color: TOKENS.colors.textPrimary }}>{title}</h3>
      <p style={{ fontSize: "13px", color: TOKENS.colors.textMuted, margin: 0, lineHeight: 1.45, maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>{text}</p>
    </div>
  );
}
