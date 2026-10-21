"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Film,
  Filter,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  ListPlus,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { PageHeader, PrimaryButton, StatCard, Badge } from "@/components/ui";
import { Modal } from "@/features/common/Modal";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import type {
  Client,
  ClientDeliverableTracker,
  ClientDeliverablesSummary,
  DeliveredItem,
  DeliverableType,
  YearlyDeliverablesReportResponse,
  YearlyClientReportRow,
} from "@/lib/types";

const ALL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DELIVERABLE_TYPE_OPTIONS: { value: DeliverableType; label: string; icon: string }[] = [
  { value: "poster", label: "Poster / Static Creative", icon: "🖼️" },
  { value: "video", label: "Video / Motion Graphic", icon: "🎬" },
  { value: "reel", label: "Instagram Reel / Short", icon: "📱" },
  { value: "carousel", label: "Carousel Graphic", icon: "📑" },
  { value: "story", label: "Story Post", icon: "⚡" },
  { value: "extra", label: "Extra Campaign / Festive", icon: "🌟" },
  { value: "other", label: "Other Custom Work", icon: "📦" },
];

export function ClientDeliverablesPage() {
  const [activeTab, setActiveTab] = useState<"monthly" | "yearly">("monthly");

  // Filter States
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<string>("October");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Data States
  const [records, setRecords] = useState<ClientDeliverableTracker[]>([]);
  const [summary, setSummary] = useState<ClientDeliverablesSummary | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([2026]);
  const [loading, setLoading] = useState(true);

  // Yearly Report States
  const [yearlyReport, setYearlyReport] = useState<YearlyDeliverablesReportResponse | null>(null);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [selectedClientForYearly, setSelectedClientForYearly] = useState<string>("ALL");

  // Portal Registered Clients for Dropdown
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isCustomClient, setIsCustomClient] = useState(false);

  // Modal 1: Add / Edit Client Deliverable Target
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ClientDeliverableTracker | null>(null);
  const [clientNameInput, setClientNameInput] = useState("");
  const [monthInput, setMonthInput] = useState("October");
  const [yearInput, setYearInput] = useState(2026);
  const [cycleLabelInput, setCycleLabelInput] = useState("SEPT-26 TO OCT 25");
  const [postersTargetInput, setPostersTargetInput] = useState<number>(6);
  const [postersDeliveredInput, setPostersDeliveredInput] = useState<number>(0);
  const [videosTargetInput, setVideosTargetInput] = useState<number>(4);
  const [videosDeliveredInput, setVideosDeliveredInput] = useState<number>(0);
  const [yearlyTargetPostersInput, setYearlyTargetPostersInput] = useState<number>(72);
  const [yearlyTargetVideosInput, setYearlyTargetVideosInput] = useState<number>(48);
  const [extraWorksInput, setExtraWorksInput] = useState("");
  const [statusInput, setStatusInput] = useState<"ACTIVE" | "COMPLETED" | "ON_HOLD">("ACTIVE");
  const [submittingTarget, setSubmittingTarget] = useState(false);

  // Modal 2: Log Completed Deliverable (with optional post link)
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [activeTrackerForLog, setActiveTrackerForLog] = useState<ClientDeliverableTracker | null>(null);
  const [logItemType, setLogItemType] = useState<DeliverableType>("poster");
  const [logItemTitle, setLogItemTitle] = useState("");
  const [logItemPostUrl, setLogItemPostUrl] = useState("");
  const [logItemDate, setLogItemDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logItemNotes, setLogItemNotes] = useState("");
  const [logAutoIncrement, setLogAutoIncrement] = useState(true);
  const [submittingLog, setSubmittingLog] = useState(false);

  // Drawer / Modal 3: View Reference Links
  const [linksDrawerOpen, setLinksDrawerOpen] = useState(false);
  const [activeTrackerForLinks, setActiveTrackerForLinks] = useState<ClientDeliverableTracker | null>(null);
  const [editingUrlItemId, setEditingUrlItemId] = useState<string | null>(null);
  const [urlEditInput, setUrlEditInput] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);

  // Modal 4: Copy Targets From Previous Month
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyFromMonth, setCopyFromMonth] = useState("September");
  const [copyFromYear, setCopyFromYear] = useState(2026);
  const [copyToMonth, setCopyToMonth] = useState("November");
  const [copyToYear, setCopyToYear] = useState(2026);
  const [copyCycleLabel, setCopyCycleLabel] = useState("OCT-26 TO NOV 25");
  const [submittingCopy, setSubmittingCopy] = useState(false);

  // Fetch monthly tracking records
  const loadDeliverables = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedYear) queryParams.set("year", String(selectedYear));
      if (selectedMonth && selectedMonth !== "ALL") queryParams.set("month", selectedMonth);
      if (statusFilter && statusFilter !== "ALL") queryParams.set("status", statusFilter);
      if (searchQuery.trim()) queryParams.set("search", searchQuery.trim());

      const res = await api<{
        records: ClientDeliverableTracker[];
        summary: ClientDeliverablesSummary;
        availableYears: number[];
        availableMonths: string[];
      }>(`/client-deliverables?${queryParams.toString()}`);

      setRecords(res.records || []);
      setSummary(res.summary || null);
      if (res.availableYears && res.availableYears.length > 0) {
        setAvailableYears(res.availableYears);
      }
      if (res.availableMonths && res.availableMonths.length > 0) {
        setAvailableMonths(res.availableMonths);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load client deliverables");
    } finally {
      setLoading(false);
    }
  };

  // Fetch yearly matrix report
  const loadYearlyReport = async () => {
    setYearlyLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set("year", String(selectedYear));
      if (selectedClientForYearly !== "ALL") {
        queryParams.set("clientName", selectedClientForYearly);
      }

      const res = await api<YearlyDeliverablesReportResponse>(`/client-deliverables/yearly?${queryParams.toString()}`);
      setYearlyReport(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load yearly report");
    } finally {
      setYearlyLoading(false);
    }
  };

  // Fetch portal clients for dropdown
  useEffect(() => {
    api<Client[]>("/clients")
      .then((res) => {
        if (Array.isArray(res)) {
          setClients(res);
        }
      })
      .catch((err) => console.error("Could not load clients for dropdown:", err));
  }, []);

  useEffect(() => {
    if (activeTab === "monthly") {
      loadDeliverables();
    } else {
      loadYearlyReport();
    }
  }, [activeTab, selectedYear, selectedMonth, statusFilter]);

  // Open Target Modal for New Client
  const openNewTargetModal = () => {
    setEditingRecord(null);
    setSelectedClientId("");
    setIsCustomClient(false);
    setClientNameInput("");
    setMonthInput(selectedMonth === "ALL" ? "October" : selectedMonth);
    setYearInput(selectedYear);
    setCycleLabelInput(selectedMonth === "October" ? "SEPT-26 TO OCT 25" : "");
    setPostersTargetInput(6);
    setPostersDeliveredInput(0);
    setVideosTargetInput(4);
    setVideosDeliveredInput(0);
    setYearlyTargetPostersInput(72);
    setYearlyTargetVideosInput(48);
    setExtraWorksInput("");
    setStatusInput("ACTIVE");
    setTargetModalOpen(true);
  };

  // Open Target Modal for Editing Existing Record
  const openEditTargetModal = (rec: ClientDeliverableTracker) => {
    setEditingRecord(rec);
    const matched = clients.find(
      (c) => (rec.client && String(c.id) === String(rec.client)) || c.name.toLowerCase() === rec.clientName.toLowerCase()
    );
    if (matched) {
      setSelectedClientId(String(matched.id));
      setIsCustomClient(false);
    } else {
      setSelectedClientId("");
      setIsCustomClient(true);
    }
    setClientNameInput(rec.clientName);
    setMonthInput(rec.month);
    setYearInput(rec.year);
    setCycleLabelInput(rec.cycleLabel || "");
    setPostersTargetInput(rec.posters?.target || 0);
    setPostersDeliveredInput(rec.posters?.delivered || 0);
    setVideosTargetInput(rec.videos?.target || 0);
    setVideosDeliveredInput(rec.videos?.delivered || 0);
    setYearlyTargetPostersInput(rec.yearlyTargetPosters || (rec.posters?.target || 0) * 12);
    setYearlyTargetVideosInput(rec.yearlyTargetVideos || (rec.videos?.target || 0) * 12);
    setExtraWorksInput(rec.extraWorksNotes || "");
    setStatusInput(rec.status || "ACTIVE");
    setTargetModalOpen(true);
  };

  // Save Target Modal Handler
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientNameInput.trim()) {
      toast.error("Please enter or select a client");
      return;
    }

    setSubmittingTarget(true);
    try {
      const payload = {
        client: selectedClientId && !isCustomClient ? selectedClientId : undefined,
        clientName: clientNameInput.trim(),
        month: monthInput.trim(),
        year: yearInput,
        cycleLabel: cycleLabelInput.trim(),
        postersTarget: Number(postersTargetInput),
        postersDelivered: Number(postersDeliveredInput),
        videosTarget: Number(videosTargetInput),
        videosDelivered: Number(videosDeliveredInput),
        yearlyTargetPosters: Number(yearlyTargetPostersInput),
        yearlyTargetVideos: Number(yearlyTargetVideosInput),
        extraWorksNotes: extraWorksInput.trim(),
        status: statusInput,
      };

      if (editingRecord) {
        await api(`/client-deliverables/${editingRecord._id}/`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success(`Updated deliverables for ${clientNameInput}`);
      } else {
        await api(`/client-deliverables/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(`Added deliverables for ${clientNameInput}`);
      }

      setTargetModalOpen(false);
      loadDeliverables();
    } catch (err: any) {
      toast.error(err.message || "Failed to save client deliverable");
    } finally {
      setSubmittingTarget(false);
    }
  };

  // Open Log Completed Deliverable Modal
  const openLogDeliverableModal = (rec: ClientDeliverableTracker, defaultType: DeliverableType = "poster") => {
    setActiveTrackerForLog(rec);
    setLogItemType(defaultType);
    setLogItemTitle("");
    setLogItemPostUrl("");
    setLogItemDate(new Date().toISOString().slice(0, 10));
    setLogItemNotes("");
    setLogAutoIncrement(true);
    setLogModalOpen(true);
  };

  // Submit Completed Deliverable
  const handleLogDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrackerForLog) return;
    if (!logItemTitle.trim()) {
      toast.error("Please enter a deliverable title");
      return;
    }

    setSubmittingLog(true);
    try {
      await api(`/client-deliverables/${activeTrackerForLog._id}/log-item/`, {
        method: "POST",
        body: JSON.stringify({
          deliverableType: logItemType,
          title: logItemTitle.trim(),
          postUrl: logItemPostUrl.trim(),
          publishedDate: logItemDate,
          notes: logItemNotes.trim(),
          autoIncrement: logAutoIncrement,
        }),
      });

      toast.success(`Logged ${logItemType} for ${activeTrackerForLog.clientName}!`);
      setLogModalOpen(false);
      loadDeliverables();
    } catch (err: any) {
      toast.error(err.message || "Failed to log deliverable");
    } finally {
      setSubmittingLog(false);
    }
  };

  // Quick Inline Increment (+1)
  const handleQuickIncrement = async (rec: ClientDeliverableTracker, type: "poster" | "video") => {
    try {
      const payload = {
        postersDelivered: type === "poster" ? (rec.posters?.delivered || 0) + 1 : rec.posters?.delivered,
        videosDelivered: type === "video" ? (rec.videos?.delivered || 0) + 1 : rec.videos?.delivered,
      };

      await api(`/client-deliverables/${rec._id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success(`Incremented ${type} count for ${rec.clientName} (+1)`);
      loadDeliverables();
    } catch (err: any) {
      toast.error(err.message || "Failed to increment deliverable count");
    }
  };

  // Delete Logged Deliverable Item from Drawer
  const handleDeleteItem = async (itemId: string) => {
    if (!activeTrackerForLinks) return;
    if (!confirm("Are you sure you want to remove this logged deliverable link?")) return;

    try {
      await api(`/client-deliverables/${activeTrackerForLinks._id}/items/${itemId}/?decrement=true`, {
        method: "DELETE",
      });

      toast.success("Removed deliverable reference");
      const updatedItems = activeTrackerForLinks.deliveredItems.filter((i) => i.id !== itemId);
      setActiveTrackerForLinks({
        ...activeTrackerForLinks,
        deliveredItems: updatedItems,
      });
      loadDeliverables();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove item");
    }
  };

  // Save / Update URL for an individual delivered item
  const handleSaveItemUrl = async (itemId: string) => {
    if (!activeTrackerForLinks) return;
    setSavingUrl(true);
    try {
      await api(`/client-deliverables/${activeTrackerForLinks._id}/items/${itemId}/`, {
        method: "PATCH",
        body: JSON.stringify({ postUrl: urlEditInput.trim() }),
      });
      // Update local drawer state
      const updated = {
        ...activeTrackerForLinks,
        deliveredItems: activeTrackerForLinks.deliveredItems.map((i) =>
          i.id === itemId ? { ...i, postUrl: urlEditInput.trim() } : i
        ),
      };
      setActiveTrackerForLinks(updated);
      setRecords((prev) =>
        prev.map((r) =>
          r._id === activeTrackerForLinks._id
            ? {
                ...r,
                deliveredItems: r.deliveredItems.map((i) =>
                  i.id === itemId ? { ...i, postUrl: urlEditInput.trim() } : i
                ),
              }
            : r
        )
      );
      toast.success("Post URL updated successfully!");
      setEditingUrlItemId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update URL");
    } finally {
      setSavingUrl(false);
    }
  };

  // Delete Entire Client Record for this Month
  const handleDeleteRecord = async (rec: ClientDeliverableTracker) => {
    if (!confirm(`Are you sure you want to delete ${rec.clientName}'s deliverable count for ${rec.month} ${rec.year}?`)) {
      return;
    }

    try {
      await api(`/client-deliverables/${rec._id}/`, { method: "DELETE" });
      toast.success(`Deleted record for ${rec.clientName}`);
      loadDeliverables();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete record");
    }
  };

  // Copy Targets from Previous Month
  const handleCopyMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCopy(true);
    try {
      const res = await api<{ message: string; createdCount: number }>(`/client-deliverables/copy-month/`, {
        method: "POST",
        body: JSON.stringify({
          fromMonth: copyFromMonth,
          fromYear: copyFromYear,
          toMonth: copyToMonth,
          toYear: copyToYear,
          cycleLabel: copyCycleLabel,
        }),
      });

      toast.success(res.message);
      setCopyModalOpen(false);
      setSelectedMonth(copyToMonth);
      setSelectedYear(copyToYear);
      loadDeliverables();
    } catch (err: any) {
      toast.error(err.message || "Failed to copy month targets");
    } finally {
      setSubmittingCopy(false);
    }
  };

  // Sync / Seed from Excel
  const handleResyncExcel = async () => {
    if (!confirm("This will import/update September and October records from 'Clients Monthly count.xlsx'. Continue?")) {
      return;
    }

    try {
      const res = await api<{ message: string }>(`/client-deliverables/seed-from-excel/`, {
        method: "POST",
      });
      toast.success(res.message);
      loadDeliverables();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync from Excel");
    }
  };

  // Export Monthly View as CSV
  const exportMonthlyCSV = () => {
    if (records.length === 0) {
      toast.error("No records to export");
      return;
    }

    const headers = [
      "Client",
      "Month",
      "Billing Cycle",
      "Total Posters",
      "Published Posters",
      "Pending Posters",
      "Total Videos",
      "Published Videos",
      "Pending Videos",
      "Extra Works",
      "Reference Links Count",
      "Status",
    ];

    const rows = records.map((r) => [
      `"${r.clientName.replace(/"/g, '""')}"`,
      `"${r.month}"`,
      `"${r.cycleLabel || ""}"`,
      r.posters?.target || 0,
      r.posters?.delivered || 0,
      r.posters?.pending || 0,
      r.videos?.target || 0,
      r.videos?.delivered || 0,
      r.videos?.pending || 0,
      `"${(r.extraWorksNotes || "").replace(/"/g, '""')}"`,
      (r.deliveredItems || []).filter((i) => i.postUrl).length,
      r.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Flumenx_Deliverables_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Records based on search
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        (r.extraWorksNotes && r.extraWorksNotes.toLowerCase().includes(q)) ||
        (r.cycleLabel && r.cycleLabel.toLowerCase().includes(q))
    );
  }, [records, searchQuery]);

  return (
    <div className="client-deliverables-page" style={{ padding: "8px 8px 60px 8px" }}>
      {/* Top Header */}
      <PageHeader
        eyebrow="AGENCY OPERATIONS / HR TRACKING"
        title="Client Monthly Deliverables"
        subtitle="Manage and document monthly & yearly deliverable counts (Posters, Videos, Reels, etc.) for clients, track pending deliverables, and record live post reference links."
        action={
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleResyncExcel}
              className="btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid #DCE3E0",
                background: "#FFFFFF",
                color: "#18231F",
                cursor: "pointer",
              }}
              title="Re-import / sync numbers from Clients Monthly count.xlsx"
            >
              <RefreshCw size={13} /> Sync from Excel
            </button>
            <button
              type="button"
              onClick={() => setCopyModalOpen(true)}
              className="btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid #DCE3E0",
                background: "#FFFFFF",
                color: "#18231F",
                cursor: "pointer",
              }}
              title="Copy monthly target quotas to another month"
            >
              <Copy size={13} /> Copy Month Targets
            </button>
            <button
              type="button"
              onClick={exportMonthlyCSV}
              className="btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid #DCE3E0",
                background: "#FFFFFF",
                color: "#18231F",
                cursor: "pointer",
              }}
            >
              <Download size={13} /> Export CSV
            </button>
            <PrimaryButton onClick={openNewTargetModal}>
              <Plus size={15} /> Add Client Count
            </PrimaryButton>
          </div>
        }
      />

      {/* Navigation Tab Bar: Monthly vs Yearly */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderBottom: "1px solid #DCE3E0",
          marginBottom: "24px",
          paddingBottom: "12px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("monthly")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 18px",
            fontSize: "13px",
            fontWeight: 700,
            borderRadius: "8px",
            border: activeTab === "monthly" ? "1px solid #087A5B" : "1px solid #DCE3E0",
            cursor: "pointer",
            background: activeTab === "monthly" ? "#087A5B" : "#FFFFFF",
            color: activeTab === "monthly" ? "#FFFFFF" : "#4A5568",
            boxShadow: activeTab === "monthly" ? "0 2px 4px rgba(8, 122, 91, 0.25)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <Calendar size={15} /> Monthly Tracking Board
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("yearly")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 18px",
            fontSize: "13px",
            fontWeight: 700,
            borderRadius: "8px",
            border: activeTab === "yearly" ? "1px solid #087A5B" : "1px solid #DCE3E0",
            cursor: "pointer",
            background: activeTab === "yearly" ? "#087A5B" : "#FFFFFF",
            color: activeTab === "yearly" ? "#FFFFFF" : "#4A5568",
            boxShadow: activeTab === "yearly" ? "0 2px 4px rgba(8, 122, 91, 0.25)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <TrendingUp size={15} /> Yearly Matrix & Reports
        </button>
      </div>

      {activeTab === "monthly" ? (
        <>
          {/* Top KPI Stat Cards */}
          {summary && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <StatCard
                label="Clients Monitored"
                value={summary.totalClients}
                note={`${selectedMonth} ${selectedYear}`}
                icon={<PackageCheck size={18} />}
              />
              <StatCard
                label="Posters Delivered"
                value={`${summary.totalDeliveredPosters} / ${summary.totalTargetPosters}`}
                note={`Pending: ${summary.totalPendingPosters} posters`}
                icon={<ImageIcon size={18} />}
                accent={true}
              />
              <StatCard
                label="Videos Delivered"
                value={`${summary.totalDeliveredVideos} / ${summary.totalTargetVideos}`}
                note={`Pending: ${summary.totalPendingVideos} videos`}
                icon={<Film size={18} />}
                accent={true}
              />
              <StatCard
                label="Overall Completion"
                value={`${summary.overallCompletionRate}%`}
                note={`${summary.totalDeliveredAll} of ${summary.totalTargetAll} deliverables`}
                icon={<TrendingUp size={18} />}
                active={true}
              />
              <StatCard
                label="Reference Links Logged"
                value={summary.totalReferenceLinksCount}
                note={`${summary.totalExtraWorksCount} extra campaign posts`}
                icon={<LinkIcon size={18} />}
              />
            </div>
          )}

          {/* Filter Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "14px 18px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #DCE3E0",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* Year Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    color: "inherit",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    color: "inherit",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <option value="ALL">All Months</option>
                  {ALL_MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    color: "inherit",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ON_HOLD">On Hold</option>
                </select>
              </div>
            </div>

            {/* Search Client */}
            <div style={{ position: "relative", minWidth: "260px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                type="text"
                placeholder="Search client, notes, extra works..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 12px 7px 32px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "1px solid #DCE3E0",
                  background: "#FFFFFF",
                  color: "inherit",
                  outline: "none",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--muted)",
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Master Deliverables Table */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #DCE3E0",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            {loading ? (
              <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)" }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px auto" }} />
                <p style={{ fontSize: "14px", fontWeight: 600 }}>Loading client monthly deliverables...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)" }}>
                <PackageCheck size={36} style={{ margin: "0 auto 12px auto", opacity: 0.4 }} />
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--text)" }}>No Deliverables Tracked Yet</h3>
                <p style={{ fontSize: "13px", maxWidth: "450px", margin: "0 auto 16px auto" }}>
                  No client deliverable counts found for {selectedMonth} {selectedYear}. You can add one manually or sync records from Excel.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                  <PrimaryButton onClick={openNewTargetModal}>
                    <Plus size={14} /> Add First Client Count
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={handleResyncExcel}
                    style={{
                      padding: "8px 14px",
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "8px",
                      border: "1px solid #DCE3E0",
                      background: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    Sync from Excel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid #DCE3E0" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", fontSize: "11px" }}>Client</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", fontSize: "11px" }}>Month & Cycle</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", fontSize: "11px", textAlign: "center" }} colSpan={3}>
                        Posters & Creatives (Target / Published / Pending)
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", fontSize: "11px", textAlign: "center" }} colSpan={3}>
                        Videos & Reels (Target / Published / Pending)
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", fontSize: "11px" }}>Extra Works & Notes</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", fontSize: "11px", textAlign: "center" }}>Post Links</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", fontSize: "11px", textAlign: "right" }}>Actions</th>
                    </tr>
                    <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: "1px solid #DCE3E0", fontSize: "11px", color: "var(--muted)" }}>
                      <th style={{ padding: "6px 16px" }}></th>
                      <th style={{ padding: "6px 16px" }}></th>
                      <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>Target</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>Delivered</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>Pending</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>Target</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>Delivered</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>Pending</th>
                      <th style={{ padding: "6px 16px" }}></th>
                      <th style={{ padding: "6px 16px", textAlign: "center" }}></th>
                      <th style={{ padding: "6px 16px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((rec) => {
                      const pPending = rec.posters?.pending || 0;
                      const vPending = rec.videos?.pending || 0;
                      const linksCount = (rec.deliveredItems || []).filter((i) => i.postUrl && i.postUrl.trim() !== "").length;

                      return (
                        <tr
                          key={rec._id}
                          style={{
                            borderBottom: "1px solid #DCE3E0",
                            transition: "background 0.1s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          {/* Client Name */}
                          <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--text)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "6px",
                                  background: "rgba(8, 122, 91, 0.1)",
                                  color: "#087A5B",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                }}
                              >
                                {rec.clientName.charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <div>{rec.clientName}</div>
                                {rec.yearlyTargetPosters > 0 && (
                                  <small style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 500 }}>
                                    Yearly: {rec.yearlyTargetPosters}P / {rec.yearlyTargetVideos}V
                                  </small>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Month & Cycle */}
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 600 }}>{rec.month} {rec.year}</div>
                            {rec.cycleLabel && (
                              <small style={{ fontSize: "11px", color: "var(--muted)" }}>{rec.cycleLabel}</small>
                            )}
                          </td>

                          {/* Posters Target */}
                          <td style={{ padding: "14px 8px", textAlign: "center", fontWeight: 600 }}>
                            {rec.posters?.target || 0}
                          </td>

                          {/* Posters Delivered (+1 Quick Button) */}
                          <td style={{ padding: "14px 8px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontWeight: 700, color: "#087A5B" }}>
                                {rec.posters?.delivered || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuickIncrement(rec, "poster")}
                                title="Quick increment delivered posters (+1)"
                                style={{
                                  padding: "2px 5px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  borderRadius: "4px",
                                  border: "1px solid rgba(8, 122, 91, 0.3)",
                                  background: "rgba(8, 122, 91, 0.08)",
                                  color: "#087A5B",
                                  cursor: "pointer",
                                }}
                              >
                                +1
                              </button>
                            </div>
                          </td>

                          {/* Posters Pending */}
                          <td style={{ padding: "14px 8px", textAlign: "center" }}>
                            {pPending === 0 ? (
                              <span style={{ color: "#10b981", fontWeight: 700, fontSize: "11px" }}>NIL</span>
                            ) : (
                              <span style={{ color: "#ef4444", fontWeight: 700 }}>{pPending}</span>
                            )}
                          </td>

                          {/* Videos Target */}
                          <td style={{ padding: "14px 8px", textAlign: "center", fontWeight: 600 }}>
                            {rec.videos?.target || 0}
                          </td>

                          {/* Videos Delivered (+1 Quick Button) */}
                          <td style={{ padding: "14px 8px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontWeight: 700, color: "#087A5B" }}>
                                {rec.videos?.delivered || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuickIncrement(rec, "video")}
                                title="Quick increment delivered videos (+1)"
                                style={{
                                  padding: "2px 5px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  borderRadius: "4px",
                                  border: "1px solid rgba(8, 122, 91, 0.3)",
                                  background: "rgba(8, 122, 91, 0.08)",
                                  color: "#087A5B",
                                  cursor: "pointer",
                                }}
                              >
                                +1
                              </button>
                            </div>
                          </td>

                          {/* Videos Pending */}
                          <td style={{ padding: "14px 8px", textAlign: "center" }}>
                            {vPending === 0 ? (
                              <span style={{ color: "#10b981", fontWeight: 700, fontSize: "11px" }}>NIL</span>
                            ) : (
                              <span style={{ color: "#ef4444", fontWeight: 700 }}>{vPending}</span>
                            )}
                          </td>

                          {/* Extra Works Notes */}
                          <td style={{ padding: "14px 16px", maxWidth: "260px" }}>
                            {rec.extraWorksNotes ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: "11px",
                                  lineHeight: 1.35,
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  background: "rgba(234, 179, 8, 0.12)",
                                  color: "#b45309",
                                  border: "1px solid rgba(234, 179, 8, 0.3)",
                                }}
                              >
                                {rec.extraWorksNotes}
                              </span>
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: "12px" }}>—</span>
                            )}
                          </td>

                          {/* Reference Post Links */}
                          <td style={{ padding: "14px 16px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTrackerForLinks(rec);
                                setLinksDrawerOpen(true);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 10px",
                                fontSize: "11px",
                                fontWeight: 600,
                                borderRadius: "6px",
                                border: "1px solid #DCE3E0",
                                background: linksCount > 0 ? "rgba(8, 122, 91, 0.08)" : "#FFFFFF",
                                color: linksCount > 0 ? "#087A5B" : "var(--muted)",
                                cursor: "pointer",
                              }}
                              title="Click to view reference links & completed items"
                            >
                              <LinkIcon size={12} />
                              {linksCount > 0 ? `${linksCount} Link${linksCount > 1 ? "s" : ""}` : "0 Links"}
                            </button>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => openLogDeliverableModal(rec)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 12px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  borderRadius: "6px",
                                  border: "1px solid #087A5B",
                                  background: "#087A5B",
                                  color: "#FFFFFF",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  boxShadow: "0 1px 2px rgba(8, 122, 91, 0.2)",
                                }}
                                title="Log a completed poster/video and add post reference URL"
                              >
                                <Plus size={11} /> Log Work
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditTargetModal(rec)}
                                style={{
                                  padding: "5px 7px",
                                  fontSize: "11px",
                                  borderRadius: "6px",
                                  border: "1px solid #DCE3E0",
                                  background: "#FFFFFF",
                                  cursor: "pointer",
                                  color: "var(--text)",
                                }}
                                title="Edit targets, counts, and cycle"
                              >
                                <Pencil size={12} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(rec)}
                                style={{
                                  padding: "5px 7px",
                                  fontSize: "11px",
                                  borderRadius: "6px",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  background: "rgba(239, 68, 68, 0.06)",
                                  cursor: "pointer",
                                  color: "#ef4444",
                                }}
                                title="Delete record"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* YEARLY REPORTS TAB */
        <div className="yearly-deliverables-report">
          {/* Yearly Controls Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "16px 20px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #DCE3E0",
              marginBottom: "24px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Client Filter:</span>
                <select
                  value={selectedClientForYearly}
                  onChange={(e) => setSelectedClientForYearly(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    minWidth: "180px",
                  }}
                >
                  <option value="ALL">All Clients (Agency Matrix)</option>
                  {yearlyReport?.clients.map((c) => (
                    <option key={c.clientName} value={c.clientName}>
                      {c.clientName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: "1px solid #DCE3E0",
                  background: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <Printer size={13} /> Print Report
              </button>
            </div>
          </div>

          {yearlyLoading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)" }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px auto" }} />
              <p style={{ fontSize: "14px", fontWeight: 600 }}>Calculating annual matrix & client summaries...</p>
            </div>
          ) : yearlyReport ? (
            <>
              {/* Grand Yearly KPI Overview */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <StatCard
                  label="Annual Quota Target"
                  value={yearlyReport.agencyGrandTotals.totalTarget}
                  note={`${yearlyReport.agencyGrandTotals.targetPosters} Posters + ${yearlyReport.agencyGrandTotals.targetVideos} Videos`}
                  icon={<Award size={18} />}
                />
                <StatCard
                  label="Annual Delivered"
                  value={yearlyReport.agencyGrandTotals.totalDelivered}
                  note={`${yearlyReport.agencyGrandTotals.deliveredPosters} Posters + ${yearlyReport.agencyGrandTotals.deliveredVideos} Videos`}
                  icon={<CheckCircle2 size={18} />}
                  accent={true}
                />
                <StatCard
                  label="Annual Pending Quota"
                  value={yearlyReport.agencyGrandTotals.totalPending}
                  note={`${yearlyReport.agencyGrandTotals.pendingPosters} P + ${yearlyReport.agencyGrandTotals.pendingVideos} V remaining`}
                  icon={<Clock size={18} />}
                />
                <StatCard
                  label="Agency Completion Rate"
                  value={`${yearlyReport.agencyGrandTotals.overallCompletionRate}%`}
                  note="YTD Target Fulfillment"
                  icon={<TrendingUp size={18} />}
                  active={true}
                />
              </div>

              {/* Agency Grand Matrix Table */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "12px",
                  border: "1px solid #DCE3E0",
                  overflow: "hidden",
                  marginBottom: "30px",
                }}
              >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #DCE3E0", background: "rgba(0,0,0,0.01)" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                    {selectedYear} Client Deliverables Matrix (Month-wise & Yearly Totals)
                  </h3>
                  <small style={{ color: "var(--muted)" }}>
                    Values represented as [Delivered / Target] for each active month.
                  </small>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid #DCE3E0" }}>
                        <th style={{ padding: "10px 14px", fontWeight: 700, color: "var(--muted)" }}>Client Name</th>
                        {ALL_MONTHS.map((m) => (
                          <th key={m} style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>
                            {m.slice(0, 3)}
                          </th>
                        ))}
                        <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>Target Posters</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>Delivered Posters</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>Target Videos</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>Delivered Videos</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>Total Target</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>Total Delivered</th>
                        <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>Completion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearlyReport.clients.map((c) => {
                        return (
                          <tr key={c.clientName} style={{ borderBottom: "1px solid #DCE3E0" }}>
                            <td style={{ padding: "12px 14px", fontWeight: 700 }}>
                              {c.clientName}
                            </td>

                            {/* Month Columns */}
                            {ALL_MONTHS.map((m) => {
                              const mData = c.months[m.toLowerCase()];
                              if (!mData) {
                                return (
                                  <td key={m} style={{ padding: "12px 8px", textAlign: "center", color: "var(--muted)" }}>
                                    —
                                  </td>
                                );
                              }
                              const pTot = `${mData.posters.delivered}/${mData.posters.target}P`;
                              const vTot = `${mData.videos.delivered}/${mData.videos.target}V`;
                              return (
                                <td key={m} style={{ padding: "12px 8px", textAlign: "center" }}>
                                  <div style={{ fontSize: "11px", fontWeight: 600 }}>{pTot}</div>
                                  <div style={{ fontSize: "11px", color: "#087A5B" }}>{vTot}</div>
                                </td>
                              );
                            })}

                            {/* Totals */}
                            <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 600 }}>{c.totals.targetPosters}</td>
                            <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 700, color: "#087A5B" }}>{c.totals.deliveredPosters}</td>
                            <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 600 }}>{c.totals.targetVideos}</td>
                            <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 700, color: "#087A5B" }}>{c.totals.deliveredVideos}</td>
                            <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 700 }}>{c.totals.totalTarget}</td>
                            <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 700, color: "#087A5B" }}>{c.totals.totalDelivered}</td>
                            <td style={{ padding: "12px 10px", textAlign: "center" }}>
                              <span
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: c.totals.completionRate >= 100 ? "rgba(16, 185, 129, 0.15)" : "rgba(8, 122, 91, 0.1)",
                                  color: c.totals.completionRate >= 100 ? "#059669" : "#087A5B",
                                }}
                              >
                                {c.totals.completionRate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Footer Row: Agency Totals */}
                      <tr style={{ background: "rgba(8, 122, 91, 0.05)", fontWeight: 700, borderTop: "2px solid #DCE3E0" }}>
                        <td style={{ padding: "14px 14px", fontWeight: 800 }}>AGENCY TOTALS</td>
                        {ALL_MONTHS.map((m) => (
                          <td key={m} style={{ padding: "14px 8px", textAlign: "center" }}>
                            {/* Empty spacer for monthly agency totals */}
                          </td>
                        ))}
                        <td style={{ padding: "14px 10px", textAlign: "center" }}>{yearlyReport.agencyGrandTotals.targetPosters}</td>
                        <td style={{ padding: "14px 10px", textAlign: "center", color: "#087A5B" }}>{yearlyReport.agencyGrandTotals.deliveredPosters}</td>
                        <td style={{ padding: "14px 10px", textAlign: "center" }}>{yearlyReport.agencyGrandTotals.targetVideos}</td>
                        <td style={{ padding: "14px 10px", textAlign: "center", color: "#087A5B" }}>{yearlyReport.agencyGrandTotals.deliveredVideos}</td>
                        <td style={{ padding: "14px 10px", textAlign: "center" }}>{yearlyReport.agencyGrandTotals.totalTarget}</td>
                        <td style={{ padding: "14px 10px", textAlign: "center", color: "#087A5B" }}>{yearlyReport.agencyGrandTotals.totalDelivered}</td>
                        <td style={{ padding: "14px 10px", textAlign: "center" }}>
                          <span style={{ padding: "3px 8px", borderRadius: "6px", background: "#087A5B", color: "#fff" }}>
                            {yearlyReport.agencyGrandTotals.overallCompletionRate}%
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT CLIENT DELIVERABLE COUNT */}
      {targetModalOpen && (
        <Modal
          title={editingRecord ? `Edit ${editingRecord.clientName}` : "Add Client Monthly Deliverables"}
          eyebrow="TARGET & QUOTA SETUP"
          size="lg"
          onClose={() => setTargetModalOpen(false)}
        >
          <form onSubmit={handleSaveTarget} style={{ padding: "16px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                  Select Client from Portal *
                </label>
                <select
                  value={isCustomClient ? "__custom__" : (selectedClientId || "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__custom__") {
                      setIsCustomClient(true);
                      setSelectedClientId("");
                      setClientNameInput("");
                    } else if (val) {
                      setIsCustomClient(false);
                      setSelectedClientId(val);
                      const matched = clients.find((c) => String(c.id) === val);
                      if (matched) {
                        setClientNameInput(matched.name);
                      }
                    } else {
                      setSelectedClientId("");
                      setClientNameInput("");
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    fontSize: "13px",
                    marginBottom: isCustomClient ? "8px" : "0",
                  }}
                >
                  <option value="">-- Choose Registered Client ({clients.length}) --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.industry ? `(${c.industry})` : ""}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Custom / Other Client Name</option>
                </select>

                {isCustomClient ? (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom client name (e.g. GRAPHITE HOMES)"
                    value={clientNameInput}
                    onChange={(e) => setClientNameInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #087A5B",
                      background: "#FFFFFF",
                      fontSize: "13px",
                    }}
                  />
                ) : clientNameInput ? (
                  <div style={{ marginTop: "4px", fontSize: "11px", color: "#087A5B", fontWeight: 600 }}>
                    ✓ Linked: {clientNameInput}
                  </div>
                ) : null}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                  Billing Cycle Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. SEPT-26 TO OCT 25"
                  value={cycleLabelInput}
                  onChange={(e) => setCycleLabelInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                  Tracking Month *
                </label>
                <select
                  value={monthInput}
                  onChange={(e) => setMonthInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    fontSize: "13px",
                  }}
                >
                  {ALL_MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                  Year *
                </label>
                <input
                  type="number"
                  required
                  value={yearInput}
                  onChange={(e) => setYearInput(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            {/* Poster Target & Delivered */}
            <div style={{ padding: "14px", background: "rgba(0,0,0,0.02)", borderRadius: "8px", marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <ImageIcon size={14} /> Posters & Creatives Quota
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                    Monthly Target
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={postersTargetInput}
                    onChange={(e) => setPostersTargetInput(Number(e.target.value))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                    Delivered / Published
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={postersDeliveredInput}
                    onChange={(e) => setPostersDeliveredInput(Number(e.target.value))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                    Yearly Target Quota
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={yearlyTargetPostersInput}
                    onChange={(e) => setYearlyTargetPostersInput(Number(e.target.value))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                  />
                </div>
              </div>
            </div>

            {/* Video Target & Delivered */}
            <div style={{ padding: "14px", background: "rgba(0,0,0,0.02)", borderRadius: "8px", marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Film size={14} /> Videos & Reels Quota
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                    Monthly Target
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={videosTargetInput}
                    onChange={(e) => setVideosTargetInput(Number(e.target.value))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                    Delivered / Published
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={videosDeliveredInput}
                    onChange={(e) => setVideosDeliveredInput(Number(e.target.value))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                    Yearly Target Quota
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={yearlyTargetVideosInput}
                    onChange={(e) => setYearlyTargetVideosInput(Number(e.target.value))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                  />
                </div>
              </div>
            </div>

            {/* Extra Works Notes */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                Extra Works / Festive Posts / Notes
              </label>
              <textarea
                placeholder="e.g. 2 posters (Gandhi Jayanthi & Vijayadashmi), 1 carryover pending video from last month"
                value={extraWorksInput}
                onChange={(e) => setExtraWorksInput(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #DCE3E0",
                  background: "#FFFFFF",
                  fontSize: "13px",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setTargetModalOpen(false)}
                className="btn-secondary"
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  borderRadius: "8px",
                  border: "1px solid #DCE3E0",
                  background: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={submittingTarget}>
                {submittingTarget ? "Saving..." : editingRecord ? "Update Quota" : "Create Deliverables"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: LOG DELIVERABLE WITH OPTIONAL POST URL */}
      {logModalOpen && activeTrackerForLog && (
        <Modal
          title={`Log Completed Deliverable for ${activeTrackerForLog.clientName}`}
          eyebrow="RECORD DELIVERED ITEM"
          size="md"
          onClose={() => setLogModalOpen(false)}
        >
          <form onSubmit={handleLogDeliverable} style={{ padding: "16px 24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                Deliverable Type *
              </label>
              <select
                value={logItemType}
                onChange={(e) => setLogItemType(e.target.value as DeliverableType)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #DCE3E0",
                  background: "#FFFFFF",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {DELIVERABLE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                Deliverable Title / Description *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Gandhi Jayanthi Festival Greeting Poster"
                value={logItemTitle}
                onChange={(e) => setLogItemTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #DCE3E0",
                  background: "#FFFFFF",
                  fontSize: "13px",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700 }}>
                  Post / Reference Link <small style={{ color: "var(--muted)", fontWeight: 500 }}>(Optional - for future reference)</small>
                </label>
                {logItemPostUrl.trim() && (
                  <a
                    href={logItemPostUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "11px", color: "#087A5B", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}
                  >
                    <ExternalLink size={11} /> Test Link
                  </a>
                )}
              </div>
              <input
                type="url"
                placeholder="https://instagram.com/p/... or Drive/YouTube link"
                value={logItemPostUrl}
                onChange={(e) => setLogItemPostUrl(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #DCE3E0",
                  background: "#FFFFFF",
                  fontSize: "13px",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                  Published Date
                </label>
                <input
                  type="date"
                  value={logItemDate}
                  onChange={(e) => setLogItemDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #DCE3E0",
                    background: "#FFFFFF",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                  Auto-Increment Delivered Count?
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={logAutoIncrement}
                    onChange={(e) => setLogAutoIncrement(e.target.checked)}
                  />
                  <span>Yes, add +1 to delivered {logItemType}s</span>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                Notes / Remarks
              </label>
              <textarea
                placeholder="Optional notes regarding this post or client feedback"
                value={logItemNotes}
                onChange={(e) => setLogItemNotes(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #DCE3E0",
                  background: "#FFFFFF",
                  fontSize: "13px",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="btn-secondary"
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  borderRadius: "8px",
                  border: "1px solid #DCE3E0",
                  background: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={submittingLog}>
                {submittingLog ? "Recording..." : "Save Deliverable"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* DRAWER / MODAL 3: VIEW REFERENCE LINKS & DELIVERED ITEMS */}
      {linksDrawerOpen && activeTrackerForLinks && (
        <Modal
          title={`Reference Links & Delivered Works: ${activeTrackerForLinks.clientName}`}
          eyebrow={`${activeTrackerForLinks.month} ${activeTrackerForLinks.year}`}
          size="lg"
          onClose={() => setLinksDrawerOpen(false)}
        >
          <div style={{ padding: "16px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                  All published deliverables and recorded URLs for {activeTrackerForLinks.clientName} in {activeTrackerForLinks.month} {activeTrackerForLinks.year}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLinksDrawerOpen(false);
                  openLogDeliverableModal(activeTrackerForLinks);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "1px solid #087A5B",
                  background: "rgba(8, 122, 91, 0.08)",
                  color: "#087A5B",
                  cursor: "pointer",
                }}
              >
                <Plus size={13} /> Add Deliverable Link
              </button>
            </div>

            {(!activeTrackerForLinks.deliveredItems || activeTrackerForLinks.deliveredItems.length === 0) ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)" }}>
                <LinkIcon size={32} style={{ margin: "0 auto 10px auto", opacity: 0.4 }} />
                <p style={{ fontSize: "13px", margin: 0 }}>No individual deliverable links logged for this month yet.</p>
                <small style={{ color: "var(--muted)" }}>You can click &apos;Add Deliverable Link&apos; to attach live post URLs.</small>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "450px", overflowY: "auto" }}>
                {activeTrackerForLinks.deliveredItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #DCE3E0",
                      background: "rgba(0,0,0,0.015)",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <span style={{ fontSize: "20px" }}>
                        {item.deliverableType === "video" || item.deliverableType === "reel" ? "🎬" : "🖼️"}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text)" }}>{item.title}</span>
                          {item.autoSynced && (
                            <span style={{ padding: "2px 7px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, background: "rgba(14, 165, 233, 0.12)", color: "#0284c7", border: "1px solid rgba(14, 165, 233, 0.3)" }}>
                              ⚡ Task Auto-Synced
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                          <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{item.deliverableType}</span>
                          <span>•</span>
                          <span>{item.publishedDate ? new Date(item.publishedDate).toLocaleDateString() : "No date"}</span>
                          {item.notes && (
                            <>
                              <span>•</span>
                              <span>{item.notes}</span>
                            </>
                          )}
                        </div>
                        {editingUrlItemId === item.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                            <input
                              type="url"
                              value={urlEditInput}
                              onChange={(e) => setUrlEditInput(e.target.value)}
                              placeholder="Paste post link (e.g. https://instagram.com/p/...)"
                              style={{
                                padding: "4px 8px",
                                fontSize: "11px",
                                borderRadius: "4px",
                                border: "1px solid #087A5B",
                                minWidth: "240px",
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveItemUrl(item.id)}
                              disabled={savingUrl}
                              style={{
                                padding: "4px 8px",
                                fontSize: "11px",
                                borderRadius: "4px",
                                background: "#087A5B",
                                color: "#fff",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              {savingUrl ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUrlItemId(null)}
                              style={{
                                padding: "4px 8px",
                                fontSize: "11px",
                                borderRadius: "4px",
                                background: "#F1F5F9",
                                border: "1px solid #CBD5E1",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                            {item.postUrl ? (
                              <>
                                <a
                                  href={item.postUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    color: "#087A5B",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    wordBreak: "break-all",
                                  }}
                                >
                                  <ExternalLink size={11} /> {item.postUrl}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUrlItemId(item.id);
                                    setUrlEditInput(item.postUrl || "");
                                  }}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--muted)",
                                    fontSize: "11px",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    padding: 0,
                                  }}
                                  title="Edit URL"
                                >
                                  edit
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUrlItemId(item.id);
                                  setUrlEditInput("");
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  borderRadius: "4px",
                                  background: "rgba(8, 122, 91, 0.08)",
                                  color: "#087A5B",
                                  border: "1px solid rgba(8, 122, 91, 0.25)",
                                  cursor: "pointer",
                                }}
                              >
                                <Plus size={11} /> Attach Post Link
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      {item.postUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(item.postUrl || "");
                            toast.success("Post URL copied to clipboard!");
                          }}
                          style={{
                            padding: "6px",
                            borderRadius: "6px",
                            border: "1px solid #DCE3E0",
                            background: "#FFFFFF",
                            cursor: "pointer",
                            color: "var(--muted)",
                          }}
                          title="Copy link"
                        >
                          <ClipboardCopy size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        style={{
                          padding: "6px",
                          borderRadius: "6px",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          background: "rgba(239, 68, 68, 0.08)",
                          cursor: "pointer",
                          color: "#ef4444",
                        }}
                        title="Remove deliverable"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL 4: COPY MONTH TARGETS */}
      {copyModalOpen && (
        <Modal
          title="Copy Client Targets To Another Month"
          eyebrow="BATCH MONTH ROLLOVER"
          size="md"
          onClose={() => setCopyModalOpen(false)}
        >
          <form onSubmit={handleCopyMonth} style={{ padding: "16px 24px" }}>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px 0" }}>
              Quickly replicate all target quotas (Posters & Videos) from a source month into a new month. Delivered counts start at 0 so HR starts fresh.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                  COPY FROM MONTH
                </label>
                <select
                  value={copyFromMonth}
                  onChange={(e) => setCopyFromMonth(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                >
                  {ALL_MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                  FROM YEAR
                </label>
                <input
                  type="number"
                  value={copyFromYear}
                  onChange={(e) => setCopyFromYear(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                  COPY TO MONTH
                </label>
                <select
                  value={copyToMonth}
                  onChange={(e) => setCopyToMonth(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                >
                  {ALL_MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                  TO YEAR
                </label>
                <input
                  type="number"
                  value={copyToYear}
                  onChange={(e) => setCopyToYear(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>
                NEW CYCLE LABEL
              </label>
              <input
                type="text"
                placeholder="e.g. OCT-26 TO NOV 25"
                value={copyCycleLabel}
                onChange={(e) => setCopyCycleLabel(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #DCE3E0", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                className="btn-secondary"
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #DCE3E0", fontSize: "13px" }}
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={submittingCopy}>
                {submittingCopy ? "Copying..." : "Replicate Targets"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
