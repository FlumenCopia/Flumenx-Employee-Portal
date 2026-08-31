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
    <Modal onClose={onClose} title="⚡ Smart Daily Work Update (1-Click Standup)" size="lg">
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--muted, #888)" }}>
          Gathering your completed & active tasks for today...
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              borderRadius: "12px",
              fontSize: "12px",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Sparkles size={16} />
            <span>
              Your daily tasks and deliverable quotas are auto-synchronized from FLUMENX task manager. Select items to include in today's standup.
            </span>
          </div>

          {/* Completed Section */}
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "#10b981",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <CheckCircle2 size={14} /> Completed Today ({selectedCompleted.length})
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
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCompleted.includes(t)}
                    onChange={() => handleToggle(selectedCompleted, setSelectedCompleted, t)}
                    style={{ accentColor: "#10b981" }}
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
                fontWeight: 800,
                color: "#38bdf8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <Clock size={14} /> In Progress / Next ({selectedInProgress.length})
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
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedInProgress.includes(t)}
                    onChange={() => handleToggle(selectedInProgress, setSelectedInProgress, t)}
                    style={{ accentColor: "#38bdf8" }}
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
                fontWeight: 800,
                color: "#f59e0b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <AlertCircle size={14} /> Blockers / Needs Review ({selectedBlockers.length})
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
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedBlockers.includes(b)}
                    onChange={() => handleToggle(selectedBlockers, setSelectedBlockers, b)}
                    style={{ accentColor: "#f59e0b" }}
                  />
                  <span>{b}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted, #888)", display: "block", marginBottom: "6px" }}>
              Optional Personal Note
            </label>
            <input
              type="text"
              className="input"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Will wrap up client deliverables by 5 PM"
              style={{ width: "100%" }}
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
                background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
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
