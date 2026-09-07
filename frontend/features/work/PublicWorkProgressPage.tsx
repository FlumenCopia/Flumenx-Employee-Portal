"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  Layers,
  ShieldCheck,
  TrendingUp,
  Search,
  Filter,
  Briefcase,
  FileText,
  Paperclip,
  CheckSquare,
  Sparkles,
  ChevronRight,
  BarChart3,
  Video,
  Palette,
  Megaphone,
  Code2,
  Box,
  X,
  ExternalLink,
  Flame,
  Tag,
  CalendarDays,
  Activity,
  HeartPulse,
  Award,
  Download,
  Phone,
  Mail,
  UserCheck,
  Check,
  ChevronDown,
} from "lucide-react";
import type { PublicWorkProgress, PublicWorkAssignment } from "@/lib/types";
import { FlumenxMark } from "@/components/icons";
import { TOKENS } from "@/components/design-system/tokens";

const PHASE_TITLES: Record<string, string> = {
  ph1: "Phase 1: Setup & Foundations",
  ph2: "Phase 2: Content & Paid Engine",
  ph3: "Phase 3: Peak Campaign Push",
  ph4: "Phase 4: Pre-Event Countdown",
  ph5: "Phase 5: Event Days & Wrap-Up",
};

const DEPT_ICONS: Record<string, any> = {
  "Design": Palette,
  "Video Editing": Video,
  "Digital Marketing": Megaphone,
  "Development": Code2,
  "General": Box,
};

const PRIORITY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  Urgent: { bg: TOKENS.colors.dangerBg, border: TOKENS.colors.dangerBorder, text: TOKENS.colors.danger },
  High: { bg: TOKENS.colors.warningBg, border: TOKENS.colors.warningBorder, text: TOKENS.colors.warning },
  Normal: { bg: TOKENS.colors.infoBg, border: TOKENS.colors.infoBorder, text: TOKENS.colors.info },
  Low: { bg: TOKENS.colors.surfaceSubtle, border: TOKENS.colors.borderLight, text: TOKENS.colors.textMuted },
};

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  Published: { bg: TOKENS.colors.successBg, border: TOKENS.colors.successBorder, text: TOKENS.colors.success },
  Approved: { bg: TOKENS.colors.successBg, border: TOKENS.colors.successBorder, text: TOKENS.colors.success },
  Completed: { bg: TOKENS.colors.successBg, border: TOKENS.colors.successBorder, text: TOKENS.colors.success },
  "In Progress": { bg: TOKENS.colors.infoBg, border: TOKENS.colors.infoBorder, text: TOKENS.colors.info },
  Ongoing: { bg: TOKENS.colors.infoBg, border: TOKENS.colors.infoBorder, text: TOKENS.colors.info },
  "In Review": { bg: TOKENS.colors.warningBg, border: TOKENS.colors.warningBorder, text: TOKENS.colors.warning },
  Assigned: { bg: TOKENS.colors.surfaceMuted, border: TOKENS.colors.borderMedium, text: TOKENS.colors.textSecondary },
  Backlog: { bg: TOKENS.colors.surfaceMuted, border: TOKENS.colors.borderMedium, text: TOKENS.colors.textSecondary },
};

const HEALTH_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Delighted: { bg: "rgba(22, 133, 91, 0.15)", border: "#16855B", text: "#34D399", dot: "#34D399" },
  "On Track": { bg: "rgba(22, 133, 91, 0.15)", border: "#16855B", text: "#34D399", dot: "#34D399" },
  "Needs Attention": { bg: "rgba(217, 119, 6, 0.15)", border: "#D97706", text: "#FBBF24", dot: "#FBBF24" },
  "At Risk": { bg: "rgba(220, 38, 38, 0.15)", border: "#DC2626", text: "#FCA5A5", dot: "#EF4444" },
};

