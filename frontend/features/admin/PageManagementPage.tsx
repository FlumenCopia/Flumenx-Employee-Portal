"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { useShellUser } from "@/components/shell";
import { EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { triggerNavigationRefresh } from "@/lib/navigation";
import type { PortalPage } from "@/lib/types";
import { PageFormModal } from "./PageFormModal";

export function PageManagementPage() {
  const router = useRouter();
  const user = useShellUser();

  const [pages, setPages] = useState<PortalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PortalPage | null>(null);
  const [actionError, setActionError] = useState("");

  // Route Guard: Super Admin Only
  useEffect(() => {
    if (!user) return;
    const isSuperAdmin = user.portal_role === "SUPER_ADMIN" || user.role === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      router.replace("/admin/dashboard");
    }
  }, [user, router]);

  const loadPages = () => {
    setLoading(true);
    setError("");
    api<PortalPage[] | { results: PortalPage[] }>("/portal/pages/")
      .then((data) => setPages(Array.isArray(data) ? data : data?.results || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load pages."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPages();
  }, []);

  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pages
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.route_path.toLowerCase().includes(q) || p.module_code.toLowerCase().includes(q))
      .sort((a, b) => a.sidebar_order - b.sidebar_order);
  }, [pages, search]);

  async function handleDelete(page: PortalPage) {
    if (!confirm(`Are you sure you want to delete or deactivate page "${page.title}"?`)) return;
    setActionError("");
    try {
      await api(`/portal/pages/${page.id}/`, { method: "DELETE" });
      triggerNavigationRefresh();
      loadPages();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message || "Could not delete page.");
      } else {
        setActionError(err instanceof Error ? err.message : "Could not delete page.");
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <PageHeader
        title="Page Management"
        subtitle="System Pages & Frontend Routes — Registered in System Navigation Matrix"
        action={
          <PrimaryButton
            onClick={() => {
              setEditingPage(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Add New Page
          </PrimaryButton>
        }
      />

      {actionError && <div className="toast error">{actionError}</div>}

      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", minWidth: "260px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, path, or module code..."
              className="fi"
              style={{ paddingLeft: "36px" }}
            />
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            Showing {filteredPages.length} of {pages.length} pages
          </span>
        </div>

        {loading && <EmptyState title="Loading pages" text="Fetching registered system routes." />}
        {error && <EmptyState title="Could not load pages" text={error} />}

        {!loading && !error && !filteredPages.length && (
          <EmptyState title="No system pages found" text="Try adjusting search or add a new page." />
        )}

        {!loading && !error && Boolean(filteredPages.length) && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: "11px", fontWeight: 700 }}>
                  <th style={{ padding: "12px" }}>ORDER</th>
                  <th style={{ padding: "12px" }}>PAGE TITLE</th>
                  <th style={{ padding: "12px" }}>ROUTE PATH</th>
                  <th style={{ padding: "12px" }}>MODULE CODE</th>
                  <th style={{ padding: "12px" }}>VISIBILITY</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px", fontWeight: 700, color: "var(--muted)" }}>#{item.sidebar_order}</td>
                    <td style={{ padding: "12px", fontWeight: 600, color: "var(--text)" }}>{item.title}</td>
                    <td style={{ padding: "12px", fontFamily: "monospace", color: "var(--muted)" }}>{item.route_path}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(203,168,110,0.12)", color: "var(--goldD)", padding: "3px 8px", borderRadius: "6px" }}>
                        {item.module_code}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      {item.is_active ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--brand)", fontSize: "11px", fontWeight: 600 }}>
                          <CheckCircle2 size={13} /> ACTIVE
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#EF4444", fontSize: "11px", fontWeight: 600 }}>
                          <XCircle size={13} /> HIDDEN
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setEditingPage(item);
                            setModalOpen(true);
                          }}
                          style={{ padding: "6px 10px", fontSize: "11px" }}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleDelete(item)}
                          style={{ padding: "6px 10px", fontSize: "11px", color: "#EF4444", borderColor: "rgba(239,68,68,0.3)" }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PageFormModal
        page={editingPage}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={loadPages}
      />
    </div>
  );
}
