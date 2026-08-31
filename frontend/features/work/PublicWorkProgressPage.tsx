"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import type { PublicWorkProgress } from "@/lib/types";
import { FlumenxMark } from "@/components/icons";

export function PublicWorkProgressPage({ token }: { token: string }) {
  const [data, setData] = useState<PublicWorkProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchProgress = async () => {
      try {
        const originUrl = typeof window !== "undefined"
          ? (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "")
          : "http://127.0.0.1:8000/api";
        const target = originUrl.endsWith("/api") ? `${originUrl}/public/work-progress/${token}/` : `${originUrl}/api/public/work-progress/${token}/`;
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid #10b981", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>Loading FLUMENX Client Portal...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "2.5rem", maxWidth: "440px", width: "100%", textAlign: "center", boxShadow: "0 10px 25px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ width: "48px", height: "48px", background: "#fee2e2", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <AlertTriangle size={24} />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>Link Expired or Unavailable</h2>
          <p style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.6" }}>
            This work progress share link has expired, been revoked, or is no longer accessible. Please contact your FLUMENX account manager for an updated progress link.
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

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Top Header Bar */}
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "1rem 2rem", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <FlumenxMark height={34} />
            <div style={{ height: "24px", width: "1px", background: "#cbd5e1" }} />
            <div>
              <span style={{ fontSize: "10px", fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "1px", display: "block" }}>LIVE CLIENT PROGRESS PORTAL</span>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>{data.client_name}</h1>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#15803d", background: "#dcfce7", border: "1px solid #86efac", padding: "6px 14px", borderRadius: "20px" }}>
            <ShieldCheck size={16} />
            <span>Verified Client Access</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "1100px", margin: "2rem auto", padding: "0 1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Status Update Banner */}
        {data.public_update && (
          <div style={{ background: "#ffffff", borderLeft: "4px solid #10b981", border: "1px solid #e2e8f0", borderLeftWidth: "4px", borderRadius: "12px", padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "4px" }}>
              📢 Account Manager Update
            </span>
            <p style={{ fontSize: "14px", color: "#334155", margin: 0, fontWeight: 600, lineHeight: "1.5" }}>{data.public_update}</p>
          </div>
        )}

        {/* Overall Completion Gauge Card */}
        <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "1.75rem", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <TrendingUp size={20} style={{ color: "#10b981" }} />
                Overall Contract Fulfillment
              </h2>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
                Real-time aggregated progress across all contracted deliverables.
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "#059669", fontFamily: "monospace" }}>
                {data.overall_progress}%
              </span>
            </div>
          </div>

          <div>
            <div style={{ width: "100%", background: "#f1f5f9", height: "14px", borderRadius: "99px", overflow: "hidden", border: "1px solid #e2e8f0", padding: "2px", marginBottom: "8px" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, data.overall_progress))}%`,
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  borderRadius: "99px",
                  transition: "width 0.8s ease",
                  boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
              <span>Last Synchronized: {formattedDate()}</span>
              <span>Portfolio Scope: {data.scope === "assignment" ? "Single Assignment" : "Full Client Portfolio"}</span>
            </div>
          </div>
        </div>

        {/* Deliverable Scope Cards Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Section 1: Client Review Deliverables */}
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 1rem" }}>
              <Building2 size={20} style={{ color: "#10b981" }} />
              Contract Scope & Client Deliverables ({((data as any).client_deliverables || data.assignments || []).length})
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
              {((data as any).client_deliverables || data.assignments || []).map((wa: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    padding: "1.5rem",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h4 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>🎯 {wa.title}</h4>
                      <span
                        style={{
                          padding: "3px 12px",
                          borderRadius: "99px",
                          fontSize: "11px",
                          fontWeight: 800,
                          background: wa.status === "Completed" || wa.status === "Published" ? "#dcfce7" : "#e0f2fe",
                          color: wa.status === "Completed" || wa.status === "Published" ? "#15803d" : "#0369a1",
                          border: `1px solid ${wa.status === "Completed" || wa.status === "Published" ? "#86efac" : "#bae6fd"}`,
                        }}
                      >
                        {wa.status}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "13px" }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block", fontWeight: 600 }}>Deliverable Quota</span>
                        <span style={{ fontWeight: 800, color: "#0f172a" }}>{wa.completed_quantity} / {wa.assigned_quantity} {wa.unit}</span>
                      </div>
                      <div style={{ paddingLeft: "16px", borderLeft: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block", fontWeight: 600 }}>Progress</span>
                        <span style={{ fontWeight: 800, color: "#059669" }}>{wa.progress}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Assignment Progress Bar */}
                  <div>
                    <div style={{ width: "100%", background: "#f1f5f9", height: "10px", borderRadius: "99px", overflow: "hidden", border: "1px solid #e2e8f0", marginBottom: "6px" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, Math.max(0, wa.progress))}%`,
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          borderRadius: "99px",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                      <span>Assigned: {wa.assigned_date}</span>
                      <span>Target Completion Due: {wa.due_date}</span>
                    </div>
                  </div>

                  {/* Sub-Deliverables / Milestone Items */}
                  {wa.deliverables && wa.deliverables.length > 0 && (
                    <div style={{ paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "10px" }}>
                        Milestones & Items Breakdown ({wa.deliverables.length})
                      </span>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
                        {wa.deliverables.map((d: any, dIdx: number) => {
                          const isDone = (d.delivered || 0) > 0 || d.status === "Completed" || d.status === "Published";
                          return (
                            <div
                              key={dIdx}
                              style={{
                                background: isDone ? "#f0fdf4" : "#f8fafc",
                                border: `1px solid ${isDone ? "#bbf7d0" : "#e2e8f0"}`,
                                padding: "10px 14px",
                                borderRadius: "10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                fontSize: "13px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                {isDone ? (
                                  <CheckCircle2 size={18} style={{ color: "#16a34a" }} />
                                ) : (
                                  <Clock size={18} style={{ color: "#94a3b8" }} />
                                )}
                                <div>
                                  <div style={{ fontWeight: 700, color: isDone ? "#15803d" : "#0f172a", textDecoration: isDone ? "line-through" : "none" }}>
                                    {d.name || d.title}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#64748b" }}>Target: {d.contracted || 1} units</div>
                                </div>
                              </div>

                              <span
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  background: isDone ? "#dcfce7" : "#e2e8f0",
                                  color: isDone ? "#15803d" : "#475569",
                                }}
                              >
                                {isDone ? "Done" : "Pending"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Internal Execution Tasks (if present) */}
          {(data as any).internal_tasks && (data as any).internal_tasks.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 1rem" }}>
                <Layers size={20} style={{ color: "#3b82f6" }} />
                Team Execution Tasks ({(data as any).internal_tasks.length})
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
                {(data as any).internal_tasks.map((task: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      background: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      padding: "1.2rem",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", background: "#e0f2fe", padding: "2px 8px", borderRadius: "6px" }}>
                        {task.employee_name}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: task.status === "Completed" ? "#16a34a" : "#64748b" }}>
                        {task.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>{task.title}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                      <span>Progress: {task.completed_quantity}/{task.assigned_quantity} {task.unit}</span>
                      <span>{task.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Brand Assets & Documents */}
          {(((data as any).documents && (data as any).documents.length > 0) || ((data as any).brand_assets && (data as any).brand_assets.length > 0)) && (
            <div style={{ marginTop: "1rem", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: "0 0 12px" }}>
                📂 Brand Assets & Project Resources
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
                {((data as any).brand_assets || []).map((asset: any, idx: number) => (
                  <a
                    key={`ba_${idx}`}
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#0f172a",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    <span>🎨 {asset.name}</span>
                    <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: 700 }}>Open Link ↗</span>
                  </a>
                ))}

                {((data as any).documents || []).map((doc: any, idx: number) => (
                  <a
                    key={`doc_${idx}`}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#0f172a",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    <span>📄 {doc.name}</span>
                    <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700 }}>{doc.document_type || "Document"} ↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
