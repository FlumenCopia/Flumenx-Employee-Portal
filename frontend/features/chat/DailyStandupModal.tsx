"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, AlertCircle, Sparkles, X, Send } from "lucide-react";
import { Modal } from "@/features/common/Modal";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { StandupWorkSummary } from "@/lib/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (standupData: any) => Promise<void>;
};

export function DailyStandupModal({ isOpen, onClose, onSubmit }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<StandupWorkSummary | null>(null);

  const [selectedCompleted, setSelectedCompleted] = useState<string[]>([]);
  const [selectedInProgress, setSelectedInProgress] = useState<string[]>([]);
  const [selectedBlockers, setSelectedBlockers] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadStandupData();
    }
  }, [isOpen]);

  const loadStandupData = async () => {
    setLoading(true);
    try {
      const res = await api<StandupWorkSummary>("/chat/quick-standup/");
      setData(res);
      setSelectedCompleted(res.completed_tasks || []);
      setSelectedInProgress(res.in_progress_tasks || []);
      setSelectedBlockers(res.blockers || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load standup summary");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    setSubmitting(true);
    try {
      const payload = {
        date: data.date,
        completedTasks: selectedCompleted,
        inProgressTasks: selectedInProgress,
        blockers: selectedBlockers,
        note: customNote.trim() || undefined,
      };
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Could not post daily update");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title="Smart Daily Work Update (1-Click Standup)" size="lg">
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted, #718096)" }}>
          Gathering your completed and active tasks for today...
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              padding: "12px 16px",
              background: "var(--color-primary-subtle, #E7F3EE)",
              border: "1px solid var(--color-brand-border, #B2D8CB)",
              borderRadius: "10px",
              fontSize: "12px",
              color: "var(--color-primary, #087A5B)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Sparkles size={16} />
            <span>
              Your daily tasks and deliverable quotas are auto-synchronized from the FLUMENX task manager. Select items to include in today's standup.
            </span>
          </div>

          {/* Completed Section */}
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--color-text, #18231F)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <CheckCircle2 size={14} color="#16855B" /> Completed Today ({selectedCompleted.length})
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "140px", overflowY: "auto" }}>
              {(data?.completed_tasks || []).map((t, idx) => (
                <label
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    background: "var(--panel2, #F8FAF9)",
                    border: "1px solid var(--border, #DCE3E0)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "var(--color-text, #18231F)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCompleted.includes(t)}
                    onChange={() => handleToggle(selectedCompleted, setSelectedCompleted, t)}
                    style={{ accentColor: "var(--color-primary, #087A5B)" }}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* In Progress Section */}
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--color-text, #18231F)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <Clock size={14} color="#2563EB" /> In Progress / Next ({selectedInProgress.length})
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "140px", overflowY: "auto" }}>
              {(data?.in_progress_tasks || []).map((t, idx) => (
                <label
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    background: "var(--panel2, #F8FAF9)",
                    border: "1px solid var(--border, #DCE3E0)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "var(--color-text, #18231F)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedInProgress.includes(t)}
                    onChange={() => handleToggle(selectedInProgress, setSelectedInProgress, t)}
                    style={{ accentColor: "var(--color-primary, #087A5B)" }}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Blockers Section */}
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--color-text, #18231F)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <AlertCircle size={14} color="#D97706" /> Blockers / Needs Review ({selectedBlockers.length})
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {(data?.blockers || []).map((b, idx) => (
                <label
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    background: "var(--panel2, #F8FAF9)",
                    border: "1px solid var(--border, #DCE3E0)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "var(--color-text, #18231F)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedBlockers.includes(b)}
                    onChange={() => handleToggle(selectedBlockers, setSelectedBlockers, b)}
                    style={{ accentColor: "var(--color-primary, #087A5B)" }}
                  />
                  <span>{b}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-secondary, #4A5568)", display: "block", marginBottom: "6px" }}>
              Optional Personal Note
            </label>
            <input
              type="text"
              className="input"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Will wrap up client deliverables by 5 PM"
              style={{ width: "100%", background: "var(--panel2, #F8FAF9)", border: "1px solid var(--border2, #CBD5E1)", color: "var(--color-text, #18231F)" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{
                background: "var(--color-primary, #087A5B)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Send size={15} />
              {submitting ? "Posting Update..." : "Post Daily Work Update"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
