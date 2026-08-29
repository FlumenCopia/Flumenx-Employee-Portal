"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  Clock3,
  Check,
  Film,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  User,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { api, ApiError } from "@/lib/api";
import type { WorkAssignment, WorkDeliverable } from "@/lib/types";

function formatSeconds(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function formatDurationReadable(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getUnitIcon(unit?: string) {
  const u = (unit || "").toLowerCase();
  if (u.includes("video") || u.includes("reel")) return <Film size={16} color="#a855f7" />;
  if (u.includes("photo") || u.includes("image") || u.includes("graphic")) return <ImageIcon size={16} color="#ec4899" />;
  return <Layers size={16} color="#3b82f6" />;
}

export function TaskTimerPage() {
  const [tasks, setTasks] = useState<WorkAssignment[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [updatingQuantity, setUpdatingQuantity] = useState(false);

  // Ticking live timer state
  const [liveDurationSeconds, setLiveDurationSeconds] = useState(0);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api<{ results: WorkAssignment[] } | WorkAssignment[]>("/work-assignments/?assigned_to_me=true");
      const list = Array.isArray(res) ? res : res.results || [];
      setTasks(list);

      // Auto-select active task or first task
      const activeTask = list.find((t) => t.active_timer && t.active_timer.started_at);
      if (activeTask) {
        setSelectedTaskId(String(activeTask.id));
      } else if (list.length > 0 && (!selectedTaskId || !list.some((t) => String(t.id) === selectedTaskId))) {
        setSelectedTaskId(String(list[0].id));
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load assigned tasks." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const selectedTask = tasks.find((t) => String(t.id) === String(selectedTaskId));
  const activeTaskRunning = tasks.find((t) => t.active_timer && t.active_timer.started_at);

  // Live Stopwatch Ticker
  useEffect(() => {
    const taskWithTimer = selectedTask?.active_timer?.started_at ? selectedTask : activeTaskRunning;
    if (!taskWithTimer || !taskWithTimer.active_timer?.started_at) {
      setLiveDurationSeconds(0);
      return;
    }

    const startTime = new Date(taskWithTimer.active_timer.started_at).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
      setLiveDurationSeconds(elapsed);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [selectedTask, activeTaskRunning]);

  const handleStartTimer = (taskId: string) => {
    setActionMessage(null);
    startTransition(async () => {
      try {
        await api(`/timer/start/${taskId}/`, { method: "POST" });
        setActionMessage({ type: "success", text: "Timer started successfully!" });
        await fetchTasks();
      } catch (err: any) {
        setActionMessage({ type: "error", text: err.message || "Failed to start timer." });
      }
    });
  };

  const handlePauseTimer = (taskId: string) => {
    setActionMessage(null);
    startTransition(async () => {
      try {
        await api(`/timer/pause/${taskId}/`, { method: "POST" });
        setActionMessage({ type: "success", text: "Timer paused." });
        await fetchTasks();
      } catch (err: any) {
        setActionMessage({ type: "error", text: err.message || "Failed to pause timer." });
      }
    });
  };

  const handleResumeTimer = (taskId: string) => {
    setActionMessage(null);
    startTransition(async () => {
      try {
        await api(`/timer/resume/${taskId}/`, { method: "POST" });
        setActionMessage({ type: "success", text: "Timer resumed." });
        await fetchTasks();
      } catch (err: any) {
        setActionMessage({ type: "error", text: err.message || "Failed to resume timer." });
      }
    });
  };

  const handleStopTimer = (taskId: string) => {
    setActionMessage(null);
    startTransition(async () => {
      try {
        await api(`/timer/stop/${taskId}/`, { method: "POST" });
        setActionMessage({ type: "success", text: "Timer stopped and time entry logged!" });
        await fetchTasks();
      } catch (err: any) {
        setActionMessage({ type: "error", text: err.message || "Failed to stop timer." });
      }
    });
  };

  // Progressive Item Counter update (+1 / -1 / custom)
  const handleUpdateCompletedQuantity = async (delta: number) => {
    if (!selectedTask) return;
    const currentCompleted = selectedTask.completed_quantity || 0;
    const assignedQty = selectedTask.assigned_quantity || 1;
    const newQty = Math.max(0, Math.min(assignedQty, currentCompleted + delta));

    if (newQty === currentCompleted) return;
    setUpdatingQuantity(true);

    try {
      const updated = await api<WorkAssignment>(`/work-assignments/${selectedTask.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ completed_quantity: newQty }),
      });
      setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? { ...t, ...updated, completed_quantity: newQty } : t)));
      setActionMessage({ type: "success", text: `Updated progress: ${newQty} / ${assignedQty} ${selectedTask.unit || "items"}` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update item progress." });
    } finally {
      setUpdatingQuantity(false);
    }
  };

  // Deliverable subtask toggle
  const handleToggleDeliverable = async (deliverableId: string | number, currentStatus: string) => {
    if (!selectedTask || !selectedTask.deliverables) return;
    const newStatus = currentStatus === "Completed" || currentStatus === "Approved" || currentStatus === "Published" ? "In Progress" : "Completed";

    const updatedDeliverables = selectedTask.deliverables.map((d) =>
      String(d.id) === String(deliverableId) ? { ...d, status: newStatus as any } : d
    );

    try {
      const updated = await api<WorkAssignment>(`/work-assignments/${selectedTask.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ deliverables: updatedDeliverables }),
      });
      setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? { ...t, ...updated } : t)));
      setActionMessage({ type: "success", text: `Sub-task status updated!` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to update sub-task." });
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.client_name && t.client_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.unit && t.unit.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [tasks, searchQuery]);

  const isCurrentSelectedRunning = Boolean(selectedTask?.active_timer?.started_at);
  const currentTotalTimeSeconds = (selectedTask?.total_time_spent_seconds || 0) + (isCurrentSelectedRunning ? liveDurationSeconds : 0);

  // Stats calculation
  const totalItemsAssigned = tasks.reduce((sum, t) => sum + (t.assigned_quantity || 1), 0);
  const totalItemsCompleted = tasks.reduce((sum, t) => sum + (t.completed_quantity || 0), 0);

  return (
    <Shell>
      <div style={{ padding: "1.5rem", maxWidth: "1350px", margin: "0 auto", color: "#0f172a" }}>
        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
              <div style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", padding: "8px", borderRadius: "10px", display: "grid", placeItems: "center" }}>
                <Clock3 size={20} />
              </div>
              <div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
                  Task Timer & Progressive Counter
                </h1>
                <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
                  Track live work time and update sub-task item progress (videos, photos, deliverables) in real-time.
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={fetchTasks}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.55rem 1.1rem",
                borderRadius: "0.5rem",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#334155",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global Action Message Banner */}
        {actionMessage && (
          <div
            style={{
              padding: "0.875rem 1rem",
              borderRadius: "0.625rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: actionMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${actionMessage.type === "success" ? "#a7f3d0" : "#fecaca"}`,
              color: actionMessage.type === "success" ? "#065f46" : "#991b1b",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {actionMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ background: "#ffffff", padding: "1.1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assigned Tasks</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", marginTop: "0.25rem" }}>{tasks.length}</div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.2rem" }}>Tasks waiting / active</div>
          </div>

          <div style={{ background: "#ffffff", padding: "1.1rem", borderRadius: "0.75rem", border: `1px solid ${activeTaskRunning ? "#86efac" : "#e2e8f0"}`, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: activeTaskRunning ? "#16a34a" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
              {activeTaskRunning && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 1.5s infinite" }} />}
              Active Stopwatch
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: activeTaskRunning ? "#16a34a" : "#64748b", marginTop: "0.25rem", fontFamily: "monospace" }}>
              {activeTaskRunning ? formatDurationReadable(liveDurationSeconds) : "Idle"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.2rem" }}>
              {activeTaskRunning ? activeTaskRunning.title : "No timer running"}
            </div>
          </div>

          <div style={{ background: "#ffffff", padding: "1.1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Progressive Items</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#a855f7", marginTop: "0.25rem" }}>
              {totalItemsCompleted} <span style={{ fontSize: "1rem", color: "#94a3b8" }}>/ {totalItemsAssigned}</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.2rem" }}>Sub-task items completed</div>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="timer-responsive-grid" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1.5rem" }}>
          {/* Left Column: Assigned Tasks List with Quick Action Timers */}
          <div className="timer-responsive-col" style={{ gridColumn: "span 5", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: "#ffffff", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: "700", color: "#334155" }}>Your Assigned Tasks</span>
                <span style={{ fontSize: "0.75rem", background: "#f1f5f9", padding: "2px 8px", borderRadius: "12px", fontWeight: 600, color: "#64748b" }}>
                  {filteredTasks.length}
                </span>
              </div>

              {/* Search Bar */}
              <div style={{ position: "relative", marginBottom: "0.75rem" }}>
                <Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Search tasks, clients, or units (videos, photos)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.825rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* Task Cards List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "600px", overflowY: "auto", paddingRight: "2px" }}>
                {filteredTasks.length === 0 ? (
                  <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                    No assigned tasks found matching your filter.
                  </div>
                ) : (
                  filteredTasks.map((t) => {
                    const isSelected = String(t.id) === String(selectedTaskId);
                    const isRunning = Boolean(t.active_timer?.started_at);
                    const assignedQty = t.assigned_quantity || 1;
                    const completedQty = t.completed_quantity || 0;
                    const pct = Math.min(100, Math.round((completedQty / assignedQty) * 100));

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(String(t.id))}
                        style={{
                          padding: "0.875rem 1rem",
                          borderRadius: "0.625rem",
                          border: `1.5px solid ${isSelected ? "#10b981" : isRunning ? "#86efac" : "#e2e8f0"}`,
                          background: isSelected ? "#f0fdf4" : isRunning ? "#f0fdf4" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          boxShadow: isSelected ? "0 2px 8px rgba(16, 185, 129, 0.12)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.375rem" }}>
                          <div>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {t.client_name || "General Client"}
                            </span>
                            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a", marginTop: "1px" }}>{t.title}</div>
                            {t.parent_task_title && (
                              <div style={{ fontSize: "0.7rem", color: "#0369a1", background: "rgba(14, 165, 233, 0.1)", padding: "2px 6px", borderRadius: "4px", marginTop: "3px", fontWeight: 600, display: "inline-block" }}>
                                🔗 Goal: {t.parent_task_title}
                              </div>
                            )}
                          </div>
                          {isRunning && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "12px", background: "#dcfce7", color: "#15803d", fontSize: "0.7rem", fontWeight: 700 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                              Running
                            </span>
                          )}
                        </div>

                        {/* Total Time Spent Badge on Task Card */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0.4rem 0 0.5rem 0", background: "rgba(0,0,0,0.03)", padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#475569", fontWeight: 600 }}>
                            <Clock size={13} color="#059669" />
                            Total Time Spent:
                          </span>
                          <strong style={{ fontFamily: "monospace", color: isRunning ? "#16a34a" : "#0f172a", fontSize: "0.8rem" }}>
                            {formatDurationReadable((t.total_time_spent_seconds || 0) + (isRunning ? liveDurationSeconds : 0))}
                          </strong>
                        </div>

                        {/* Unit Progress Bar */}
                        <div style={{ margin: "0.3rem 0 0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              {getUnitIcon(t.unit)}
                              {completedQty} / {assignedQty} {t.unit || "items"}
                            </span>
                            <span style={{ color: pct === 100 ? "#16a34a" : "#64748b" }}>{pct}%</span>
                          </div>
                          <div style={{ width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#16a34a" : "linear-gradient(90deg, #10b981, #059669)", borderRadius: "4px", transition: "width 0.3s ease" }} />
                          </div>
                        </div>

                        {/* Quick Start / Stop Button on Card */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                          <span style={{ fontSize: "0.725rem", color: "#64748b" }}>
                            Due: {t.due_date || "N/A"}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isRunning) handleStopTimer(String(t.id));
                              else handleStartTimer(String(t.id));
                            }}
                            disabled={isPending}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              background: isRunning ? "#ef4444" : "#10b981",
                              color: "#ffffff",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                            }}
                          >
                            {isRunning ? (
                              <>
                                <Square size={12} fill="#fff" /> Stop ({formatDurationReadable(liveDurationSeconds)})
                              </>
                            ) : (
                              <>
                                <Play size={12} fill="#fff" /> Start Timer
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Active Stopwatch & Progressive Counter Panel */}
          <div className="timer-responsive-col" style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Stopwatch Control Card */}
            <div
              style={{
                background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
                borderRadius: "1rem",
                padding: "1.75rem",
                color: "#ffffff",
                boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.25)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.25rem" }}>
                {selectedTask ? selectedTask.client_name || "Client Work" : "Select a task"}
              </div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#f8fafc", margin: "0 0 1.25rem 0", maxWidth: "500px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedTask ? selectedTask.title : "No Task Selected"}
              </h2>

              {/* Prominent Cumulative Total Time Box */}
              {selectedTask && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    maxWidth: "380px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "0.75rem",
                    padding: "0.75rem 1.25rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                      Total Time Invested
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#34d399", fontFamily: "monospace", marginTop: "2px" }}>
                      {formatDurationReadable(currentTotalTimeSeconds)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                      Sessions
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f8fafc", marginTop: "2px" }}>
                      {(selectedTask.time_logs?.length || 0) + (isCurrentSelectedRunning ? 1 : 0)} logs
                    </div>
                  </div>
                </div>
              )}

              {/* Glowing Digital Stopwatch */}
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.45)",
                  border: `2px solid ${isCurrentSelectedRunning ? "#10b981" : "#334155"}`,
                  padding: "1rem 0.75rem",
                  borderRadius: "1rem",
                  marginBottom: "1.5rem",
                  boxShadow: isCurrentSelectedRunning ? "0 0 25px rgba(16, 185, 129, 0.3)" : "none",
                  transition: "all 0.3s ease",
                  width: "100%",
                  maxWidth: "380px",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: "clamp(1.75rem, 6.5vw, 3.25rem)",
                    fontWeight: "800",
                    letterSpacing: "0.02em",
                    color: isCurrentSelectedRunning ? "#34d399" : "#f1f5f9",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {formatSeconds(isCurrentSelectedRunning ? liveDurationSeconds : 0)}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.375rem", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                  {isCurrentSelectedRunning ? "⏱ Active Session Stopwatch" : "Stopwatch Idle (Click Start to Log Work)"}
                </div>
              </div>

              {/* Big Action Buttons */}
              <div style={{ display: "flex", gap: "0.75rem", width: "100%", maxWidth: "380px", flexWrap: "wrap" }}>
                {!isCurrentSelectedRunning ? (
                  <button
                    onClick={() => selectedTaskId && handleStartTimer(selectedTaskId)}
                    disabled={!selectedTaskId || isPending}
                    style={{
                      flex: 1,
                      padding: "0.85rem 1.5rem",
                      borderRadius: "0.625rem",
                      background: "#10b981",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: "800",
                      fontSize: "1rem",
                      cursor: selectedTaskId && !isPending ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                      opacity: selectedTaskId && !isPending ? 1 : 0.6,
                    }}
                  >
                    <Play size={18} fill="#ffffff" />
                    Start Session Timer
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => selectedTaskId && handleStopTimer(selectedTaskId)}
                      disabled={!selectedTaskId || isPending}
                      style={{
                        flex: 1,
                        padding: "0.85rem 1.25rem",
                        borderRadius: "0.625rem",
                        background: "#ef4444",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: "800",
                        fontSize: "0.95rem",
                        cursor: selectedTaskId && !isPending ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        boxShadow: "0 4px 14px rgba(239, 68, 68, 0.35)",
                        opacity: selectedTaskId && !isPending ? 1 : 0.6,
                      }}
                    >
                      <Square size={16} fill="#ffffff" />
                      Stop Timer
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedTaskId || !selectedTask) return;
                        if (isCurrentSelectedRunning) {
                          await handleStopTimer(selectedTaskId);
                        }
                        try {
                          await api(`/work-assignments/${selectedTaskId}/`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              status: "Completed",
                              completed_quantity: selectedTask.assigned_quantity || 1,
                            }),
                          });
                          setActionMessage({ type: "success", text: "Task marked as Completed!" });
                          await fetchTasks();
                        } catch (err: any) {
                          setActionMessage({ type: "error", text: err.message || "Failed to mark complete." });
                        }
                      }}
                      disabled={!selectedTaskId || isPending}
                      style={{
                        padding: "0.85rem 1.25rem",
                        borderRadius: "0.625rem",
                        background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: "800",
                        fontSize: "0.95rem",
                        cursor: selectedTaskId && !isPending ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        boxShadow: "0 4px 14px rgba(59, 130, 246, 0.35)",
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Complete Task
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Progressive Sub-task Item Counter Card */}
            {selectedTask && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "0.75rem",
                  border: "1px solid #e2e8f0",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {getUnitIcon(selectedTask.unit)}
                    <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                      Progressive Item Counter ({selectedTask.unit || "items"})
                    </h3>
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "3px 10px", borderRadius: "12px" }}>
                    Target: {selectedTask.assigned_quantity || 1} {selectedTask.unit || "items"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: "1rem 1.25rem", borderRadius: "0.625rem", border: "1px solid #e2e8f0" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Completed Progress</div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                      {selectedTask.completed_quantity || 0} <span style={{ fontSize: "1.1rem", color: "#94a3b8" }}>/ {selectedTask.assigned_quantity || 1}</span>
                    </div>
                  </div>

                  {/* Increments + / - Controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      onClick={() => handleUpdateCompletedQuantity(-1)}
                      disabled={updatingQuantity || (selectedTask.completed_quantity || 0) <= 0}
                      title="Decrease completed count by 1"
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#334155",
                        display: "grid",
                        placeItems: "center",
                        cursor: (selectedTask.completed_quantity || 0) > 0 && !updatingQuantity ? "pointer" : "not-allowed",
                        opacity: (selectedTask.completed_quantity || 0) > 0 && !updatingQuantity ? 1 : 0.4,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      }}
                    >
                      <Minus size={18} />
                    </button>

                    <button
                      onClick={() => handleUpdateCompletedQuantity(1)}
                      disabled={updatingQuantity || (selectedTask.completed_quantity || 0) >= (selectedTask.assigned_quantity || 1)}
                      title="Increase completed count by 1"
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        border: "none",
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        color: "#ffffff",
                        display: "grid",
                        placeItems: "center",
                        cursor: (selectedTask.completed_quantity || 0) < (selectedTask.assigned_quantity || 1) && !updatingQuantity ? "pointer" : "not-allowed",
                        opacity: (selectedTask.completed_quantity || 0) < (selectedTask.assigned_quantity || 1) && !updatingQuantity ? 1 : 0.4,
                        boxShadow: "0 3px 10px rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      <Plus size={22} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tasks / Deliverables Panel */}
            {selectedTask && selectedTask.deliverables && selectedTask.deliverables.length > 0 && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "0.75rem",
                  border: "1px solid #e2e8f0",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.75rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                  <ListChecks size={18} color="#0284c7" />
                  <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                    Sub-Task Deliverables ({selectedTask.deliverables.length})
                  </h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {selectedTask.deliverables.map((deliv) => {
                    const isDone = deliv.status === "Completed" || deliv.status === "Approved" || deliv.status === "Published";

                    return (
                      <div
                        key={deliv.id}
                        onClick={() => handleToggleDeliverable(deliv.id, deliv.status)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.75rem 1rem",
                          borderRadius: "0.5rem",
                          background: isDone ? "#f0fdf4" : "#f8fafc",
                          border: `1px solid ${isDone ? "#bbf7d0" : "#e2e8f0"}`,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "4px",
                              border: `2px solid ${isDone ? "#16a34a" : "#cbd5e1"}`,
                              background: isDone ? "#16a34a" : "#ffffff",
                              display: "grid",
                              placeItems: "center",
                              color: "#fff",
                            }}
                          >
                            {isDone && <Check size={14} strokeWidth={3} />}
                          </div>
                          <div>
                            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: isDone ? "#16a34a" : "#0f172a", textDecoration: isDone ? "line-through" : "none" }}>
                              {deliv.name || deliv.title}
                            </div>
                            {deliv.brief && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{deliv.brief}</div>}
                          </div>
                        </div>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", background: isDone ? "#dcfce7" : "#e2e8f0", color: isDone ? "#15803d" : "#475569" }}>
                          {deliv.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Time Session History Logs & Work Efficiency Card */}
            {selectedTask && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "0.75rem",
                  border: "1px solid #e2e8f0",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Clock size={18} color="#059669" />
                    <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                      Session Time Logs ({selectedTask.time_logs?.length || 0})
                    </h3>
                  </div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#059669", background: "#ecfdf5", padding: "3px 10px", borderRadius: "12px" }}>
                    Total: {formatDurationReadable(currentTotalTimeSeconds)}
                  </span>
                </div>

                {/* Efficiency metrics summary */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "1rem", background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>CUMULATIVE TIME SPENT</div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                      {formatDurationReadable(currentTotalTimeSeconds)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>WORK RATE / VELOCITY</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#2563eb" }}>
                      {(selectedTask.completed_quantity || 0) > 0
                        ? `${formatDurationReadable(Math.round(currentTotalTimeSeconds / (selectedTask.completed_quantity || 1)))} / item`
                        : "0 completed"}
                    </div>
                  </div>
                </div>

                {!selectedTask.time_logs || selectedTask.time_logs.length === 0 ? (
                  <div style={{ padding: "1.25rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                    No previous work sessions recorded. Click &quot;Start Session Timer&quot; to begin tracking time.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "250px", overflowY: "auto" }}>
                    {selectedTask.time_logs.slice().reverse().map((log, idx) => {
                      const sessionNum = (selectedTask.time_logs?.length || 0) - idx;
                      const start = log.startTime || log.started_at;
                      const end = log.endTime || log.stopped_at || (log as any).ended_at;
                      const duration = log.durationSeconds || log.duration_seconds || 0;

                      return (
                        <div
                          key={log.id || idx}
                          style={{
                            padding: "0.75rem 1rem",
                            borderRadius: "0.5rem",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "0.825rem", fontWeight: 700, color: "#1e293b" }}>
                              Session #{sessionNum}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                              {start ? new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Started"}
                              {end ? ` → ${new Date(end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : " (ongoing)"}
                              {start ? ` • ${new Date(start).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}` : ""}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "monospace", fontSize: "0.95rem", fontWeight: 800, color: "#059669" }}>
                              {formatDurationReadable(duration)}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                              {formatSeconds(duration)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
