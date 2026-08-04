import { ReactNode } from "react";
import { ArrowUpRight, MoreHorizontal } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-4 border-b border-[rgba(77,255,160,0.12)]">
      <div className="space-y-1.5">
        {eyebrow && (
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4DFFA0] drop-shadow-[0_0_8px_rgba(77,255,160,0.4)]">
            {eyebrow}
          </div>
        )}
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#89ACA0] max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative group overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
        accent
          ? "bg-gradient-to-br from-[#0F2218] via-[#0A1912] to-[#04120C] border-[rgba(77,255,160,0.25)] shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(77,255,160,0.1)]"
          : "bg-gradient-to-br from-[#0A1912]/90 to-[#050C09]/90 border-[rgba(77,255,160,0.1)] hover:border-[rgba(77,255,160,0.25)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
      }`}
    >
      {/* Top Accent Line */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${
          accent ? "bg-[#4DFFA0] opacity-100 shadow-[0_0_10px_#4DFFA0]" : "bg-[rgba(77,255,160,0.3)] opacity-0 group-hover:opacity-100"
        }`}
      />
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#89ACA0]">
          {label}
        </span>
        <div className="w-8 h-8 rounded-xl bg-[rgba(77,255,160,0.08)] border border-[rgba(77,255,160,0.18)] text-[#4DFFA0] flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <strong className="block text-3xl font-extrabold text-white tracking-tight mb-1 font-sans">
        {value}
      </strong>
      <small className="text-[11px] text-[#4A6B5E] block font-medium">
        {note}
      </small>
    </div>
  );
}

export function Section({
  title,
  kicker,
  children,
  action,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[rgba(77,255,160,0.12)] bg-gradient-to-b from-[#0A1912] to-[#050C09] shadow-xl overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-[rgba(77,255,160,0.1)] flex items-center justify-between gap-4">
        <div>
          {kicker && (
            <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#4DFFA0] block mb-0.5">
              {kicker}
            </span>
          )}
          <h2 className="font-serif text-lg font-bold text-white tracking-tight">
            {title}
          </h2>
        </div>
        {action || (
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#89ACA0] hover:text-white hover:bg-[rgba(77,255,160,0.08)] transition-colors">
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  const toneMap: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    important: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-[#4DFFA0]/10 text-[#4DFFA0] border-[#4DFFA0]/25",
    active: "bg-[#4DFFA0]/10 text-[#4DFFA0] border-[#4DFFA0]/25",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    urgent: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    inactive: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    neutral: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  };
  const style = toneMap[tone.toLowerCase()] || toneMap.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${style}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  type = "button",
  onClick,
  disabled,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4DFFA0] to-[#3ce088] text-[#020806] font-bold text-xs tracking-wider uppercase shadow-[0_6px_20px_rgba(77,255,160,0.25)] hover:shadow-[0_10px_28px_rgba(77,255,160,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
      onClick={onClick}
      disabled={disabled}
    >
      <span>{children}</span>
      <ArrowUpRight size={16} />
    </button>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-dashed border-[rgba(77,255,160,0.18)] bg-[rgba(10,25,18,0.4)] my-4">
      <div className="w-14 h-14 rounded-2xl bg-[rgba(77,255,160,0.08)] border border-[rgba(77,255,160,0.2)] text-[#4DFFA0] font-extrabold text-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(77,255,160,0.15)]">
        F
      </div>
      <h3 className="font-serif text-lg font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-[#89ACA0] max-w-sm">{text}</p>
    </div>
  );
}
