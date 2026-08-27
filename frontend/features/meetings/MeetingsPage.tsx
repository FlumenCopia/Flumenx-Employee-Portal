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
      </div>
      <div className="meeting-stack">
        {!loading && !error && safeItems.map((m, i) => (
          <article key={m.id}>
            <div className="meeting-number">0{i + 1}</div>
            <div>
              <Badge tone={i === 0 ? "Important" : "neutral"}>{m.department}</Badge>
              <h2>{m.title}</h2>
              {m.description && <p>{m.description}</p>}
              <span>{new Date(m.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long" })} · {m.time.slice(0, 5)}</span>
            </div>
            {!employee && (
              <button disabled={deletePendingId !== null} onClick={() => deleteMeeting(m.id)}>
                <Trash2 size={17} />
              </button>
            )}
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
