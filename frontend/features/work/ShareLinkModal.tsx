"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Plus,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ShareLink, WorkAssignment } from "@/lib/types";

export function ShareLinkModal({
  clientId,
  clientName,
  assignments = [],
  open,
  onClose,
}: {
  clientId: number;
  clientName: string;
  assignments?: WorkAssignment[];
  open: boolean;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form states
  const [scope, setScope] = useState<"client" | "assignment">("client");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [publicUpdate, setPublicUpdate] = useState("");
  const [daysValid, setDaysValid] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const loadLinks = async () => {
    if (!clientId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api<ShareLink[]>(`/work-share-links/?client_id=${clientId}`);
      setLinks(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load share links.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadLinks();
    }
  }, [open, clientId]);

  if (!open) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const body: any = {
        client_id: clientId,
        days_valid: daysValid,
        public_update: publicUpdate,
      };
      if (scope === "assignment" && selectedAssignmentId) {
        body.assignment_id = Number(selectedAssignmentId);
      }

      await api<ShareLink>("/work-share-links/", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setPublicUpdate("");
      loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate share link.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await api(`/work-share-links/${id}/revoke/`, { method: "POST" });
      loadLinks();
    } catch (err) {
      alert("Failed to revoke share link.");
    }
  };

  const handleRegenerate = async (id: number) => {
    try {
      await api(`/work-share-links/${id}/regenerate/`, { method: "POST" });
      loadLinks();
    } catch (err) {
      alert("Failed to regenerate share link.");
    }
  };

  const copyToClipboard = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/share/work/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Globe size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Share Client Work Progress</h3>
              <p className="text-xs text-slate-400">Generate secure read-only URL for {clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2">
            <ShieldAlert size={15} />
            {error}
          </div>
        )}

        {/* Generate New Link Form */}
        <form onSubmit={handleGenerate} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Plus size={14} className="text-indigo-400" /> Generate New Share Link
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">Link Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full text-xs bg-white border border-[#dad7ce] rounded-lg p-2 text-[#1a1b1e]"
              >
                <option value="client" className="bg-white text-[#1a1b1e]">All Work for {clientName}</option>
                <option value="assignment" className="bg-white text-[#1a1b1e]">Single Specific Assignment</option>
              </select>
            </div>

            {scope === "assignment" && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-medium">Select Assignment</label>
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="w-full text-xs bg-white border border-[#dad7ce] rounded-lg p-2 text-[#1a1b1e]"
                  required
                >
                  <option value="" className="bg-white text-[#1a1b1e]">Choose assignment...</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id} className="bg-white text-[#1a1b1e]">{a.title} ({a.status})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">Valid Days</label>
              <select
                value={daysValid}
                onChange={(e) => setDaysValid(Number(e.target.value))}
                className="w-full text-xs bg-white border border-[#dad7ce] rounded-lg p-2 text-[#1a1b1e]"
              >
                <option value={7} className="bg-white text-[#1a1b1e]">7 Days</option>
                <option value={14} className="bg-white text-[#1a1b1e]">14 Days</option>
                <option value={30} className="bg-white text-[#1a1b1e]">30 Days (Default)</option>
                <option value={90} className="bg-white text-[#1a1b1e]">90 Days</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">Sanitized Public Update / Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Phase 1 deliverables successfully completed and awaiting review."
              value={publicUpdate}
              onChange={(e) => setPublicUpdate(e.target.value)}
              className="w-full text-xs bg-white border border-[#dad7ce] rounded-lg p-2 text-[#1a1b1e]"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <Link2 size={14} />
              {submitting ? "Generating..." : "Generate Share Link"}
            </button>
          </div>
        </form>

        {/* Existing Links List */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300">Active & Historical Links</h4>
          {loading && <div className="text-xs text-slate-500 p-3 text-center">Loading links...</div>}
          {!loading && links.length === 0 && (
            <div className="text-xs text-slate-500 p-3 text-center bg-slate-950/40 border border-slate-800/60 rounded-xl">
              No share links created yet for {clientName}.
            </div>
          )}

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {links.map((link) => {
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              const fullUrl = `${origin}/share/work/${link.token}`;
              const isCopied = copiedToken === link.token;

              return (
                <div
                  key={link.id}
                  className={`p-3 rounded-xl border text-xs space-y-2 transition ${
                    link.is_valid
                      ? "bg-slate-950 border-slate-800 text-slate-200"
                      : "bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-65"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {link.assignment_title ? `Assignment: ${link.assignment_title}` : "All Client Work"}
                      </span>
                      {link.is_valid ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          {link.is_revoked ? "Revoked" : "Expired"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {link.is_valid && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(link.token)}
                            className="p-1.5 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg transition flex items-center gap-1 text-[11px]"
                            title="Copy Public URL"
                          >
                            {isCopied ? <Check size={13} /> : <Copy size={13} />}
                            {isCopied ? "Copied" : "Copy"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRevoke(link.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg transition"
                          >
                            Revoke
                          </button>
                        </>
                      )}

                      {!link.is_valid && (
                        <button
                          type="button"
                          onClick={() => handleRegenerate(link.id)}
                          className="p-1.5 text-slate-300 hover:text-white bg-slate-800 rounded-lg transition flex items-center gap-1 text-[11px]"
                        >
                          <RefreshCw size={12} /> Regenerate
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="font-mono text-[11px] text-slate-400 truncate bg-slate-900 p-1.5 rounded-lg border border-slate-800/80">
                    {fullUrl}
                  </div>

                  {link.public_update && (
                    <div className="text-[11px] text-slate-400 italic">
                      &quot;{link.public_update}&quot;
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