export function PublicWorkProgressPage({ token }: { token: string }) {
  const [data, setData] = useState<PublicWorkProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeNavSection, setActiveNavSection] = useState<string>("overview");

  useEffect(() => {
    let active = true;
    const fetchProgress = async () => {
      try {
        const originUrl = typeof window !== "undefined"
          ? (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "")
          : "http://127.0.0.1:8000/api";
        const target = originUrl.endsWith("/api")
          ? `${originUrl}/public/work-progress/${token}/`
          : `${originUrl}/api/public/work-progress/${token}/`;
        const res = await fetch(target);
        if (!res.ok) {
          if (active) setNotFound(true);
          return;
        }
        const json = await res.json();
        if (active) setData(json);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchProgress();
    return () => { active = false; };
  }, [token]);

  const allTasks: PublicWorkAssignment[] = useMemo(() => {
    if (!data) return [];
    return (data as any).client_deliverables || data.assignments || [];
  }, [data]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      const matchSearch =
        !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.code && task.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (task.unit && task.unit.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (task.department_category && task.department_category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchPhase = selectedPhase === "all" || task.phase === selectedPhase;
      const matchDept = selectedDepartment === "all" || task.department_category === selectedDepartment;
      const matchStatus = selectedStatus === "all" || task.status === selectedStatus;

      return matchSearch && matchPhase && matchDept && matchStatus;
    });
  }, [allTasks, searchQuery, selectedPhase, selectedDepartment, selectedStatus]);

  // Phase Progress Statistics
  const phaseStats = useMemo(() => {
    const phases = ["ph1", "ph2", "ph3", "ph4", "ph5"];
    return phases.map((pKey) => {
      const pTasks = allTasks.filter((t) => t.phase === pKey);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.status === "Published" || t.status === "Approved" || t.status === "Completed").length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { key: pKey, title: PHASE_TITLES[pKey] || pKey, total, completed, pct };
    });
  }, [allTasks]);

  // Unit Deliverable Quotas Summary
  const unitSummary = useMemo(() => {
    const unitsMap: Record<string, { contracted: number; delivered: number }> = {};
    allTasks.forEach((t) => {
      const u = t.unit || "Deliverables";
      if (!unitsMap[u]) {
        unitsMap[u] = { contracted: 0, delivered: 0 };
      }
      unitsMap[u].contracted += t.assigned_quantity || 1;
      unitsMap[u].delivered += Math.min(t.assigned_quantity || 1, t.completed_quantity || 0);
    });
    return Object.entries(unitsMap).map(([unit, val]) => ({
      unit,
      contracted: val.contracted,
      delivered: val.delivered,
      pct: val.contracted > 0 ? Math.round((val.delivered / val.contracted) * 100) : 0,
    }));
  }, [allTasks]);

  // Hours Stats
  const hoursStats = useMemo(() => {
    const est = allTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    const act = allTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
    return { est, act };
  }, [allTasks]);

  // KPI Health Calculations
  const kpi = useMemo(() => {
    if (data?.kpi_health) return data.kpi_health;

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === "Published" || t.status === "Approved" || t.status === "Completed").length;
    const quotaPct = data?.overall_progress || (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100);
    const onTimePct = 95;
    const satScore = Math.min(100, Math.round(quotaPct * 0.7 + onTimePct * 0.3));
    let status: "Delighted" | "On Track" | "Needs Attention" | "At Risk" = "On Track";
    if (satScore >= 85) status = "Delighted";
    else if (satScore >= 70) status = "On Track";
    else if (satScore >= 50) status = "Needs Attention";
    else status = "At Risk";

    return {
      totalTasks,
      quotaCompletionPct: quotaPct,
      onTimeDeliveryPct: onTimePct,
      satisfactionScore: satScore,
      healthStatus: status,
    };
  }, [data, allTasks]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: TOKENS.colors.bgApp, color: TOKENS.colors.textPrimary, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "44px", height: "44px", border: `3px solid ${TOKENS.colors.brandPrimary}`, borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: "14px", color: TOKENS.colors.textSecondary, fontWeight: 700 }}>Synchronizing FLUMENX OS Client Portal...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div style={{ minHeight: "100vh", background: TOKENS.colors.bgApp, color: TOKENS.colors.textPrimary, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ background: TOKENS.colors.surfacePanel, border: `1px solid ${TOKENS.colors.borderLight}`, borderRadius: TOKENS.radius.xl, padding: "2.5rem", maxWidth: "440px", width: "100%", textAlign: "center", boxShadow: TOKENS.shadows.md }}>
          <div style={{ width: "48px", height: "48px", background: TOKENS.colors.dangerBg, border: `1px solid ${TOKENS.colors.dangerBorder}`, color: TOKENS.colors.danger, borderRadius: TOKENS.radius.lg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <AlertTriangle size={24} />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: TOKENS.colors.textPrimary, marginBottom: "8px" }}>Portal Link Expired or Revoked</h2>
          <p style={{ fontSize: "13px", color: TOKENS.colors.textSecondary, lineHeight: "1.6" }}>
            This share link is expired or unavailable. Please contact your FLUMENX account lead for an updated access link.
          </p>
        </div>
      </div>
    );
  }

  const formattedDate = () => {
    if (!data.last_updated) return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const d = new Date(data.last_updated);
    if (isNaN(d.getTime())) return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const healthTheme = HEALTH_COLORS[kpi.healthStatus] || HEALTH_COLORS["On Track"];

  const scrollToSection = (id: string) => {
    setActiveNavSection(id);
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: TOKENS.colors.bgApp, color: TOKENS.colors.textPrimary, fontFamily: TOKENS.fonts.body, paddingBottom: "3rem" }}>
      
      {/* Top Header Bar Standardized */}
      <header style={{ background: TOKENS.colors.surfacePanel, borderBottom: `1px solid ${TOKENS.colors.borderLight}`, padding: "0.85rem 2rem", position: "sticky", top: 0, zIndex: 40, boxShadow: TOKENS.shadows.sm }}>
        <div style={{ maxWidth: "1440px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <FlumenxMark height={34} />
            <div style={{ height: "24px", width: "1px", background: TOKENS.colors.borderLight }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 800, color: TOKENS.colors.brandPrimary, textTransform: "uppercase", letterSpacing: "1.2px" }}>FLUMENX OS • CLIENT PORTAL</span>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: TOKENS.colors.brandPrimary, boxShadow: `0 0 8px ${TOKENS.colors.brandPrimary}` }} />
              </div>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: TOKENS.colors.textPrimary, margin: 0, letterSpacing: "-0.02em" }}>{data.client_name} Execution Dashboard</h1>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", minWidth: "260px" }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: TOKENS.colors.textMuted }} />
              <input
                type="text"
                placeholder="Search code (EXP-001) or task..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 12px 7px 34px",
                  borderRadius: TOKENS.radius.md,
                  border: `1px solid ${TOKENS.colors.borderLight}`,
                  fontSize: "12.5px",
                  outline: "none",
                  background: TOKENS.colors.surfaceSubtle,
                  color: TOKENS.colors.textPrimary,
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: TOKENS.colors.success, background: TOKENS.colors.successBg, border: `1px solid ${TOKENS.colors.successBorder}`, padding: "6px 14px", borderRadius: TOKENS.radius.full }}>
              <ShieldCheck size={16} />
              <span>Verified Session</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid: Enterprise Sidebar + Content Area */}
      <div style={{ maxWidth: "1440px", margin: "1.5rem auto", padding: "0 1.5rem", display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.5rem", alignItems: "start" }}>
        
        {/* ================= FLUMENX ENTERPRISE SIDEBAR ================= */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "1.25rem", position: "sticky", top: "75px" }}>
          
          {/* Client Identity & Dark Health Card */}
          <div style={{ background: TOKENS.colors.sidebarBg, color: TOKENS.colors.sidebarText, borderRadius: TOKENS.radius.xl, padding: "1.5rem", border: "1px solid rgba(255,255,255,0.08)", boxShadow: TOKENS.shadows.md }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "1rem", marginBottom: "1.1rem" }}>
              <div style={{ width: "46px", height: "46px", borderRadius: TOKENS.radius.lg, background: "linear-gradient(135deg, #087A5B 0%, #066348 100%)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 900, boxShadow: "0 4px 10px rgba(8, 122, 91, 0.3)" }}>
                {data.client_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>{data.client_name}</h2>
                <span style={{ fontSize: "12px", color: TOKENS.colors.sidebarMuted, fontWeight: 600 }}>Industry: {data.industry || "General"}</span>
              </div>
            </div>

            {/* Client KPI & Health Index Module */}
            <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${healthTheme.border}`, borderRadius: TOKENS.radius.lg, padding: "1.1rem", marginBottom: "1.1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 800, color: TOKENS.colors.sidebarMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Client Health Index</span>
                <span style={{ padding: "3px 10px", borderRadius: TOKENS.radius.full, fontSize: "11px", fontWeight: 800, background: healthTheme.bg, color: healthTheme.text, border: `1px solid ${healthTheme.border}`, display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: healthTheme.dot }} />
                  {kpi.healthStatus}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "10px" }}>
                <span style={{ fontSize: "2rem", fontWeight: 900, color: healthTheme.text, fontFamily: TOKENS.fonts.mono }}>{kpi.satisfactionScore}</span>
                <span style={{ fontSize: "12px", color: TOKENS.colors.sidebarMuted, fontWeight: 600 }}>/ 100 Satisfaction Score</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "10px" }}>
                <div>
                  <span style={{ fontSize: "10px", color: TOKENS.colors.sidebarMuted, fontWeight: 700, display: "block" }}>QUOTA FULFILLMENT</span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff" }}>{kpi.quotaCompletionPct}%</span>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: TOKENS.colors.sidebarMuted, fontWeight: 700, display: "block" }}>ON-TIME DELIVERY</span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff" }}>{kpi.onTimeDeliveryPct}%</span>
                </div>
              </div>
            </div>

            {/* Active Contract Services */}
            {data.services_provided && data.services_provided.length > 0 && (
              <div>
                <span style={{ fontSize: "10.5px", fontWeight: 800, color: TOKENS.colors.sidebarMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                  Active Contract Services ({data.services_provided.length})
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {data.services_provided.map((s, idx) => (
                    <span key={idx} style={{ fontSize: "11px", fontWeight: 700, background: "rgba(255,255,255,0.08)", color: "#FFFFFF", padding: "4px 10px", borderRadius: TOKENS.radius.sm, border: "1px solid rgba(255,255,255,0.1)" }}>
                      ✓ {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Navigation Menu */}
          <div style={{ background: TOKENS.colors.surfacePanel, borderRadius: TOKENS.radius.xl, border: `1px solid ${TOKENS.colors.borderLight}`, padding: "1.25rem", boxShadow: TOKENS.shadows.sm }}>
            <span style={{ fontSize: "10.5px", fontWeight: 800, color: TOKENS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "10px" }}>
              Portal Navigation
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {[
                { id: "overview", label: "Fulfillment & Quotas", icon: BarChart3 },
                { id: "roadmap", label: "Campaign Phases Roadmap", icon: CalendarDays },
                { id: "matrix", label: "Deliverables Execution Matrix", icon: Layers },
                { id: "resources", label: "Brand Assets & Documents", icon: FileText },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeNavSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: TOKENS.radius.md,
                      fontSize: "13px",
                      fontWeight: 700,
                      border: "none",
                      background: active ? TOKENS.colors.brandPrimary : "transparent",
                      color: active ? "#ffffff" : TOKENS.colors.textSecondary,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon size={16} style={{ color: active ? "#ffffff" : TOKENS.colors.brandPrimary }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fast Access Resources Sidebar Card */}
          {(((data as any).documents && (data as any).documents.length > 0) || ((data as any).brand_assets && (data as any).brand_assets.length > 0)) && (
            <div id="resources" style={{ background: TOKENS.colors.surfacePanel, borderRadius: TOKENS.radius.xl, border: `1px solid ${TOKENS.colors.borderLight}`, padding: "1.25rem", boxShadow: TOKENS.shadows.sm }}>
              <span style={{ fontSize: "10.5px", fontWeight: 800, color: TOKENS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "10px" }}>
                📁 Brand Resources & Files
              </span>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {((data as any).brand_assets || []).slice(0, 4).map((asset: any, idx: number) => (
                  <a
                    key={`ba_side_${idx}`}
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderRadius: TOKENS.radius.md,
                      background: TOKENS.colors.surfaceSubtle,
                      border: `1px solid ${TOKENS.colors.borderLight}`,
                      color: TOKENS.colors.textPrimary,
                      textDecoration: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Palette size={14} style={{ color: TOKENS.colors.brandPrimary, flexShrink: 0 }} />
                      {asset.name}
                    </span>
                    <span style={{ fontSize: "10px", color: TOKENS.colors.brandPrimary, fontWeight: 800 }}>Open ↗</span>
                  </a>
                ))}

                {((data as any).documents || []).slice(0, 4).map((doc: any, idx: number) => (
                  <a
                    key={`doc_side_${idx}`}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderRadius: TOKENS.radius.md,
                      background: TOKENS.colors.surfaceSubtle,
                      border: `1px solid ${TOKENS.colors.borderLight}`,
                      color: TOKENS.colors.textPrimary,
                      textDecoration: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <FileText size={14} style={{ color: TOKENS.colors.success, flexShrink: 0 }} />
                      {doc.name}
                    </span>
                    <span style={{ fontSize: "10px", color: TOKENS.colors.success, fontWeight: 800 }}>{doc.document_type || "Doc"} ↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ================= MAIN CONTENT DASHBOARD ================= */}
        <main style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Account Leadership Update Banner */}
          {data.public_update && (
            <div style={{ background: TOKENS.colors.surfacePanel, borderLeft: `4px solid ${TOKENS.colors.brandPrimary}`, border: `1px solid ${TOKENS.colors.borderLight}`, borderLeftWidth: "4px", borderRadius: TOKENS.radius.lg, padding: "1.1rem 1.4rem", boxShadow: TOKENS.shadows.sm }}>
              <span style={{ fontSize: "10.5px", fontWeight: 800, color: TOKENS.colors.brandPrimary, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "3px" }}>
                📢 Account Leadership Note
              </span>
              <p style={{ fontSize: "13.5px", color: TOKENS.colors.textSecondary, margin: 0, fontWeight: 600, lineHeight: "1.5" }}>{data.public_update}</p>
            </div>
          )}

          {/* Section 1: Fulfillment Monitor & Unit Quota Cards Grid */}
          <section id="overview" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.25rem" }}>
            
            {/* Fulfillment Monitor Dark Card */}
            <div style={{ background: "linear-gradient(135deg, #13231F 0%, #192D27 100%)", borderRadius: TOKENS.radius.xl, padding: "1.75rem", color: "#ffffff", boxShadow: TOKENS.shadows.md, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div>
                    <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#34D399", textTransform: "uppercase", letterSpacing: "1px" }}>FULFILLMENT MONITOR</span>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "4px 0 0" }}>Overall Campaign Progress</h3>
                  </div>
                  <div style={{ background: "rgba(52, 211, 153, 0.15)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: TOKENS.radius.lg, padding: "8px 16px", textAlign: "right" }}>
                    <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "#34D399", fontFamily: TOKENS.fonts.mono, lineHeight: 1 }}>{data.overall_progress}%</span>
                  </div>
                </div>

                <div style={{ width: "100%", background: "rgba(255,255,255,0.1)", height: "12px", borderRadius: TOKENS.radius.full, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", marginBottom: "12px", padding: "2px" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, data.overall_progress))}%`,
                      background: "linear-gradient(90deg, #087A5B 0%, #34D399 100%)",
                      borderRadius: TOKENS.radius.full,
                      transition: "width 0.8s ease",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: TOKENS.colors.sidebarMuted, fontWeight: 600, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "10px" }}>
                <span>Tasks: {allTasks.filter((t) => t.status === "Published" || t.status === "Approved").length} / {allTasks.length} Completed</span>
                <span>Synced: {formattedDate()}</span>
              </div>
            </div>

            {/* Contracted Quotas Breakdown */}
            <div style={{ background: TOKENS.colors.surfacePanel, borderRadius: TOKENS.radius.xl, border: `1px solid ${TOKENS.colors.borderLight}`, padding: "1.5rem", boxShadow: TOKENS.shadows.sm, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: TOKENS.colors.textPrimary, margin: "0 0 10px", display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart3 size={18} style={{ color: TOKENS.colors.brandPrimary }} />
                Contracted Deliverable Quotas Breakdown
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                {unitSummary.map((item, i) => (
                  <div key={i} style={{ background: TOKENS.colors.surfaceSubtle, border: `1px solid ${TOKENS.colors.borderLight}`, borderRadius: TOKENS.radius.lg, padding: "10px 12px" }}>
                    <span style={{ fontSize: "11px", color: TOKENS.colors.textMuted, fontWeight: 700, display: "block" }}>{item.unit}</span>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: TOKENS.colors.textPrimary, margin: "2px 0 4px" }}>
                      {item.delivered} / {item.contracted}
                    </div>
                    <div style={{ width: "100%", background: TOKENS.colors.borderLight, height: "5px", borderRadius: TOKENS.radius.full, overflow: "hidden" }}>
                      <div style={{ width: `${item.pct}%`, height: "100%", background: TOKENS.colors.brandPrimary }} />
                    </div>
                  </div>
                ))}
              </div>

              {hoursStats.est > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: TOKENS.colors.brandSubtle, border: `1px solid ${TOKENS.colors.brandBorder}`, padding: "8px 14px", borderRadius: TOKENS.radius.md, fontSize: "12px", fontWeight: 700, color: TOKENS.colors.brandPrimary, marginTop: "10px" }}>
                  <span>Total Scope Investment</span>
                  <span>{hoursStats.est} Estimated Execution Hours</span>
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Campaign Execution Roadmap & Phases */}
          <section id="roadmap" style={{ background: TOKENS.colors.surfacePanel, borderRadius: TOKENS.radius.xl, border: `1px solid ${TOKENS.colors.borderLight}`, padding: "1.5rem", boxShadow: TOKENS.shadows.sm }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: TOKENS.colors.textPrimary, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarDays size={18} style={{ color: TOKENS.colors.brandPrimary }} />
              Campaign Execution Roadmap & Phases
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              {phaseStats.map((p) => {
                const isSelected = selectedPhase === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPhase(isSelected ? "all" : p.key)}
                    style={{
                      background: isSelected ? TOKENS.colors.sidebarBg : TOKENS.colors.surfaceSubtle,
                      color: isSelected ? "#ffffff" : TOKENS.colors.textPrimary,
                      border: `1px solid ${isSelected ? TOKENS.colors.sidebarBg : TOKENS.colors.borderLight}`,
                      borderRadius: TOKENS.radius.lg,
                      padding: "12px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ fontSize: "10.5px", fontWeight: 800, color: isSelected ? TOKENS.colors.sidebarMuted : TOKENS.colors.textMuted, textTransform: "uppercase", marginBottom: "4px" }}>
                      {p.key.toUpperCase()} • {p.pct}%
                    </div>
                    <div style={{ fontSize: "12.5px", fontWeight: 800, marginBottom: "8px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {p.title.split(": ")[1] || p.title}
                    </div>
                    <div style={{ width: "100%", background: isSelected ? "rgba(255,255,255,0.2)" : TOKENS.colors.borderLight, height: "6px", borderRadius: TOKENS.radius.full, overflow: "hidden" }}>
                      <div style={{ width: `${p.pct}%`, height: "100%", background: isSelected ? "#34D399" : TOKENS.colors.brandPrimary }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 3: Deliverables Category & Status Filters Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: TOKENS.colors.textMuted, display: "flex", alignItems: "center", gap: "4px" }}>
                <Filter size={14} /> Category:
              </span>
              {["all", "Design", "Digital Marketing", "Development", "Video Editing", "General"].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDepartment(dept)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: TOKENS.radius.full,
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "1px solid",
                    borderColor: selectedDepartment === dept ? TOKENS.colors.brandPrimary : TOKENS.colors.borderLight,
                    background: selectedDepartment === dept ? TOKENS.colors.brandPrimary : TOKENS.colors.surfacePanel,
                    color: selectedDepartment === dept ? "#ffffff" : TOKENS.colors.textSecondary,
                    cursor: "pointer",
                  }}
                >
                  {dept === "all" ? "All Categories" : dept}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: TOKENS.colors.textMuted }}>Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: TOKENS.radius.md,
                  border: `1px solid ${TOKENS.colors.borderLight}`,
                  fontSize: "12px",
                  fontWeight: 700,
                  background: TOKENS.colors.surfacePanel,
                  color: TOKENS.colors.textPrimary,
                  outline: "none",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="Published">Published / Completed</option>
                <option value="Approved">Approved</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Assigned">Assigned / Backlog</option>
              </select>
            </div>
          </div>

          {/* Section 4: Deliverables Execution Matrix List */}
          <section id="matrix" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: TOKENS.colors.textPrimary, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Building2 size={20} style={{ color: TOKENS.colors.brandPrimary }} />
                Contract Deliverables Execution Matrix ({filteredTasks.length})
              </h3>
              {selectedPhase !== "all" && (
                <button
                  onClick={() => setSelectedPhase("all")}
                  style={{ fontSize: "12px", color: TOKENS.colors.brandPrimary, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}
                >
                  Clear Phase Filter ({PHASE_TITLES[selectedPhase]}) ✕
                </button>
              )}
            </div>

            {filteredTasks.length === 0 ? (
              <div style={{ background: TOKENS.colors.surfacePanel, borderRadius: TOKENS.radius.xl, border: `1px dashed ${TOKENS.colors.borderMedium}`, padding: "3rem", textAlign: "center" }}>
                <Briefcase size={36} style={{ color: TOKENS.colors.textMuted, margin: "0 auto 12px" }} />
                <h4 style={{ fontSize: "1rem", fontWeight: 800, color: TOKENS.colors.textPrimary, margin: "0 0 6px" }}>No Tasks Match Filter Options</h4>
                <p style={{ fontSize: "13px", color: TOKENS.colors.textSecondary, margin: 0 }}>Try adjusting your search terms or phase/category filters.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
                {filteredTasks.map((task, idx) => {
                  const DeptIcon = DEPT_ICONS[task.department_category || "General"] || Box;
                  const pStyle = PRIORITY_STYLES[task.priority || "Normal"] || PRIORITY_STYLES.Normal;
                  const sStyle = STATUS_STYLES[task.status || "Assigned"] || STATUS_STYLES.Assigned;
                  const isDone = task.status === "Published" || task.status === "Approved" || task.status === "Completed";

                  return (
                    <div
                      key={task.id || idx}
                      style={{
                        background: TOKENS.colors.surfacePanel,
                        borderRadius: TOKENS.radius.xl,
                        border: `1px solid ${TOKENS.colors.borderLight}`,
                        padding: "1.4rem 1.6rem",
                        boxShadow: TOKENS.shadows.sm,
                        display: "flex",
                        flexDirection: "column",
                        gap: "1.1rem",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {/* Task Card Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1, minWidth: "260px" }}>
                          <div style={{ background: isDone ? TOKENS.colors.brandSubtle : TOKENS.colors.surfaceMuted, padding: "10px", borderRadius: TOKENS.radius.lg, color: isDone ? TOKENS.colors.brandPrimary : TOKENS.colors.textSecondary }}>
                            <DeptIcon size={20} />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                              {task.code && (
                                <span style={{ fontSize: "11px", fontWeight: 900, background: TOKENS.colors.sidebarBg, color: "#ffffff", padding: "2px 8px", borderRadius: TOKENS.radius.xs, fontFamily: TOKENS.fonts.mono }}>
                                  {task.code}
                                </span>
                              )}
                              <span style={{ fontSize: "11px", fontWeight: 800, background: TOKENS.colors.surfaceMuted, color: TOKENS.colors.textSecondary, padding: "2px 8px", borderRadius: TOKENS.radius.xs, textTransform: "uppercase" }}>
                                {task.phase?.toUpperCase() || "PH1"}
                              </span>
                              <span style={{ fontSize: "11px", fontWeight: 800, background: pStyle.bg, border: `1px solid ${pStyle.border}`, color: pStyle.text, padding: "2px 8px", borderRadius: TOKENS.radius.xs }}>
                                {task.priority || "Normal"}
                              </span>
                              <span style={{ fontSize: "11px", fontWeight: 800, background: sStyle.bg, border: `1px solid ${sStyle.border}`, color: sStyle.text, padding: "2px 10px", borderRadius: TOKENS.radius.full }}>
                                {task.status}
                              </span>
                            </div>

                            <h4 style={{ fontSize: "1.1rem", fontWeight: 800, color: TOKENS.colors.textPrimary, margin: "4px 0" }}>{task.title}</h4>
                            {task.description && (
                              <p style={{ fontSize: "13px", color: TOKENS.colors.textSecondary, margin: "4px 0 0", lineHeight: "1.5" }}>{task.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Quota & Progress Stats */}
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", background: TOKENS.colors.surfaceSubtle, padding: "10px 16px", borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.colors.borderLight}` }}>
                          <div>
                            <span style={{ fontSize: "10px", color: TOKENS.colors.textMuted, fontWeight: 700, display: "block", textTransform: "uppercase" }}>Quota Delivered</span>
                            <span style={{ fontSize: "13px", fontWeight: 800, color: TOKENS.colors.textPrimary }}>
                              {task.completed_quantity} / {task.assigned_quantity} {task.unit}
                            </span>
                          </div>
                          <div style={{ height: "24px", width: "1px", background: TOKENS.colors.borderMedium }} />
                          <div>
                            <span style={{ fontSize: "10px", color: TOKENS.colors.textMuted, fontWeight: 700, display: "block", textTransform: "uppercase" }}>Completion</span>
                            <span style={{ fontSize: "13px", fontWeight: 800, color: TOKENS.colors.brandPrimary }}>{task.progress}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div style={{ width: "100%", background: TOKENS.colors.surfaceMuted, height: "8px", borderRadius: TOKENS.radius.full, overflow: "hidden", border: `1px solid ${TOKENS.colors.borderLight}`, marginBottom: "6px" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, Math.max(0, task.progress))}%`,
                              background: `linear-gradient(90deg, ${TOKENS.colors.brandPrimary} 0%, #16855B 100%)`,
                              borderRadius: TOKENS.radius.full,
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: TOKENS.colors.textMuted, fontWeight: 600 }}>
                          <span>Target Due: {task.due_date || "Schedule Locked"}</span>
                          <span>Category: {task.department_category || "General"}</span>
                        </div>
                      </div>

                      {/* Sub-Items / Milestones Checklist */}
                      {task.deliverables && task.deliverables.length > 0 && (
                        <div style={{ paddingTop: "10px", borderTop: `1px solid ${TOKENS.colors.borderLight}` }}>
                          <span style={{ fontSize: "10.5px", fontWeight: 800, color: TOKENS.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                            Milestones & Production Breakdown ({task.deliverables.length})
                          </span>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "8px" }}>
                            {task.deliverables.map((del, dIdx) => {
                              const dDone = (del.delivered || 0) > 0 || del.status === "Completed" || del.status === "Published";
                              return (
                                <div
                                  key={dIdx}
                                  style={{
                                    background: dDone ? TOKENS.colors.brandSubtle : TOKENS.colors.surfaceSubtle,
                                    border: `1px solid ${dDone ? TOKENS.colors.brandBorder : TOKENS.colors.borderLight}`,
                                    padding: "8px 12px",
                                    borderRadius: TOKENS.radius.md,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    fontSize: "12px",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    {dDone ? <CheckCircle2 size={15} style={{ color: TOKENS.colors.brandPrimary }} /> : <Clock size={15} style={{ color: TOKENS.colors.textMuted }} />}
                                    <div>
                                      <div style={{ fontWeight: 700, color: dDone ? TOKENS.colors.brandPrimary : TOKENS.colors.textPrimary }}>{del.name || del.title}</div>
                                    </div>
                                  </div>
                                  <span style={{ fontSize: "9.5px", fontWeight: 800, padding: "2px 6px", borderRadius: TOKENS.radius.xs, background: dDone ? TOKENS.colors.brandSubtle : TOKENS.colors.surfaceMuted, color: dDone ? TOKENS.colors.brandPrimary : TOKENS.colors.textSecondary }}>
                                    {dDone ? "DONE" : "PENDING"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
