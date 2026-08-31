"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  Globe,
  ListTodo,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { PageHeader, PrimaryButton, StatCard, Badge } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import type { Client, WorkAssignment, ClientKPIHealth, WorkspaceRole } from "@/lib/types";
import { ShareLinkModal } from "@/features/work/ShareLinkModal";

type Props = {
  role?: WorkspaceRole;
};

type TaskMode = "QUANTITY" | "MILESTONE";

export function ClientMasterPage({ role = "admin" }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [kpiHealthMap, setKpiHealthMap] = useState<Record<string, ClientKPIHealth>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  // Modal 1: Add Client
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addClientTab, setAddClientTab] = useState<"basic" | "contract" | "assets">("basic");
  const [newClientName, setNewClientName] = useState("");
  const [newClientIndustry, setNewClientIndustry] = useState("");
  const [newClientContactName, setNewClientContactName] = useState("");
  const [newClientContactEmail, setNewClientContactEmail] = useState("");
  const [newClientContactPhone, setNewClientContactPhone] = useState("");
  const [newClientWebsite, setNewClientWebsite] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientContractStart, setNewClientContractStart] = useState("");
  const [newClientContractEnd, setNewClientContractEnd] = useState("");
  const [newClientRetainerFee, setNewClientRetainerFee] = useState("");
  const [newClientProposalTitle, setNewClientProposalTitle] = useState("");
  const [newClientProposalValue, setNewClientProposalValue] = useState("");
  const [newClientBrandAssetName, setNewClientBrandAssetName] = useState("");
  const [newClientBrandAssetUrl, setNewClientBrandAssetUrl] = useState("");
  const [submittingClient, setSubmittingClient] = useState(false);

  // Modal 2: Add Master Task for Client
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [taskMode, setTaskMode] = useState<TaskMode>("QUANTITY");
  const [masterTaskTitle, setMasterTaskTitle] = useState("");
  const [masterTaskQty, setMasterTaskQty] = useState("10");
  const [masterTaskUnit, setMasterTaskUnit] = useState("Photos");
  const [masterTaskDueDate, setMasterTaskDueDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));

  // Milestone To-Do List State
  const [milestones, setMilestones] = useState<string[]>(["Do SEO Audit", "Complete UI Design of Site"]);
  const [newMilestoneInput, setNewMilestoneInput] = useState("");
  const [submittingMasterTask, setSubmittingMasterTask] = useState(false);

  // Modal 3: Share Link
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareClient, setShareClient] = useState<{ id: number | string; name: string } | null>(null);

  // Modal 4: Edit Client
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editClientIndustry, setEditClientIndustry] = useState("");
  const [editClientContactName, setEditClientContactName] = useState("");
  const [editClientContactEmail, setEditClientContactEmail] = useState("");
  const [editClientContactPhone, setEditClientContactPhone] = useState("");
  const [editClientWebsite, setEditClientWebsite] = useState("");
  const [editClientAddress, setEditClientAddress] = useState("");
  const [editClientContractStart, setEditClientContractStart] = useState("");
  const [editClientContractEnd, setEditClientContractEnd] = useState("");
  const [editClientRetainerFee, setEditClientRetainerFee] = useState("");
  const [editClientIsActive, setEditClientIsActive] = useState(true);
  const [editClientNotes, setEditClientNotes] = useState("");
  const [submittingEditClient, setSubmittingEditClient] = useState(false);
  const [clientStatusFilter, setClientStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const openEditClient = (c: Client) => {
    setEditingClient(c);
    setEditClientName(c.name);
    setEditClientIndustry((c as any).industry || "General");
    setEditClientContactName((c as any).contact_person?.name || (c as any).contactPerson?.name || "");
    setEditClientContactEmail((c as any).contact_person?.email || (c as any).contactPerson?.email || "");
    setEditClientContactPhone((c as any).contact_person?.phone || (c as any).contactPerson?.phone || "");
    setEditClientWebsite((c as any).website || "");
    setEditClientAddress((c as any).address || "");
    setEditClientContractStart((c as any).contract_start_date || (c as any).contractStartDate || "");
    setEditClientContractEnd((c as any).contract_end_date || (c as any).contractEndDate || "");
    setEditClientRetainerFee((c as any).retainer_monthly_fee || (c as any).retainerMonthlyFee || "");
    setEditClientIsActive((c as any).is_active ?? (c as any).isActive ?? true);
    setEditClientNotes((c as any).notes || "");
    setEditClientOpen(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editClientName.trim()) return;
    setSubmittingEditClient(true);
    try {
      await api(`/clients/${editingClient.id}/`, {
        method: "PUT",
        body: JSON.stringify({
          name: editClientName.trim(),
          industry: editClientIndustry.trim() || "General",
          contact_person: {
            name: editClientContactName.trim(),
            email: editClientContactEmail.trim(),
            phone: editClientContactPhone.trim(),
          },
          website: editClientWebsite.trim(),
          address: editClientAddress.trim(),
          contract_start_date: editClientContractStart || null,
          contract_end_date: editClientContractEnd || null,
          retainer_monthly_fee: Number(editClientRetainerFee) || 0,
          is_active: editClientIsActive,
          notes: editClientNotes.trim(),
        }),
      });
      toast.success("Client updated successfully!");
      setEditClientOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update client.");
    } finally {
      setSubmittingEditClient(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [clientRes, assignRes] = await Promise.all([
        api<Client[] | { results: Client[] }>("/clients/"),
        api<WorkAssignment[] | { results: WorkAssignment[] }>("/work-assignments/?is_master_client_task=true"),
      ]);

      const clientList = Array.isArray(clientRes) ? clientRes : clientRes?.results || [];
      const assignList = Array.isArray(assignRes) ? assignRes : assignRes?.results || [];

      setClients(clientList);
      setAssignments(assignList);

      const healthPromises = clientList.map((c) =>
        api<ClientKPIHealth>(`/clients/${c.id}/kpi-health/`)
          .then((h) => ({ id: String(c.id), health: h }))
          .catch(() => null)
      );

      const healthResults = await Promise.all(healthPromises);
      const hMap: Record<string, ClientKPIHealth> = {};
      healthResults.forEach((res) => {
        if (res) hMap[res.id] = res.health;
      });
      setKpiHealthMap(hMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client master data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setSubmittingClient(true);
    try {
      const proposals = newClientProposalTitle.trim()
        ? [
            {
              title: newClientProposalTitle.trim(),
              value: Number(newClientProposalValue) || 0,
              status: "Draft",
            },
          ]
        : [];

      const brandAssets =
        newClientBrandAssetName.trim() || newClientBrandAssetUrl.trim()
          ? [
              {
                name: newClientBrandAssetName.trim() || "Brand Drive Asset",
                url: newClientBrandAssetUrl.trim() || "https://drive.google.com",
                assetType: "Logo",
              },
            ]
          : [];

      await api<Client>("/clients/", {
        method: "POST",
        body: JSON.stringify({
          name: newClientName.trim(),
          industry: newClientIndustry.trim() || "General Services",
          contact_person: {
            name: newClientContactName.trim(),
            email: newClientContactEmail.trim(),
            phone: newClientContactPhone.trim(),
          },
          website: newClientWebsite.trim(),
          address: newClientAddress.trim(),
          contract_start_date: newClientContractStart || null,
          contract_end_date: newClientContractEnd || null,
          retainer_monthly_fee: Number(newClientRetainerFee) || 0,
          proposals,
          brand_assets: brandAssets,
        }),
      });

      setNewClientName("");
      setNewClientIndustry("");
      setNewClientContactName("");
      setNewClientContactEmail("");
      setNewClientContactPhone("");
      setNewClientWebsite("");
      setNewClientAddress("");
      setNewClientContractStart("");
      setNewClientContractEnd("");
      setNewClientRetainerFee("");
      setNewClientProposalTitle("");
      setNewClientProposalValue("");
      setNewClientBrandAssetName("");
      setNewClientBrandAssetUrl("");
      setAddClientOpen(false);
      toast.success("Client added successfully!");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add client.");
    } finally {
      setSubmittingClient(false);
    }
  };

  const handleAddMilestone = () => {
    if (newMilestoneInput.trim()) {
      setMilestones((prev) => [...prev, newMilestoneInput.trim()]);
      setNewMilestoneInput("");
    }
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateMasterTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClient = selectedClient || (clients.length > 0 ? clients[0] : null);
    if (!targetClient || !masterTaskTitle.trim()) return;
    setSubmittingMasterTask(true);

    try {
      const isMilestone = taskMode === "MILESTONE";
      const deliverableItems = isMilestone
        ? milestones.map((m, idx) => ({
            id: `ms_${idx}_${Date.now()}`,
            name: m,
            type: "milestone",
            contracted: 1,
            delivered: 0,
            status: "assigned",
          }))
        : [
            {
              id: `qty_${Date.now()}`,
              name: `${masterTaskQty} ${masterTaskUnit}`,
              type: masterTaskUnit.toLowerCase(),
              contracted: Number(masterTaskQty) || 1,
              delivered: 0,
              status: "assigned",
            },
          ];

      await api<WorkAssignment>("/work-assignments/", {
        method: "POST",
        body: JSON.stringify({
          client: targetClient.id,
          title: masterTaskTitle.trim(),
          assigned_quantity: isMilestone ? milestones.length : Number(masterTaskQty) || 1,
          unit: isMilestone ? "Milestones" : masterTaskUnit || "tasks",
          assigned_date: new Date().toISOString().slice(0, 10),
          due_date: masterTaskDueDate,
          is_master_client_task: true,
          deliverables: deliverableItems,
          description: isMilestone
            ? `[MILESTONE TASK] ${milestones.length} To-Do Items: ${milestones.join(", ")}`
            : `[QUANTITY TASK] Contracted Monthly Deliverable Scope: ${masterTaskQty} ${masterTaskUnit}`,
        }),
      });

      setMasterTaskTitle("");
      setAddTaskModalOpen(false);
      toast.success("Master task created successfully!");
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create master task.";
      toast.error(msg);
    } finally {
      setSubmittingMasterTask(false);
    }
  };

  const handleToggleDeliverable = async (task: WorkAssignment, deliverableId: string, currentDelivered: number) => {
    try {
      const nextDelivered = currentDelivered > 0 ? 0 : 1;
      await api(`/work-assignments/${task.id}/deliverables/${deliverableId}/increment/`, {
        method: "POST",
        body: JSON.stringify({ delta: nextDelivered > 0 ? 1 : -1 }),
      });
      toast.success("Milestone item updated!");
      fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update milestone item.";
      toast.error(msg);
    }
  };

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getHealthBadgeStyle = (status?: string) => {
    switch (status) {
      case "Delighted":
        return { bg: "#dcfce7", color: "#15803d", border: "#86efac" };
      case "On Track":
        return { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" };
      case "Needs Attention":
        return { bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
      case "At Risk":
        return { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" };
      default:
        return { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
    }
  };

  return (
    <Shell role={role}>
      <div style={{ padding: "1.5rem", maxWidth: "1400px", margin: "0 auto", color: "#0f172a" }}>
        <PageHeader
          title="Client Master & Contract Retainer Portal"
          subtitle="Manage client accounts, monthly progressive counts (Videos, Photos), milestone tasks (SEO, UI Design), and client satisfaction KPI health."
          action={
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (clients.length > 0) setSelectedClient(clients[0]);
                  setAddTaskModalOpen(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "13px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
                }}
              >
                <Plus size={16} /> + New Client Task
              </button>

              <button
                type="button"
                onClick={() => setAddClientOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "#3b82f6",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "13px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Briefcase size={16} /> Add New Client
              </button>

              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          }
        />

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <StatCard label="Total Clients" value={loading ? "--" : clients.length} note="Active Client Accounts" icon={<Briefcase />} />
          <StatCard label="Delighted Clients" value={loading ? "--" : Object.values(kpiHealthMap).filter(h => h.healthStatus === "Delighted" || h.healthStatus === "On Track").length} note="KPI Health ≥ 70%" icon={<TrendingUp />} accent />
          <StatCard label="Attention Needed" value={loading ? "--" : Object.values(kpiHealthMap).filter(h => h.healthStatus === "Needs Attention" || h.healthStatus === "At Risk").length} note="Requires progress boost" icon={<Clock />} />
          <StatCard label="Total Contract Tasks" value={loading ? "--" : assignments.filter(a => a.is_master_client_task).length} note="Monthly Master Tasks" icon={<CheckCircle2 />} />
        </div>

        {/* Search Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", minWidth: "300px", flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search clients by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                outline: "none",
                background: "#ffffff",
              }}
            />
          </div>
        </div>

        {/* Clients Grid */}
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>Loading Client Master records...</div>
        ) : filteredClients.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            No clients found. Click <b>+ Add New Client</b> to create your first client record.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
            {filteredClients.map((client) => {
              const kpi = kpiHealthMap[String(client.id)];
              const badgeStyle = getHealthBadgeStyle(kpi?.healthStatus);
              const clientMasterTasks = assignments.filter((a) => String(a.client) === String(client.id) && a.is_master_client_task);

              return (
                <div
                  key={client.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                      <div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>{client.name}</h3>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "2px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>ID #{client.id}</span>
                          {(client as any).industry && (
                            <span style={{ fontSize: "0.72rem", color: "#059669", background: "rgba(16,185,129,0.1)", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                              {(client as any).industry}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "12px",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: `1px solid ${badgeStyle.border}`,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {kpi?.healthStatus || "On Track"} ({kpi?.satisfactionScore || 100}%)
                      </span>
                    </div>

                    {/* Contact Person & Retainer info */}
                    {((client as any).contact_person?.name || (client as any).contactPerson?.name || (client as any).retainer_monthly_fee || (client as any).retainerMonthlyFee) && (
                      <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "8px", border: "1px solid #f1f5f9", marginBottom: "10px", fontSize: "0.75rem", color: "#475569", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {((client as any).contact_person?.name || (client as any).contactPerson?.name) && (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>👤 Contact: <b>{(client as any).contact_person?.name || (client as any).contactPerson?.name}</b></span>
                            <span>{((client as any).contact_person?.phone || (client as any).contactPerson?.phone || (client as any).contact_person?.email || (client as any).contactPerson?.email || "")}</span>
                          </div>
                        )}
                        {Boolean((client as any).retainer_monthly_fee || (client as any).retainerMonthlyFee) && (
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#059669", fontWeight: 700 }}>
                            <span>💰 Retainer Fee:</span>
                            <span>₹{Number((client as any).retainer_monthly_fee || (client as any).retainerMonthlyFee).toLocaleString()}/month</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* KPI Progress Bars */}
                    <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #f1f5f9", marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        <span>Contract Quota Fulfillment</span>
                        <span>{kpi?.quotaCompletionPct || 0}%</span>
                      </div>
                      <div style={{ height: "6px", width: "100%", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden", marginBottom: "8px" }}>
                        <div style={{ height: "100%", width: `${kpi?.quotaCompletionPct || 0}%`, background: "linear-gradient(90deg, #10b981 0%, #059669 100%)", borderRadius: "99px" }} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        <span>On-Time Delivery Rate</span>
                        <span>{kpi?.onTimeDeliveryPct || 0}%</span>
                      </div>
                      <div style={{ height: "6px", width: "100%", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${kpi?.onTimeDeliveryPct || 0}%`, background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)", borderRadius: "99px" }} />
                      </div>
                    </div>

                    {/* Contract Scope Master Tasks & Milestone Checklists */}
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                        Master Tasks & Deliverables ({clientMasterTasks.length})
                      </div>
                      {clientMasterTasks.length === 0 ? (
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic" }}>
                          No master tasks set yet. Click <b>+ Master Task</b> below.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {clientMasterTasks.map((mt) => (
                            <div key={mt.id} style={{ background: "#ffffff", padding: "8px 10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", marginBottom: "4px" }}>
                                <span style={{ fontWeight: 700, color: "#0f172a" }}>🎯 {mt.title}</span>
                                <span style={{ fontWeight: 700, fontSize: "0.75rem", color: mt.completed_quantity >= mt.assigned_quantity ? "#16a34a" : "#2563eb" }}>
                                  {mt.completed_quantity}/{mt.assigned_quantity} {mt.unit}
                                </span>
                              </div>

                              {/* Render Deliverable Items / To-Do Checklists */}
                              {mt.deliverables && mt.deliverables.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #e2e8f0" }}>
                                  {mt.deliverables.map((del) => {
                                    const delId = String(del.id || (del as any)._id || "");
                                    const isDone = (del.delivered || 0) > 0 || del.status === "Completed" || del.status === "Published";
                                    return (
                                      <div
                                        key={delId}
                                        onClick={() => handleToggleDeliverable(mt, delId, isDone ? 1 : 0)}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          fontSize: "0.75rem",
                                          color: isDone ? "#16a34a" : "#475569",
                                          cursor: "pointer",
                                          userSelect: "none",
                                          textDecoration: isDone ? "line-through" : "none",
                                        }}
                                      >
                                        {isDone ? <CheckSquare size={13} style={{ color: "#16a34a" }} /> : <Square size={13} style={{ color: "#94a3b8" }} />}
                                        <span>{del.name || del.title}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <a
                        href={`/clients/tasks`}
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: "6px",
                          background: "linear-gradient(135deg, rgba(5,150,105,0.12) 0%, rgba(16,185,129,0.12) 100%)",
                          color: "#059669",
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                        }}
                      >
                        <Calendar size={13} /> Tasks & Calendar
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setShareClient({ id: client.id, name: client.name });
                          setShareModalOpen(true);
                        }}
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: "6px",
                          background: "rgba(59, 130, 246, 0.1)",
                          color: "#2563eb",
                          border: "1px solid rgba(59, 130, 246, 0.3)",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                        }}
                      >
                        <Globe size={13} /> Share Portal
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(client);
                          setAddTaskModalOpen(true);
                        }}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          borderRadius: "6px",
                          background: "rgba(16, 185, 129, 0.08)",
                          color: "#059669",
                          border: "1px solid rgba(16, 185, 129, 0.25)",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                        }}
                      >
                        <Plus size={13} /> + Master Task
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditClient(client)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          background: "rgba(100, 116, 139, 0.1)",
                          color: "#475569",
                          border: "1px solid rgba(100, 116, 139, 0.25)",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                        }}
                        title="Edit Client Details & Status"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal 4: Edit Client Account */}
        {editClientOpen && editingClient && (
          <Modal title={`Edit Client — ${editingClient.name}`} size="md" onClose={() => setEditClientOpen(false)}>
            <form onSubmit={handleUpdateClient} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                CLIENT NAME *
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  required
                  className="fi"
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                  INDUSTRY / CATEGORY
                  <input
                    type="text"
                    value={editClientIndustry}
                    onChange={(e) => setEditClientIndustry(e.target.value)}
                    className="fi"
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                  MONTHLY RETAINER FEE (₹)
                  <input
                    type="number"
                    value={editClientRetainerFee}
                    onChange={(e) => setEditClientRetainerFee(e.target.value)}
                    className="fi"
                    placeholder="e.g. 50000"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                  CONTACT PERSON
                  <input
                    type="text"
                    value={editClientContactName}
                    onChange={(e) => setEditClientContactName(e.target.value)}
                    className="fi"
                    placeholder="Name"
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                  EMAIL
                  <input
                    type="email"
                    value={editClientContactEmail}
                    onChange={(e) => setEditClientContactEmail(e.target.value)}
                    className="fi"
                    placeholder="Email"
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                  PHONE
                  <input
                    type="text"
                    value={editClientContactPhone}
                    onChange={(e) => setEditClientContactPhone(e.target.value)}
                    className="fi"
                    placeholder="Phone"
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                  CONTRACT START
                  <input
                    type="date"
                    value={editClientContractStart}
                    onChange={(e) => setEditClientContractStart(e.target.value)}
                    className="fi"
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                  CONTRACT END
                  <input
                    type="date"
                    value={editClientContractEnd}
                    onChange={(e) => setEditClientContractEnd(e.target.value)}
                    className="fi"
                  />
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                NOTES / ACCOUNT CONTEXT
                <textarea
                  value={editClientNotes}
                  onChange={(e) => setEditClientNotes(e.target.value)}
                  rows={3}
                  className="fi"
                  placeholder="Key account details, monthly retainers, or specific client instructions..."
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, color: "#334155", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editClientIsActive}
                  onChange={(e) => setEditClientIsActive(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                Active Client (Visible in active assignment dropdowns)
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" className="secondary-button" onClick={() => setEditClientOpen(false)}>
                  Cancel
                </button>
                <PrimaryButton type="submit" disabled={submittingEditClient}>
                  {submittingEditClient ? "Saving..." : "Save Changes"}
                </PrimaryButton>
              </div>
            </form>
          </Modal>
        )}

        {/* Modal 1: Add New Client (Multi-Tab with Contact, Proposal, Brand Assets) */}
        {addClientOpen && (
          <Modal title="Add New Client Account" size="lg" onClose={() => setAddClientOpen(false)}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", marginBottom: "14px" }}>
              <button
                type="button"
                onClick={() => setAddClientTab("basic")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: 0,
                  background: addClientTab === "basic" ? "#059669" : "#f1f5f9",
                  color: addClientTab === "basic" ? "#fff" : "#475569",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                1. Basic & Contact Info
              </button>
              <button
                type="button"
                onClick={() => setAddClientTab("contract")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: 0,
                  background: addClientTab === "contract" ? "#059669" : "#f1f5f9",
                  color: addClientTab === "contract" ? "#fff" : "#475569",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                2. Contract & Retainer
              </button>
              <button
                type="button"
                onClick={() => setAddClientTab("assets")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: 0,
                  background: addClientTab === "assets" ? "#059669" : "#f1f5f9",
                  color: addClientTab === "assets" ? "#fff" : "#475569",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                3. Proposals & Brand Assets
              </button>
            </div>

            <form onSubmit={handleAddClient} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* TAB 1: BASIC & CONTACT */}
              {addClientTab === "basic" && (
                <>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                    CLIENT COMPANY NAME *
                    <input
                      type="text"
                      placeholder="e.g. Expo Masters / Acme Corp"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      required
                      className="fi"
                    />
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                      INDUSTRY / CATEGORY
                      <input
                        type="text"
                        placeholder="e.g. Real Estate, E-Commerce, Healthcare"
                        value={newClientIndustry}
                        onChange={(e) => setNewClientIndustry(e.target.value)}
                        className="fi"
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                      WEBSITE URL
                      <input
                        type="url"
                        placeholder="https://clientwebsite.com"
                        value={newClientWebsite}
                        onChange={(e) => setNewClientWebsite(e.target.value)}
                        className="fi"
                      />
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                      CONTACT PERSON
                      <input
                        type="text"
                        placeholder="e.g. John Doe"
                        value={newClientContactName}
                        onChange={(e) => setNewClientContactName(e.target.value)}
                        className="fi"
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                      EMAIL
                      <input
                        type="email"
                        placeholder="client@company.com"
                        value={newClientContactEmail}
                        onChange={(e) => setNewClientContactEmail(e.target.value)}
                        className="fi"
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                      PHONE / WHATSAPP
                      <input
                        type="text"
                        placeholder="+91 9876543210"
                        value={newClientContactPhone}
                        onChange={(e) => setNewClientContactPhone(e.target.value)}
                        className="fi"
                      />
                    </label>
                  </div>

                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                    OFFICE ADDRESS
                    <input
                      type="text"
                      placeholder="e.g. Suite 402, Trade Tower, Mumbai"
                      value={newClientAddress}
                      onChange={(e) => setNewClientAddress(e.target.value)}
                      className="fi"
                    />
                  </label>
                </>
              )}

              {/* TAB 2: CONTRACT & RETAINER */}
              {addClientTab === "contract" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                      CONTRACT START DATE
                      <input
                        type="date"
                        value={newClientContractStart}
                        onChange={(e) => setNewClientContractStart(e.target.value)}
                        className="fi"
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                      CONTRACT END DATE
                      <input
                        type="date"
                        value={newClientContractEnd}
                        onChange={(e) => setNewClientContractEnd(e.target.value)}
                        className="fi"
                      />
                    </label>
                  </div>

                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                    MONTHLY RETAINER FEE (₹)
                    <input
                      type="number"
                      placeholder="e.g. 75000"
                      value={newClientRetainerFee}
                      onChange={(e) => setNewClientRetainerFee(e.target.value)}
                      className="fi"
                    />
                  </label>
                </>
              )}

              {/* TAB 3: PROPOSALS & ASSETS */}
              {addClientTab === "assets" && (
                <>
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", display: "block", marginBottom: "6px" }}>
                      📄 Initial Proposal Details
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                        PROPOSAL TITLE
                        <input
                          type="text"
                          placeholder="e.g. FY2026 Digital Strategy Proposal"
                          value={newClientProposalTitle}
                          onChange={(e) => setNewClientProposalTitle(e.target.value)}
                          className="fi"
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                        VALUE (₹)
                        <input
                          type="number"
                          placeholder="e.g. 150000"
                          value={newClientProposalValue}
                          onChange={(e) => setNewClientProposalValue(e.target.value)}
                          className="fi"
                        />
                      </label>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", display: "block", marginBottom: "6px" }}>
                      🎨 Brand Assets (Google Drive, Dropbox, Guidelines)
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                        ASSET NAME
                        <input
                          type="text"
                          placeholder="e.g. Master Logo Pack"
                          value={newClientBrandAssetName}
                          onChange={(e) => setNewClientBrandAssetName(e.target.value)}
                          className="fi"
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                        DRIVE / ASSET LINK
                        <input
                          type="url"
                          placeholder="https://drive.google.com/drive/folders/..."
                          value={newClientBrandAssetUrl}
                          onChange={(e) => setNewClientBrandAssetUrl(e.target.value)}
                          className="fi"
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", paddingTop: "8px", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {addClientTab === "basic" && "Step 1 of 3"}
                  {addClientTab === "contract" && "Step 2 of 3"}
                  {addClientTab === "assets" && "Step 3 of 3"}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" className="secondary-button" onClick={() => setAddClientOpen(false)}>
                    Cancel
                  </button>
                  <PrimaryButton type="submit" disabled={submittingClient}>
                    {submittingClient ? "Adding..." : "Save Client Record"}
                  </PrimaryButton>
                </div>
              </div>
            </form>
          </Modal>
        )}

        {/* Modal 2: Add Master Task for Client (Supports Progressive Quantity OR To-Do Milestone Checklists!) */}
        {addTaskModalOpen && (
          <Modal title={`Add Master Goal & Tasks — ${selectedClient ? selectedClient.name : "Client"}`} size="lg" onClose={() => setAddTaskModalOpen(false)}>
            <form onSubmit={handleCreateMasterTask} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Client Selector (if not pre-selected) */}
              {!selectedClient && clients.length > 0 && (
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                  SELECT TARGET CLIENT *
                  <select
                    onChange={(e) => {
                      const match = clients.find((c) => String(c.id) === e.target.value);
                      if (match) setSelectedClient(match);
                    }}
                    className="fs"
                    required
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Task Mode Switcher */}
              <div style={{ display: "flex", gap: "10px", background: "#f1f5f9", padding: "4px", borderRadius: "8px" }}>
                <button
                  type="button"
                  onClick={() => setTaskMode("QUANTITY")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: taskMode === "QUANTITY" ? "#ffffff" : "transparent",
                    color: taskMode === "QUANTITY" ? "#10b981" : "#64748b",
                    boxShadow: taskMode === "QUANTITY" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <TrendingUp size={14} /> 🔢 Progressive Count Task (Videos/Photos)
                </button>

                <button
                  type="button"
                  onClick={() => setTaskMode("MILESTONE")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: taskMode === "MILESTONE" ? "#ffffff" : "transparent",
                    color: taskMode === "MILESTONE" ? "#2563eb" : "#64748b",
                    boxShadow: taskMode === "MILESTONE" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <ListTodo size={14} /> 📋 To-Do / Milestone Checklist (SEO, UI Design)
                </button>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                MASTER TASK / GOAL TITLE *
                <input
                  type="text"
                  placeholder={taskMode === "QUANTITY" ? "e.g. Monthly Social Media Retainer" : "e.g. Website Overhaul & SEO Optimization"}
                  value={masterTaskTitle}
                  onChange={(e) => setMasterTaskTitle(e.target.value)}
                  required
                  className="fi"
                />
              </label>

              {/* Mode A: Progressive Count inputs */}
              {taskMode === "QUANTITY" && (
                <div className="form-row-2">
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                    CONTRACTED QUANTITY *
                    <input
                      type="number"
                      min="1"
                      value={masterTaskQty}
                      onChange={(e) => setMasterTaskQty(e.target.value)}
                      required
                      className="fi"
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                    DELIVERABLE UNIT *
                    <select
                      value={masterTaskUnit}
                      onChange={(e) => setMasterTaskUnit(e.target.value)}
                      className="fs"
                    >
                      <option value="Photos">Photos</option>
                      <option value="Videos">Videos</option>
                      <option value="Creatives">Creatives</option>
                      <option value="Reels">Reels</option>
                      <option value="Posts">Posts</option>
                      <option value="Tasks">Tasks</option>
                      <option value="Documents">Documents</option>
                    </select>
                  </label>
                </div>
              )}

              {/* Mode B: Milestone To-Do Items Builder */}
              {taskMode === "MILESTONE" && (
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#334155", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    MILESTONE TO-DO CHECKLIST ITEMS ({milestones.length})
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                    {milestones.map((m, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                        <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 600 }}>{idx + 1}. {m}</span>
                        <button type="button" onClick={() => handleRemoveMilestone(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="Add milestone item (e.g. Do SEO Audit, Complete UI Design)..."
                      value={newMilestoneInput}
                      onChange={(e) => setNewMilestoneInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddMilestone();
                        }
                      }}
                      className="fi"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddMilestone}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        background: "#2563eb",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                TARGET COMPLETION DUE DATE *
                <input
                  type="date"
                  value={masterTaskDueDate}
                  onChange={(e) => setMasterTaskDueDate(e.target.value)}
                  required
                  className="fi"
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" className="secondary-button" onClick={() => setAddTaskModalOpen(false)}>
                  Cancel
                </button>
                <PrimaryButton type="submit" disabled={submittingMasterTask}>
                  {submittingMasterTask ? "Saving..." : "Create Master Goal"}
                </PrimaryButton>
              </div>
            </form>
          </Modal>
        )}

        {/* Modal 3: Share Client Portal */}
        {shareClient && (
          <ShareLinkModal
            clientId={shareClient.id}
            clientName={shareClient.name}
            assignments={assignments}
            open={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
          />
        )}
      </div>
    </Shell>
  );
}
