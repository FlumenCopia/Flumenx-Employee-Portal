"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, RotateCw, SlidersHorizontal } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import type { Paginated, WorkAssignment, WorkPriority, WorkStatus, WorkSummary } from "@/lib/types";
import { Badge, EmptyState, PageHeader, PrimaryButton, StatCard } from "@/components/ui";
import { Modal } from "@/features/common/Modal";

type EmployeeWorkFilters = {
  status: string; priority: string; due_date: string; assigned_date: string; is_overdue: string;
};

const EMPTY_SUMMARY: WorkSummary = { total: 0, pending: 0, in_progress: 0, blocked: 0, completed: 0, overdue: 0 };
const EMPTY_FILTERS: EmployeeWorkFilters = { status: "", priority: "", due_date: "", assigned_date: "", is_overdue: "" };
const PRIORITIES: WorkPriority[] = ["Low", "Normal", "High", "Urgent"];
const STATUSES: WorkStatus[] = ["Pending", "In Progress", "Blocked", "Completed"];

function queryFromFilters(filters: EmployeeWorkFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function fieldErrors(err: unknown) {
  return err instanceof ApiError ? err.fields : {};
}

export function EmployeeWorkPage() {
  const [summary, setSummary] = useState<WorkSummary>(EMPTY_SUMMARY);
  const [items, setItems] = useState<WorkAssignment[]>([]);
  const [filters, setFilters] = useState<EmployeeWorkFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState<WorkAssignment | null>(null);
  const [status, setStatus] = useState<WorkStatus>("Pending");
  const [progress, setProgress] = useState("0");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadWork = useCallback(async (nextFilters = filters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const query = queryFromFilters(nextFilters);
      const [list, nextSummary] = await Promise.all([
        api<Paginated<WorkAssignment>>(`/work-assignments/${query}`, { signal: controller.signal }),
        api<WorkSummary>(`/work-assignments/summary/${query}`, { signal: controller.signal }),
      ]);
      if (requestRef.current !== requestId || controller.signal.aborted) return;
      setItems(list.results);
      setSummary(nextSummary);
    } catch (err) {
      if (!controller.signal.aborted) {
        setItems([]);
        setSummary(EMPTY_SUMMARY);
        setError(apiError(err, "Could not load your work."));
      }
    } finally {
      if (requestRef.current === requestId && !controller.signal.aborted) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadWork(filters);
    return () => {
      requestRef.current += 1;
      abortRef.current?.abort();
    };
  }, [filters, loadWork]);

  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setEditing(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editing, submitting]);

  function updateFilter(key: keyof EmployeeWorkFilters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  function openUpdate(item: WorkAssignment) {
    setEditing(item);
    setStatus(item.status);
    setProgress(String(item.progress));
    setFormErrors({});
    setActionError("");
  }

  function effectiveProgress() {
    if (status === "Completed") return 100;
    return Number(progress);
  }

  function clientValidationError() {
    const nextProgress = effectiveProgress();
    if (Number.isNaN(nextProgress) || nextProgress < 0 || nextProgress > 100) return "Progress must be between 0 and 100.";
    if (status !== "Completed" && nextProgress === 100) return "Set status to Completed when progress is 100.";
    return "";
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || submitting) return;
    const validation = clientValidationError();
    if (validation) {
      setActionError(validation);
      return;
    }
    setSubmitting(true);
    setActionError("");
    setFormErrors({});
    try {
      await api<WorkAssignment>(`/work-assignments/${editing.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status, progress: effectiveProgress() }),
      });
      setEditing(null);
      setMessage("Work progress updated.");
      await loadWork(filters);
    } catch (err) {
      setFormErrors(fieldErrors(err));
      setActionError(apiError(err, "Could not update work progress."));
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <PageHeader
      eyebrow="WORK / MY ASSIGNMENTS"
      title="My work."
      subtitle="Track assigned client work and keep your progress current."
    />

    {message && <div className="toast success">{message}</div>}
    {actionError && !editing && <div className="toast error">{actionError}</div>}

    <div className="stats-grid">
      <StatCard label="Total" value={loading ? "--" : summary.total} note="assigned to you" icon={<BriefcaseBusiness />} />
      <StatCard label="Pending" value={loading ? "--" : summary.pending} note="waiting to begin" icon={<BriefcaseBusiness />} />
      <StatCard label="In Progress" value={loading ? "--" : summary.in_progress} note="currently moving" icon={<BriefcaseBusiness />} accent />
      <StatCard label="Blocked" value={loading ? "--" : summary.blocked} note="needs attention" icon={<BriefcaseBusiness />} />
      <StatCard label="Completed" value={loading ? "--" : summary.completed} note="finished work" icon={<BriefcaseBusiness />} />
      <StatCard label="Overdue" value={loading ? "--" : summary.overdue} note="past due date" icon={<BriefcaseBusiness />} />
    </div>

    <div className="toolbar work-toolbar">
      <SlidersHorizontal size={18} />
      <select value={filters.status} onChange={event => updateFilter("status", event.target.value)} aria-label="Filter by status">
        <option value="">All statuses</option>
        {STATUSES.map(option => <option key={option}>{option}</option>)}
      </select>
      <select value={filters.priority} onChange={event => updateFilter("priority", event.target.value)} aria-label="Filter by priority">
        <option value="">All priorities</option>
        {PRIORITIES.map(option => <option key={option}>{option}</option>)}
      </select>
      <input type="date" value={filters.assigned_date} onChange={event => updateFilter("assigned_date", event.target.value)} aria-label="Filter by assigned date" />
      <input type="date" value={filters.due_date} onChange={event => updateFilter("due_date", event.target.value)} aria-label="Filter by due date" />
      <select value={filters.is_overdue} onChange={event => updateFilter("is_overdue", event.target.value)} aria-label="Filter by overdue">
        <option value="">Any due state</option>
        <option value="true">Overdue</option>
        <option value="false">Not overdue</option>
      </select>
      <button type="button" className="secondary-button" onClick={() => setFilters(EMPTY_FILTERS)}>Reset</button>
      <button type="button" className="secondary-button" onClick={() => loadWork(filters)} disabled={loading}><RotateCw size={15} /> Refresh</button>
    </div>

    <div className="data-card work-card">
      <div className="data-table employee-work-table">
        <div className="table-head">
          <span>Client</span><span>Work</span><span>Priority</span><span>Status</span><span>Progress</span><span>Assigned</span><span>Due</span><span>Assigned by</span><span />
        </div>
        {!loading && !error && items.map(item => <div className={`table-row ${item.is_overdue ? "overdue-row" : ""}`} key={item.id}>
          <span>{item.client_name}</span>
          <div className="work-title"><b>{item.title}</b><small>{item.description || "No description"}</small></div>
          <Badge tone={item.priority}>{item.priority}</Badge>
          <Badge tone={item.status}>{item.status}</Badge>
          <span>{item.progress}%</span>
          <span>{formatDate(item.assigned_date)}</span>
          <span>{formatDate(item.due_date)} {item.is_overdue && <em>Overdue</em>}</span>
          <span>{item.assigned_by_name || "Portal"}</span>
          <div className="row-actions">
            <button type="button" disabled={submitting} onClick={() => openUpdate(item)}>Update</button>
          </div>
        </div>)}
      </div>
      {loading && <EmptyState title="Loading your work" text="Fetching your assigned work." />}
      {error && <EmptyState title="Could not load your work" text={error} />}
      {!loading && !error && !items.length && <EmptyState title="No work assigned" text="There are no assignments to show for these filters." />}
    </div>

    {editing && <Modal title="Update work progress" onClose={() => !submitting && setEditing(null)}>
      <form className="modal-form" onSubmit={submitUpdate}>
        <label>Work title<input value={editing.title} readOnly /></label>
        <label>Status<select value={status} onChange={event => {
          const nextStatus = event.target.value as WorkStatus;
          setStatus(nextStatus);
          if (nextStatus === "Completed") setProgress("100");
          if (nextStatus !== "Completed" && progress === "100") setProgress("99");
        }}>{STATUSES.map(option => <option key={option}>{option}</option>)}</select>{formErrors.status && <small>{formErrors.status}</small>}</label>
        <label>Progress<input type="number" min="0" max="100" value={status === "Completed" ? "100" : progress} disabled={status === "Completed"} onChange={event => setProgress(event.target.value)} required />{formErrors.progress && <small>{formErrors.progress}</small>}</label>
        {actionError && <div className="toast error">{actionError}</div>}
        <PrimaryButton type="submit" disabled={submitting}>{submitting ? "Updating..." : "Update Progress"}</PrimaryButton>
      </form>
    </Modal>}
  </>;
}
