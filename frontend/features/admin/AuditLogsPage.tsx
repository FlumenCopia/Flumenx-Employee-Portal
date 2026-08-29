"use client";

import { useEffect, useState } from "react";
import { History, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Badge, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";

export interface AuditLogItem {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any>;
  created_at: string;
}

export function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAuditLogs = () => {
    setLoading(true);
    setError("");
    api<{ results: AuditLogItem[] } | AuditLogItem[]>("/audit-logs/")
      .then((data) => {
        const list = Array.isArray(data) ? data : (data as any)?.results || [];
        setItems(list);
      })
      .catch((err) => {
        setItems([]);
        setError(err instanceof Error ? err.message : "Could not load audit logs.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filteredLogs = items.filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (log.actor_name || "").toLowerCase().includes(q) ||
      (log.action || "").toLowerCase().includes(q) ||
      (log.entity_type || "").toLowerCase().includes(q) ||
      (log.entity_id || "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeader
        eyebrow="SYSTEM / AUDIT & SECURITY"
        title="Audit Logs"
        subtitle="Full immutable activity trail of system actions, updates, and access records."
        action={
          <PrimaryButton onClick={loadAuditLogs}>
            Refresh logs <RefreshCw size={16} />
          </PrimaryButton>
        }
      />

      <div className="toolbar" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
        <div className="search-box" style={{ flex: "1 1 240px" }}>
          <Search size={18} />
          <input
            placeholder="Search action, actor, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="record-count" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>
          <ShieldCheck size={16} color="#087A5B" />
          <span>{filteredLogs.length} LOG ENTRIES</span>
        </div>
      </div>

      <div className="data-card" style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", overflow: "hidden" }}>
        <div className="table-responsive-wrapper" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", minWidth: "680px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }}>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--muted)", fontSize: "11px", textTransform: "uppercase" }}>Timestamp</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--muted)", fontSize: "11px", textTransform: "uppercase" }}>Actor</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--muted)", fontSize: "11px", textTransform: "uppercase" }}>Action</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--muted)", fontSize: "11px", textTransform: "uppercase" }}>Entity Type</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--muted)", fontSize: "11px", textTransform: "uppercase" }}>Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                !error &&
                filteredLogs.map((log, idx) => (
                  <tr key={log.id || idx} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px", fontSize: "12px", fontFamily: "monospace", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "N/A"}
                    </td>
                    <td style={{ padding: "12px", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
                      {log.actor_name || "System"}
                    </td>
                    <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
                      <Badge tone="info">{log.action}</Badge>
                    </td>
                    <td style={{ padding: "12px", fontSize: "12.5px", color: "var(--text)", whiteSpace: "nowrap" }}>
                      {log.entity_type || "General"}
                    </td>
                    <td style={{ padding: "12px", fontSize: "11.5px", fontFamily: "monospace", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {log.entity_id || "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {loading && <EmptyState title="Loading audit logs" text="Fetching system activity history..." />}
        {error && <EmptyState title="Could not load audit logs" text={error} />}
        {!loading && !error && !filteredLogs.length && (
          <EmptyState title="No audit logs found" text="No recorded activity matches your current search." />
        )}
      </div>
    </>
  );
}
