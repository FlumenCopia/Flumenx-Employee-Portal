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
} from "lucide-react";
import type { PublicWorkProgress } from "@/lib/types";

export function PublicWorkProgressPage({ token }: { token: string }) {
  const [data, setData] = useState<PublicWorkProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchProgress = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${backendUrl}/api/public/work-progress/${token}/`);
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Loading client work progress...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-bold text-white">Link Expired or Unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            This work progress share link has expired, been revoked, or is no longer accessible. Please contact your account manager for an updated progress link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/40 rounded-xl flex items-center justify-center font-bold text-indigo-400 text-sm">
              FX
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Client Progress Portal</span>
              <h1 className="text-xl font-bold text-white tracking-tight">{data.client_name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Verified Secure Access</span>
          </div>
        </div>

        {/* Public Update Banner (If available) */}
        {data.public_update && (
          <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-lg text-xs space-y-1">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Status Update</span>
            <p className="text-slate-200 leading-relaxed font-medium">{data.public_update}</p>
          </div>
        )}

        {/* Progress Summary Gauge */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers size={16} className="text-indigo-400" />
                Overall Project Completion
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Aggregated progress across all active work deliverables.
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-white font-mono">{data.overall_progress}%</span>
            </div>
          </div>

          <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, data.overall_progress))}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-1">
            <span>Last Updated: {new Date(data.last_updated).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
            <span>Scope: {data.scope === "assignment" ? "Single Assignment" : "Full Client Portfolio"}</span>
          </div>
        </div>

        {/* Work Assignments Breakdown */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 size={16} className="text-indigo-400" />
            Work Progress & Deliverables ({data.assignments.length})
          </h3>

          <div className="space-y-4">
            {data.assignments.map((wa, idx) => (
              <div key={idx} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-white">{wa.title}</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        wa.status === "Completed"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : wa.status === "In Progress" || wa.status === "Ongoing"
                          ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                          : "bg-slate-500/15 text-slate-400 border-slate-500/30"
                      }`}>
                        {wa.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Assigned / Completed</span>
                      <span className="font-bold text-white">{wa.completed_quantity} / {wa.assigned_quantity} {wa.unit}</span>
                    </div>
                    <div className="pl-3 border-l border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Progress</span>
                      <span className="font-bold text-emerald-400">{wa.progress}%</span>
                    </div>
                  </div>
                </div>

                {/* Individual Assignment Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-indigo-500 h-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, wa.progress))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Assigned: {wa.assigned_date}</span>
                    <span>Target Due: {wa.due_date}</span>
                  </div>
                </div>

                {/* Deliverables List */}
                {wa.deliverables && wa.deliverables.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800/60">
                    <span className="text-[11px] font-bold text-slate-400 block">Milestones & Deliverables</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {wa.deliverables.map((d, dIdx) => (
                        <div key={dIdx} className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-slate-200">{d.title}</div>
                            <div className="text-[10px] text-slate-500">{d.work_type} · Due {d.due_date}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            d.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}>
                            {d.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
