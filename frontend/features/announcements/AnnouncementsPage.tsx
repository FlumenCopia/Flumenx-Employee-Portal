"use client";

import { FormEvent, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Announcement, Paginated } from "@/lib/types";
import { Badge, EmptyState, PageHeader, PrimaryButton } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

export function AnnouncementsPage({ employee = false }: { employee?: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnnouncements = () => {
    setLoading(true);
    setError("");
    api<Paginated<Announcement>>("/announcements/")
      .then(data => setItems(data.results))
      .catch(err => {
        setItems([]);
        setError(err instanceof Error ? err.message : "Could not load announcements.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAnnouncements(); }, []);

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
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
  }

  async function deleteAnnouncement(id: number) {
    await api(`/announcements/${id}/`, { method: "DELETE" });
    setItems(current => current.filter(item => item.id !== id));
  }

  return <>
    <PageHeader
      eyebrow="NOTICEBOARD / COMPANY"
      title="Announcements."
      subtitle="The things everyone should know, in one clear place."
      action={!employee ? <PrimaryButton onClick={() => setModal(true)}>New announcement</PrimaryButton> : undefined}
    />
    {loading && <EmptyState title="Loading announcements" text="Fetching company updates." />}
    {error && <EmptyState title="Could not load announcements" text={error} />}
    {!loading && !error && !items.length && <EmptyState title="No announcements" text="There are no announcements to show yet." />}
    {!loading && !error && Boolean(items.length) && <div className="announcement-page-grid">
      {items.map((announcement, index) => <article key={announcement.id} className={index === 0 ? "featured" : ""}>
        <div className="announce-meta"><span>0{index + 1}</span><Badge tone={announcement.priority}>{announcement.priority}</Badge></div>
        <h2>{announcement.title}</h2>
        <p>{announcement.message}</p>
        <div className="announce-foot">
          <time>{new Date(announcement.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</time>
          {!employee && <button type="button" onClick={() => deleteAnnouncement(announcement.id)}><Trash2 size={16} /></button>}
        </div>
      </article>)}
    </div>}
    {modal && <Modal title="Share an announcement" onClose={() => setModal(false)}>
      <form className="modal-form" onSubmit={createAnnouncement}>
        <label>Title<input name="title" required placeholder="A clear headline" /></label>
        <label>Priority<select name="priority"><option>Normal</option><option>Important</option><option>Urgent</option></select></label>
        <label>Message<textarea name="message" required rows={5} placeholder="What does the team need to know?" /></label>
        <PrimaryButton type="submit">Publish update</PrimaryButton>
      </form>
    </Modal>}
  </>;
}
