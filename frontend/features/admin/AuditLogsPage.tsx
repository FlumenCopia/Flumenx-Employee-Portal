"use client";

import { useEffect, useState } from "react";
import { History, RefreshCw, Search } from "lucide-react";
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
        title="Audit Logs."
        subtitle="Full immutable activity trail of system actions, updates, and access records."
        action={
          <PrimaryButton onClick={loadAuditLogs}>
            Refresh logs <RefreshCw size={16} />
          </PrimaryButton>
        }
      />

      <div className="toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            placeholder="Search action, actor, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="record-count">{filteredLogs.length} LOG ENTRIES</div>
      </div>

      <div className="data-card">
        <div className="data-table">
          <div className="table-head">
            <span>Timestamp</span>
            <span>Actor</span>
            <span>Action</span>
            <span>Entity Type</span>
            <span>Entity ID</span>
          </div>

          {!loading &&
            !error &&
            filteredLogs.map((log, idx) => (
              <div className="table-row" key={log.id || idx}>
                <span style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--muted)" }}>
                  {log.created_at
                    ? new Date(log.created_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                </span>
                <b style={{ fontSize: "13px" }}>{log.actor_name || "System"}</b>
                <Badge tone="info">{log.action}</Badge>
                <span style={{ fontSize: "12px", color: "var(--text)" }}>{log.entity_type || "General"}</span>
                <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)" }}>
                  {log.entity_id || "—"}
                </span>
              </div>
            ))}
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
