"use client";

import { FormEvent, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Department, Meeting, Paginated } from "@/lib/types";
import { api } from "@/lib/api";
import { Badge, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

const MEETING_DEPARTMENTS: Department[] = [
  "Web Development",
  "Video Editing",
  "Design",
  "Digital Marketing",
  "Accountant",
  "HR",
  "Operations",
];

export function MeetingsPage({ employee = false }: { employee?: boolean }) {
  const [items, setItems] = useState<Meeting[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitPending, setSubmitPending] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const loadMeetings = () => {
    setLoading(true);
    setError("");
    const query = page > 1 ? `?page=${page}` : "";
    api<Paginated<Meeting> | Meeting[]>(`/meetings/${query}`)
      .then(data => {
        const list = Array.isArray(data) ? data : (data as any)?.results || [];
        setItems(list);
        setCount(Array.isArray(data) ? data.length : (data as any)?.count || list.length);
        setHasNext(Boolean((data as any)?.next));
        setHasPrevious(Boolean((data as any)?.previous));
      })
      .catch(err => {
        setItems([]);
        setCount(0);
        setHasNext(false);
        setHasPrevious(false);
        setError(err instanceof Error ? err.message : "Could not load meetings.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMeetings(); }, [page]);

  async function createMeeting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitPending) return;
    setSubmitPending(true);
    setMessage("");
    setActionError("");
    const data = new FormData(e.currentTarget);
    try {
      await api<Meeting>("/meetings/", { method: "POST", body: JSON.stringify({
        title: data.get("title"), date: data.get("date"), time: data.get("time"),
        department: data.get("department"), description: data.get("description") || "", location: data.get("location") || "",
      }) });
      setModal(false);
      setMessage("Meeting scheduled.");
      loadMeetings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not schedule meeting.");
    } finally {
      setSubmitPending(false);
    }
  }

  async function deleteMeeting(id: number) {
    if (deletePendingId !== null) return;
    setDeletePendingId(id);
    setMessage("");
    setActionError("");
    try {
      await api(`/meetings/${id}/`, { method: "DELETE" });
      loadMeetings();
      setMessage("Meeting deleted.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete meeting.");
    } finally {
      setDeletePendingId(null);
    }
  }

  const safeItems = items || [];
  const firstItem = safeItems[0];

  return <>
    <PageHeader eyebrow="CALENDAR / ALIGNMENT" title="Meetings." subtitle={employee ? "The conversations shaping your week." : "Create space for decisions and shared direction."} action={!employee ? <PrimaryButton onClick={() => setModal(true)}>Schedule meeting</PrimaryButton> : undefined} />
    {message && <div className="toast success">{message}</div>}
    {actionError && <div className="toast error">{actionError}</div>}
    <div className="meeting-layout">
      <div className="date-poster">
        <span>NEXT UP</span>
        <strong>{!loading && !error && firstItem ? new Date(firstItem.date).getDate() : "--"}</strong>
        <h3>{!loading && !error && firstItem ? new Date(firstItem.date).toLocaleDateString("en-US", { month: "long", weekday: "long" }) : "No meetings"}</h3>
        <p>{!loading && !error && firstItem ? `${firstItem.time.slice(0, 5)} · ${firstItem.title}` : "Schedule the next meeting"}</p>
        {!loading && !error && firstItem && (
          <a
            href={`/meet/${firstItem.meeting_code}`}
            style={{
              marginTop: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "9px 16px",
              borderRadius: "8px",
              background: "#087A5B",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "12px",
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(8, 122, 91, 0.4)",
            }}
          >
            🟢 Enter Live Room
          </a>
        )}
      </div>
      <div className="meeting-stack">
        {!loading && !error && safeItems.map((m, i) => (
          <article key={m.id} style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", alignItems: "center", gap: "16px" }}>
            <div className="meeting-number">0{i + 1}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <Badge tone={m.status === "LIVE" ? "success" : i === 0 ? "Important" : "neutral"}>
                  {m.status === "LIVE" ? "🟢 LIVE NOW" : m.department}
                </Badge>
                {m.status === "ENDED" && <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 700 }}>Concluded</span>}
              </div>
              <h2 style={{ fontSize: "16px", fontWeight: 800, margin: "2px 0 4px 0" }}>{m.title}</h2>
              {m.description && <p style={{ fontSize: "12.5px", color: "#64748B", margin: "0 0 4px 0" }}>{m.description}</p>}
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>{new Date(m.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long" })} · {m.time.slice(0, 5)}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <a
                href={`/meet/${m.meeting_code}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  background: m.status === "LIVE" ? "linear-gradient(135deg, #087A5B, #065C44)" : "rgba(8, 122, 91, 0.12)",
                  border: "1px solid rgba(8, 122, 91, 0.3)",
                  color: m.status === "LIVE" ? "#FFFFFF" : "#087A5B",
                  fontWeight: 800,
                  fontSize: "12px",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{m.status === "LIVE" ? "Join Live" : "Join Room"}</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/meet/${m.meeting_code}`);
                  setMessage("Meeting link copied to clipboard!");
                  setTimeout(() => setMessage(""), 3000);
                }}
                className="secondary-button"
                style={{ padding: "6px 10px", fontSize: "11px" }}
                title="Copy Meeting Link"
              >
                Copy Link
              </button>

              {!employee && (
                <button disabled={deletePendingId !== null} onClick={() => deleteMeeting(m.id as any)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: "6px" }} title="Delete Meeting">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
    {loading && <EmptyState title="Loading meetings" text="Fetching the latest schedule." />}
    {error && <EmptyState title="Could not load meetings" text={error} />}
    {!loading && !error && !items.length && <EmptyState title="No meetings scheduled" text="There are no meetings to show yet." />}
    {!loading && !error && count > 0 && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", marginTop: "16px", border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--surface)" }}>
        <span className="record-count" style={{ padding: 0 }}>
          Page {page} of {Math.ceil(count / 20) || 1} ({count} total)
        </span>
        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!hasPrevious || loading}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!hasNext || loading}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    )}
    {modal && <Modal title="Schedule a meeting" onClose={() => setModal(false)}><form className="modal-form" onSubmit={createMeeting}><label>Meeting title<input name="title" required placeholder="What are we aligning on?" /></label><div className="two-col"><label>Date<input name="date" type="date" required /></label><label>Time<input name="time" type="time" required /></label></div><label>Audience<select name="department"><option>All Employees</option>{MEETING_DEPARTMENTS.map(x=><option key={x}>{x}</option>)}</select></label><PrimaryButton type="submit" disabled={submitPending}>{submitPending ? "Creating..." : "Create meeting"}</PrimaryButton></form></Modal>}
  </>;
}
