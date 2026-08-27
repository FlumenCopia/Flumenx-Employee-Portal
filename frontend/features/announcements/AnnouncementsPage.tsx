"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, Bell, Calendar, Megaphone, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Announcement, Paginated } from "@/lib/types";
import { EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

export function AnnouncementsPage({ employee = false }: { employee?: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadAnnouncements = () => {
    setLoading(true);
    setError("");
    api<Paginated<Announcement> | Announcement[]>("/announcements/")
      .then((data) => {
        const list = Array.isArray(data) ? data : (data as any)?.results || [];
        setItems(list);
      })
      .catch((err) => {
        setItems([]);
        setError(err instanceof Error ? err.message : "Could not load announcements.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      await api<Announcement>("/announcements/", {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"),
          priority: data.get("priority"),
          message: data.get("message"),
        }),
      });
      setModal(false);
      loadAnnouncements();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteAnnouncement(id: number) {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await api(`/announcements/${id}/`, { method: "DELETE" });
      setItems((current) => (current || []).filter((item) => item.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete announcement.");
    }
  }

  const safeItems = items || [];

  const priorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5", icon: "🚨" };
      case "Important":
        return { bg: "#fef3c7", color: "#d97706", border: "#fde68a", icon: "⚠️" };
      default:
        return { bg: "#e0f2fe", color: "#0284c7", border: "#bae6fd", icon: "📢" };
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem" }}>
      <PageHeader
        eyebrow="COMPANY NOTICEBOARD & BROADCASTS"
        title="Announcements & Alerts"
        subtitle="Important updates, company notices, and broadcasts visible across all employee portals."
        action={
          !employee ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => setModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
              }}
            >
              <Plus size={16} /> New Announcement
            </button>
          ) : undefined
        }
      />

      {loading && <EmptyState title="Loading announcements" text="Fetching latest broadcasts..." />}
      {error && <EmptyState title="Could not load announcements" text={error} />}
      {!loading && !error && !safeItems.length && (
        <EmptyState title="No active announcements" text="There are no announcements posted yet." />
      )}

      {!loading && !error && Boolean(safeItems.length) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "1.25rem", marginTop: "1rem" }}>
          {safeItems.map((announcement, index) => {
            const badge = priorityBadgeStyle(announcement.priority);
            return (
              <article
                key={announcement.id || index}
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: index === 0 ? "2px solid #10b981" : "1px solid #e2e8f0",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: index === 0 ? "0 4px 14px rgba(16, 185, 129, 0.12)" : "0 1px 3px rgba(0, 0, 0, 0.04)",
                  position: "relative",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  {/* Top Meta Bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", fontFamily: "monospace" }}>
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                      {index === 0 && (
                        <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "99px", fontSize: "10px", fontWeight: 800 }}>
                          LATEST
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {badge.icon} {announcement.priority}
                    </span>
                  </div>

                  {/* Title & Body */}
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: "8px", lineHeight: "1.3" }}>
                    {announcement.title}
                  </h3>
                  <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: "1.5", whiteSpace: "pre-wrap", marginBottom: "1rem" }}>
                    {announcement.message}
                  </p>
                </div>

                {/* Footer Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                  <time style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                    <Calendar size={13} />
                    {announcement.date
                      ? new Date(announcement.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "Recent"}
                  </time>

                  {!employee && (
                    <button
                      type="button"
                      onClick={() => deleteAnnouncement(announcement.id)}
                      style={{
                        background: "rgba(239, 68, 68, 0.08)",
                        color: "#ef4444",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                      title="Delete Announcement"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title="Create Company Announcement" size="md" onClose={() => setModal(false)}>
          <form onSubmit={createAnnouncement} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
              ANNOUNCEMENT TITLE *
              <input
                name="title"
                required
                placeholder="e.g. Q3 Company Meeting & Holiday Schedule"
                className="fi"
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
              PRIORITY LEVEL
              <select name="priority" defaultValue="Normal" className="fs">
                <option value="Normal">📌 Normal Notice</option>
                <option value="Important">⚠️ Important Update</option>
                <option value="Urgent">🚨 Urgent Priority</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
              MESSAGE CONTENT *
              <textarea
                name="message"
                rows={5}
                required
                placeholder="Write the full announcement details to broadcast to all employees..."
                className="fi"
                style={{ resize: "vertical" }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button type="button" className="secondary-button" onClick={() => setModal(false)}>
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={submitting}>
                {submitting ? "Broadcasting..." : "📢 Post & Broadcast Announcement"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
