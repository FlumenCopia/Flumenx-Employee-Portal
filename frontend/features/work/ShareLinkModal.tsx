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
import { Modal } from "@/features/common/Modal";
import { PrimaryButton } from "@/components/ui";

export function ShareLinkModal({
  clientId,
  clientName,
  assignments = [],
  open,
  onClose,
}: {
  clientId: number | string;
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
        expires_in_days: daysValid,
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
    <Modal title={`Share Client Portal Link — ${clientName}`} size="lg" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", color: "#0f172a" }}>
        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <ShieldAlert size={16} />
            {error}
          </div>
        )}

        {/* Generate New Link Form */}
        <form onSubmit={handleGenerate} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={16} style={{ color: "#2563eb" }} /> Generate Secure Read-Only Share Link
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
              LINK SCOPE
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="fs"
              >
                <option value="client">All Contract Work for {clientName}</option>
                <option value="assignment">Single Specific Assignment</option>
              </select>
            </label>

            {scope === "assignment" && (
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                SELECT ASSIGNMENT
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="fs"
                  required
                >
                  <option value="">Choose assignment...</option>
                  {assignments.map((a) => (
                    <option key={a.id || (a as any)._id} value={a.id || (a as any)._id}>{a.title} ({a.status})</option>
                  ))}
                </select>
              </label>
            )}

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
              VALID DURATION
              <select
                value={daysValid}
                onChange={(e) => setDaysValid(Number(e.target.value))}
                className="fs"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days (Default)</option>
                <option value={90}>90 Days</option>
              </select>
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
            PUBLIC NOTE / STATUS UPDATE (OPTIONAL)
            <input
              type="text"
              placeholder="e.g. Phase 1 deliverables successfully completed and awaiting review."
              value={publicUpdate}
              onChange={(e) => setPublicUpdate(e.target.value)}
              className="fi"
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "4px" }}>
            <PrimaryButton type="submit" disabled={submitting}>
              <Link2 size={15} />
              {submitting ? "Generating..." : "Generate Share Link"}
            </PrimaryButton>
          </div>
        </form>

        {/* Existing Links List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#334155", margin: 0 }}>Active & Historical Links</h4>
          {loading && <div style={{ fontSize: "12px", color: "#64748b", padding: "12px", textAlign: "center" }}>Loading links...</div>}
          {!loading && links.length === 0 && (
            <div style={{ fontSize: "12px", color: "#64748b", padding: "16px", textAlign: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              No share links generated yet for {clientName}.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "220px", overflowY: "auto" }}>
            {links.map((link) => {
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              const fullUrl = `${origin}/share/work/${link.token}`;
              const isCopied = copiedToken === link.token;
              const linkId = link.id || (link as any)._id;

              const isExpired = link.expires_at
                ? new Date(link.expires_at).getTime() < Date.now()
                : (link as any).expiresAt
                ? new Date((link as any).expiresAt).getTime() < Date.now()
                : false;
              const isRevoked = Boolean(link.is_revoked ?? (link as any).isRevoked);
              const isValid = link.is_valid !== undefined ? Boolean(link.is_valid) : !isRevoked && !isExpired;

              return (
                <div
                  key={linkId || link.token}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: isValid ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                    background: isValid ? "#ffffff" : "#f8fafc",
                    opacity: isValid ? 1 : 0.65,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                        {link.assignment_title ? `Assignment: ${link.assignment_title}` : "All Client Work"}
                      </span>
                      {isValid ? (
                        <span style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #86efac", padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 800 }}>
                          Active
                        </span>
                      ) : (
                        <span style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5", padding: "2px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 800 }}>
                          {isRevoked ? "Revoked" : "Expired"}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {isValid ? (
                        <button
                          type="button"
                          onClick={() => handleRevoke(linkId)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "#fee2e2",
                            color: "#dc2626",
                            fontSize: "11px",
                            fontWeight: 600,
                            border: "1px solid #fca5a5",
                            cursor: "pointer",
                          }}
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRegenerate(linkId)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "#e2e8f0",
                            color: "#334155",
                            fontSize: "11px",
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          <RefreshCw size={12} /> Regenerate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Copyable Link Field */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="text"
                      readOnly
                      value={fullUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      title="Click to select all text"
                      style={{
                        flex: 1,
                        fontFamily: "monospace",
                        fontSize: "11px",
                        color: "#334155",
                        background: "#f1f5f9",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(link.token)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "7px 12px",
                        borderRadius: "6px",
                        background: isCopied ? "#16a34a" : "#2563eb",
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "background 0.2s ease",
                      }}
                    >
                      {isCopied ? <Check size={13} /> : <Copy size={13} />}
                      {isCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {link.public_update && (
                    <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>
                      &quot;{link.public_update}&quot;
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
