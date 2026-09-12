"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { Modal } from "@/features/common/Modal";
import type { JournalEntry, ChartOfAccount, VoucherType, JournalStatus } from "@/lib/types";
import { formatCurrency, formatDate, STATUS_COLORS, unpackResults, exportToCsv } from "./accountingUtils";

interface Props {
  initialOpenNewModal?: boolean;
  onModalClose?: () => void;
}

interface NewLineItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number | string;
  credit: number | string;
}

export function JournalEntriesView({ initialOpenNewModal = false, onModalClose }: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [partyFilter, setPartyFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New Journal Modal
  const [showAddModal, setShowAddModal] = useState(initialOpenNewModal);
  const [submitting, setSubmitting] = useState(false);

  // Party Association & Reference State
  const [clients, setClients] = useState<any[]>([]);
  const [partyMode, setPartyMode] = useState<"NONE" | "CLIENT" | "MANUAL">("NONE");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [partyCategory, setPartyCategory] = useState<string>("CLIENT");
  const [manualPartyName, setManualPartyName] = useState("");
  const [partyReference, setPartyReference] = useState("");

  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [voucherType, setVoucherType] = useState<VoucherType>("JOURNAL");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<NewLineItem[]>([
    { accountId: "", accountCode: "", accountName: "", description: "", debit: "", credit: "" },
    { accountId: "", accountCode: "", accountName: "", description: "", debit: "", credit: "" },
  ]);

  // Reversal modal
  const [reversalTarget, setReversalTarget] = useState<JournalEntry | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversing, setReversing] = useState(false);

  useEffect(() => {
    if (initialOpenNewModal) {
      setShowAddModal(true);
    }
  }, [initialOpenNewModal]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [jeData, accData, clientData] = await Promise.all([
        api<{ count: number; results: JournalEntry[] }>("/accounting/journals"),
        api<ChartOfAccount[]>("/accounting/accounts"),
        api<any>("/accounting/entities/clients").catch(() => api<any>("/clients/").catch(() => [])),
      ]);
      const parsedAccs = unpackResults<ChartOfAccount>(accData);
      setEntries(unpackResults(jeData));
      setAccounts(parsedAccs);
      const parsedClients = unpackResults(clientData);
      setClients(parsedClients);

      if (parsedAccs.length >= 2) {
        const defaultDr = parsedAccs.find((a) => a.type === "EXPENSE") || parsedAccs[0];
        const defaultCr = parsedAccs.find((a) => a.code === "1130") || parsedAccs.find((a) => a.code === "1110") || parsedAccs[1];
        setLines((prev) => {
          if (prev[0].accountId) return prev;
          return [
            {
              accountId: defaultDr._id,
              accountCode: defaultDr.code,
              accountName: defaultDr.name,
              description: "",
              debit: "",
              credit: "",
            },
            {
              accountId: defaultCr._id,
              accountCode: defaultCr.code,
              accountName: defaultCr.name,
              description: "",
              debit: "",
              credit: "",
            },
          ];
        });
      }
    } catch (err: any) {
      console.error("Failed to load journals or accounts:", err);
      toast.error(err.message || "Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalDebit = useMemo(() => {
    return lines.reduce((acc, row) => acc + (parseFloat(String(row.debit)) || 0), 0);
  }, [lines]);

  const totalCredit = useMemo(() => {
    return lines.reduce((acc, row) => acc + (parseFloat(String(row.credit)) || 0), 0);
  }, [lines]);

  const discrepancy = Math.abs(totalDebit - totalCredit);
  const isBalanced = discrepancy < 0.01 && totalDebit > 0;

  const handleAccountSelect = (index: number, accId: string) => {
    const selected = accounts.find((a) => a._id === accId);
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        accountId: accId,
        accountCode: selected?.code || "",
        accountName: selected?.name || "",
      };
      return copy;
    });
  };

  const handleDebitChange = (index: number, val: string) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        debit: val,
        credit: val && parseFloat(val) > 0 ? "" : copy[index].credit,
      };
      return copy;
    });
  };

  const handleCreditChange = (index: number, val: string) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        credit: val,
        debit: val && parseFloat(val) > 0 ? "" : copy[index].debit,
      };
      return copy;
    });
  };

  const addRow = () => {
    setLines((prev) => [
      ...prev,
      { accountId: "", accountCode: "", accountName: "", description: "", debit: "", credit: "" },
    ]);
  };

  const removeRow = (index: number) => {
    if (lines.length <= 2) {
      toast.warning("A double-entry journal requires at least 2 line items");
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Voucher description/narration is required");
      return;
    }
    if (!isBalanced) {
      toast.error(`Double-entry unbalanced: Discrepancy is ${formatCurrency(discrepancy)}`);
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const row = lines[i];
      if (!row.accountId) {
        toast.error(`Line #${i + 1} has no account selected`);
        return;
      }
      const dr = parseFloat(String(row.debit)) || 0;
      const cr = parseFloat(String(row.credit)) || 0;
      if (dr <= 0 && cr <= 0) {
        toast.error(`Line #${i + 1} must have a valid Debit or Credit amount`);
        return;
      }
    }

    if (partyMode === "MANUAL" && !manualPartyName.trim()) {
      toast.error("Please provide the manual party / counterparty name");
      return;
    }

    setSubmitting(true);
    try {
      const resolvedPartyName =
        partyMode === "CLIENT"
          ? selectedClientName
          : partyMode === "MANUAL"
          ? manualPartyName.trim()
          : undefined;

      const resolvedPartyType =
        partyMode === "CLIENT"
          ? "CLIENT"
          : partyMode === "MANUAL"
          ? (partyCategory as any)
          : undefined;

      const resolvedPartyRef = partyReference.trim() || reference.trim() || undefined;

      const payload = {
        date,
        voucherType,
        description,
        referenceNumber: reference.trim() || undefined,
        client: partyMode === "CLIENT" && selectedClientId ? selectedClientId : undefined,
        clientName: resolvedPartyName,
        clientReference: resolvedPartyRef,
        postImmediately: true,
        lines: lines.map((row) => ({
          account: row.accountId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          description: row.description || description,
          debit: parseFloat(String(row.debit)) || 0,
          credit: parseFloat(String(row.credit)) || 0,
          partyType: resolvedPartyType,
          partyName: resolvedPartyName,
          partyReference: resolvedPartyRef,
        })),
      };

      await api("/accounting/journals", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Journal Voucher posted successfully to General Ledger");
      setShowAddModal(false);
      onModalClose?.();
      setDescription("");
      setReference("");
      setPartyMode("NONE");
      setSelectedClientId("");
      setSelectedClientName("");
      setManualPartyName("");
      setPartyReference("");
      setLines([
        { accountId: "", accountCode: "", accountName: "", description: "", debit: "", credit: "" },
        { accountId: "", accountCode: "", accountName: "", description: "", debit: "", credit: "" },
      ]);
      fetchData();
    } catch (err: any) {
      console.error("Failed to post journal entry:", err);
      toast.error(err.message || "Failed to post journal entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseJournal = async () => {
    if (!reversalTarget) return;
    if (!reversalReason.trim()) {
      toast.error("Please provide a reason for reversing this journal voucher");
      return;
    }

    setReversing(true);
    try {
      await api(`/accounting/journals/${reversalTarget._id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: reversalReason }),
      });
      toast.success(`Journal ${reversalTarget.journalNumber} reversed successfully`);
      setReversalTarget(null);
      setReversalReason("");
      fetchData();
    } catch (err: any) {
      console.error("Failed to reverse journal entry:", err);
      toast.error(err.message || "Failed to reverse journal entry");
    } finally {
      setReversing(false);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesType = typeFilter === "ALL" || e.voucherType === typeFilter;
      const matchesStatus = statusFilter === "ALL" || e.status === statusFilter;
      const matchesParty =
        partyFilter === "ALL" ||
        (e.client && ((e.client as any)._id === partyFilter || (e.client as any).id === partyFilter)) ||
        (e.clientName && e.clientName === partyFilter);

      const entryDate = e.date ? e.date.slice(0, 10) : "";
      const matchesFrom = !startDate || entryDate >= startDate;
      const matchesTo = !endDate || entryDate <= endDate;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        e.journalNumber.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.referenceNumber && e.referenceNumber.toLowerCase().includes(q)) ||
        (e.clientName && e.clientName.toLowerCase().includes(q)) ||
        (e.clientReference && e.clientReference.toLowerCase().includes(q)) ||
        (e.lines &&
          e.lines.some(
            (l) =>
              (l.partyName && l.partyName.toLowerCase().includes(q)) ||
              (l.partyReference && l.partyReference.toLowerCase().includes(q))
          ));
      return matchesType && matchesStatus && matchesParty && matchesFrom && matchesTo && matchesSearch;
    });
  }, [entries, typeFilter, statusFilter, partyFilter, startDate, endDate, searchQuery]);

  const handleExportJournalsCsv = () => {
    const headers = [
      "Voucher #",
      "Posting Date",
      "Voucher Type",
      "Party / Client",
      "Client Type",
      "Reference #",
      "Narration / Description",
      "Total Debit (INR)",
      "Total Credit (INR)",
      "Status",
    ];
    const rows = filteredEntries.map((je) => [
      je.journalNumber,
      formatDate(je.date),
      je.voucherType,
      je.clientName || "",
      je.client ? "ERP" : je.clientName ? "Manual" : "",
      je.clientReference || je.referenceNumber || "",
      je.description,
      je.totalDebit || 0,
      je.totalCredit || 0,
      je.status,
    ]);
    exportToCsv("general_ledger_journals_report", headers, rows);
    toast.success(`Exported ${rows.length} journal vouchers to CSV`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Controls Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "var(--surface-panel, #ffffff)",
          border: "1px solid var(--border-light, #e2e8f0)",
          borderRadius: "12px",
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
          <div style={{ position: "relative", minWidth: "220px" }}>
            <Search
              size={15}
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search voucher #, narration..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "34px", fontSize: "13px" }}
            />
          </div>

          <select
            className="input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ width: "160px", fontSize: "13px" }}
          >
            <option value="ALL">All Voucher Types</option>
            <option value="JOURNAL">Manual Journal</option>
            <option value="SALES">Sales Invoice</option>
            <option value="RECEIPT">Customer Receipt</option>
            <option value="PURCHASE">Purchase Bill</option>
            <option value="PAYMENT">Vendor Payment</option>
            <option value="PAYROLL">Payroll</option>
            <option value="DEPRECIATION">Depreciation</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>

          <select
            className="input"
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            style={{ width: "170px", fontSize: "13px" }}
          >
            <option value="ALL">All Parties</option>
            {clients.map((c: any) => (
              <option key={c._id || c.id} value={c._id || c.id}>
                {c.companyName || c.name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "130px", fontSize: "13px" }}
          >
            <option value="ALL">All Statuses</option>
            <option value="POSTED">Posted</option>
            <option value="REVERSED">Reversed</option>
            <option value="DRAFT">Draft</option>
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>From:</span>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ fontSize: "12px", padding: "6px 8px", width: "135px" }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>To:</span>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ fontSize: "12px", padding: "6px 8px", width: "135px" }}
            />
            {(startDate || endDate || partyFilter !== "ALL" || typeFilter !== "ALL" || statusFilter !== "ALL" || searchQuery) && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setPartyFilter("ALL");
                  setTypeFilter("ALL");
                  setStatusFilter("ALL");
                  setSearchQuery("");
                }}
                style={{ fontSize: "11.5px", padding: "4px 8px" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportJournalsCsv}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} /> New Journal Voucher
          </button>
        </div>
      </div>

      {/* Journal Table */}
      <div
        style={{
          background: "var(--surface-panel, #ffffff)",
          border: "1px solid var(--border-light, #e2e8f0)",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: "13px" }}>
            <thead>
              <tr
                style={{
                  background: "var(--surface-subtle, #f8fafc)",
                  borderBottom: "1px solid var(--border-light, #e2e8f0)",
                  textAlign: "left",
                  color: "var(--text-secondary, #64748b)",
                }}
              >
                <th style={{ padding: "12px 16px", width: "40px" }}></th>
                <th style={{ padding: "12px 16px" }}>Voucher #</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Voucher Type</th>
                <th style={{ padding: "12px 16px" }}>Party / Reference</th>
                <th style={{ padding: "12px 16px" }}>Narration / Description</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Debit</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Credit</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                    <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
                    Loading Journal Vouchers...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                    No journal vouchers found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((je) => {
                  const isExpanded = expandedId === je._id;
                  const statusStyle = STATUS_COLORS[je.status] || { bg: "#f1f5f9", text: "#475569" };

                  return (
                    <React.Fragment key={je._id}>
                      <tr
                        style={{
                          borderBottom: "1px solid var(--border-light, #e2e8f0)",
                          transition: "background-color 0.1s ease",
                          cursor: "pointer",
                        }}
                        className="hover:bg-slate-50"
                        onClick={() => setExpandedId(isExpanded ? null : je._id)}
                      >
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--brand-primary, #3b82f6)" }}>
                          {je.journalNumber}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                          {formatDate(je.date)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "var(--surface-subtle, #f8fafc)",
                              border: "1px solid var(--border-light, #e2e8f0)",
                              color: "var(--text-secondary, #64748b)",
                            }}
                          >
                            {je.voucherType}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {je.clientName ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                                  {je.clientName}
                                </span>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    background: je.client ? "#ecfdf5" : "#fef3c7",
                                    color: je.client ? "#065f46" : "#92400e",
                                    padding: "1px 5px",
                                    borderRadius: "4px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {je.client ? "ERP" : "Manual"}
                                </span>
                              </div>
                              {(je.clientReference || je.referenceNumber) && (
                                <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: 500, fontFamily: "monospace" }}>
                                  Ref: {je.clientReference || je.referenceNumber}
                                </span>
                              )}
                            </div>
                          ) : je.referenceNumber ? (
                            <span style={{ fontSize: "11.5px", color: "#64748b", fontFamily: "monospace" }}>
                              Ref: {je.referenceNumber}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {je.description}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                          {formatCurrency(je.totalDebit || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                          {formatCurrency(je.totalCredit || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: "12px",
                              background: statusStyle.bg,
                              color: statusStyle.text,
                            }}
                          >
                            {je.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          {je.status === "POSTED" && !je.isReversed && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => setReversalTarget(je)}
                              title="Reverse this journal entry"
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#dc2626" }}
                            >
                              <RotateCcw size={12} /> Reverse
                            </button>
                          )}
                          {je.isReversed && (
                            <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>
                              Reversed
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Sub-Table for Lines */}
                      {isExpanded && (
                        <tr style={{ background: "rgba(248, 250, 252, 0.7)" }}>
                          <td colSpan={10} style={{ padding: "16px 24px" }}>
                            <div style={{ background: "#ffffff", border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                              <div style={{ padding: "10px 16px", background: "#f1f5f9", fontWeight: 600, fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                                Voucher Line Breakdown & Account Allocations
                              </div>
                              <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                                    <th style={{ padding: "8px 16px" }}>Account</th>
                                    <th style={{ padding: "8px 16px" }}>Line Description / Party Attribution</th>
                                    <th style={{ padding: "8px 16px", textAlign: "right" }}>Debit (Dr)</th>
                                    <th style={{ padding: "8px 16px", textAlign: "right" }}>Credit (Cr)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {je.lines?.map((ln, idx) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "8px 16px", fontWeight: 600 }}>
                                        <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "8px" }}>
                                          {ln.accountCode}
                                        </span>
                                        {ln.accountName}
                                      </td>
                                      <td style={{ padding: "8px 16px", color: "#64748b" }}>
                                        <div>{ln.description || "-"}</div>
                                        {ln.partyName && (
                                          <div style={{ fontSize: "10.5px", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                                            <span style={{ padding: "1px 6px", borderRadius: "4px", background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>
                                              {ln.partyType || "PARTY"}: {ln.partyName}
                                            </span>
                                            {ln.partyReference && (
                                              <span style={{ fontFamily: "monospace", color: "#64748b" }}>
                                                (Ref: {ln.partyReference})
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: "8px 16px", textAlign: "right", fontWeight: ln.debit > 0 ? 700 : 400, color: ln.debit > 0 ? "#0f172a" : "#94a3b8" }}>
                                        {ln.debit > 0 ? formatCurrency(ln.debit) : "-"}
                                      </td>
                                      <td style={{ padding: "8px 16px", textAlign: "right", fontWeight: ln.credit > 0 ? 700 : 400, color: ln.credit > 0 ? "#0f172a" : "#94a3b8" }}>
                                        {ln.credit > 0 ? formatCurrency(ln.credit) : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
                                    <td colSpan={2} style={{ padding: "10px 16px", textAlign: "right" }}>
                                      TOTALS:
                                    </td>
                                    <td style={{ padding: "10px 16px", textAlign: "right", color: "#0f172a" }}>
                                      {formatCurrency(je.totalDebit || 0)}
                                    </td>
                                    <td style={{ padding: "10px 16px", textAlign: "right", color: "#0f172a" }}>
                                      {formatCurrency(je.totalCredit || 0)}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Journal Entry Modal */}
      {showAddModal && (
        <Modal
          title="New General Ledger Journal Voucher"
          eyebrow="BALANCED DOUBLE-ENTRY POSTING"
          size="xl"
          onClose={() => {
            setShowAddModal(false);
            onModalClose?.();
          }}
        >
          <form onSubmit={handleCreateJournal} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Posting Date *
                </label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Voucher Type *
                </label>
                <select
                  className="input"
                  value={voucherType}
                  onChange={(e) => setVoucherType(e.target.value as VoucherType)}
                >
                  <option value="JOURNAL">Manual Journal</option>
                  <option value="ADJUSTMENT">Month-End Adjustment</option>
                  <option value="DEPRECIATION">Asset Depreciation</option>
                </select>
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Reference # (Doc / Voucher ref)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. REF-2026-042"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>

            {/* Party Attribution & Cross-Reference Section */}
            <div
              style={{
                padding: "12px 14px",
                background: "var(--surface-subtle, #f8fafc)",
                border: "1px solid var(--border-light, #e2e8f0)",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary, #0f172a)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Party Attribution & Cross-Reference (Optional)
                </span>
                <div style={{ display: "inline-flex", background: "#e2e8f0", padding: "2px", borderRadius: "6px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPartyMode("NONE");
                      setSelectedClientId("");
                      setSelectedClientName("");
                      setManualPartyName("");
                      setPartyReference("");
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      background: partyMode === "NONE" ? "#ffffff" : "transparent",
                      color: partyMode === "NONE" ? "#0f172a" : "#64748b",
                      boxShadow: partyMode === "NONE" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                    }}
                  >
                    General / None
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPartyMode("CLIENT");
                      setManualPartyName("");
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      background: partyMode === "CLIENT" ? "#ffffff" : "transparent",
                      color: partyMode === "CLIENT" ? "#0f172a" : "#64748b",
                      boxShadow: partyMode === "CLIENT" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                    }}
                  >
                    🏢 ERP Client
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPartyMode("MANUAL");
                      setSelectedClientId("");
                      setSelectedClientName("");
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      background: partyMode === "MANUAL" ? "#ffffff" : "transparent",
                      color: partyMode === "MANUAL" ? "#0f172a" : "#64748b",
                      boxShadow: partyMode === "MANUAL" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                    }}
                  >
                    ✍️ Manual Party & Ref
                  </button>
                </div>
              </div>

              {partyMode === "CLIENT" && (
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Select ERP Client Directory Record
                    </label>
                    <select
                      className="input"
                      style={{ fontSize: "12px" }}
                      value={selectedClientId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        setSelectedClientId(cid);
                        const found = clients.find((c: any) => (c._id || c.id) === cid);
                        setSelectedClientName(found ? (found.companyName || found.name) : "");
                      }}
                    >
                      <option value="">-- Choose Client from ERP --</option>
                      {clients.map((c: any) => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.companyName || c.name} {c.clientCode ? `(${c.clientCode})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Client Reference / PO #
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ fontSize: "12px" }}
                      placeholder="e.g. PO-8832 or Inv Ref"
                      value={partyReference}
                      onChange={(e) => setPartyReference(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {partyMode === "MANUAL" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1.5fr", gap: "12px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Party Category
                    </label>
                    <select
                      className="input"
                      style={{ fontSize: "12px" }}
                      value={partyCategory}
                      onChange={(e) => setPartyCategory(e.target.value)}
                    >
                      <option value="CLIENT">Client / Customer</option>
                      <option value="VENDOR">Vendor / Supplier</option>
                      <option value="EMPLOYEE">Employee / Contractor</option>
                      <option value="OTHER">Other Counterparty</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Counterparty / Entity Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ fontSize: "12px" }}
                      placeholder="e.g. Global Tech Partners Ltd"
                      value={manualPartyName}
                      onChange={(e) => setManualPartyName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      External Reference #
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ fontSize: "12px" }}
                      placeholder="e.g. REF-2026-99"
                      value={partyReference}
                      onChange={(e) => setPartyReference(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                Narration / Transaction Description *
              </label>
              <input
                type="text"
                className="input"
                placeholder="Explain the purpose of this double-entry posting..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Line Items Table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                  Debits & Credits (Line Allocations)
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={addRow}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Plus size={12} /> Add Line
                </button>
              </div>

              <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border-light, #e2e8f0)", textAlign: "left" }}>
                      <th style={{ padding: "8px 12px", width: "35%" }}>Account *</th>
                      <th style={{ padding: "8px 12px", width: "25%" }}>Line Description</th>
                      <th style={{ padding: "8px 12px", width: "18%", textAlign: "right" }}>Debit (Dr)</th>
                      <th style={{ padding: "8px 12px", width: "18%", textAlign: "right" }}>Credit (Cr)</th>
                      <th style={{ padding: "8px 12px", width: "4%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 8px" }}>
                          <select
                            className="input"
                            style={{ fontSize: "12px", padding: "6px 8px" }}
                            value={row.accountId}
                            onChange={(e) => handleAccountSelect(idx, e.target.value)}
                            required
                          >
                            <option value="">-- Select Ledger Account --</option>
                            {accounts.map((a) => (
                              <option key={a._id} value={a._id}>
                                {a.code} - {a.name} ({a.type})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="text"
                            className="input"
                            style={{ fontSize: "12px", padding: "6px 8px" }}
                            placeholder="Optional note"
                            value={row.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLines((prev) => {
                                const c = [...prev];
                                c[idx].description = val;
                                return c;
                              });
                            }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            style={{ fontSize: "12px", padding: "6px 8px", textAlign: "right" }}
                            placeholder="0.00"
                            value={row.debit}
                            onChange={(e) => handleDebitChange(idx, e.target.value)}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            style={{ fontSize: "12px", padding: "6px 8px", textAlign: "right" }}
                            placeholder="0.00"
                            value={row.credit}
                            onChange={(e) => handleCreditChange(idx, e.target.value)}
                          />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                            title="Remove row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Balance Checker Banner */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                padding: "12px 16px",
                borderRadius: "8px",
                background: isBalanced
                  ? "rgba(16, 185, 129, 0.08)"
                  : totalDebit === 0 && totalCredit === 0
                  ? "rgba(100, 116, 139, 0.06)"
                  : "rgba(239, 68, 68, 0.08)",
                border: `1px solid ${
                  isBalanced
                    ? "rgba(16, 185, 129, 0.3)"
                    : totalDebit === 0 && totalCredit === 0
                    ? "rgba(100, 116, 139, 0.2)"
                    : "rgba(239, 68, 68, 0.3)"
                }`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {isBalanced ? (
                  <>
                    <CheckCircle2 size={18} color="#059669" />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#059669" }}>
                      Balanced Entry: Debits = Credits
                    </span>
                  </>
                ) : totalDebit === 0 && totalCredit === 0 ? (
                  <>
                    <AlertCircle size={18} color="#64748b" />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748b" }}>
                      Enter balanced debit and credit amounts (minimum ₹0.01)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} color="#dc2626" />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>
                      Unbalanced: Discrepancy is {formatCurrency(discrepancy)}
                    </span>
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: "20px", fontSize: "13px" }}>
                <span>
                  Total Debits: <strong>{formatCurrency(totalDebit)}</strong>
                </span>
                <span>
                  Total Credits: <strong>{formatCurrency(totalCredit)}</strong>
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "12px",
                marginTop: "24px",
                paddingTop: "16px",
                borderTop: "1px solid var(--border, #DCE3E0)",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minWidth: "110px", height: "42px", fontSize: "13.5px" }}
                onClick={() => {
                  setShowAddModal(false);
                  onModalClose?.();
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ minWidth: "180px", height: "42px", fontSize: "13.5px" }}
                disabled={submitting || !isBalanced}
              >
                {submitting ? "Posting Voucher..." : "Post to General Ledger"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <Modal
          title={`Reverse Journal Entry ${reversalTarget.journalNumber}`}
          eyebrow="AUDIT TRAIL COMPLIANT REVERSAL"
          size="md"
          onClose={() => setReversalTarget(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0 0 0" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary, #64748b)", lineHeight: 1.5 }}>
              In accordance with double-entry accounting standards, posted journals cannot be deleted.
              Reversing will create an exact countervailing journal voucher that clears this transaction’s
              effect on account balances while preserving an audit trail.
            </p>

            <div>
              <label className="label">
                Reason for Reversal *
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="Specify why this entry is being reversed (e.g. duplicate billing, calculation error)..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                required
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "12px",
                marginTop: "24px",
                paddingTop: "16px",
                borderTop: "1px solid var(--border, #DCE3E0)",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minWidth: "110px", height: "42px", fontSize: "13.5px" }}
                onClick={() => setReversalTarget(null)}
                disabled={reversing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ minWidth: "160px", height: "42px", fontSize: "13.5px" }}
                onClick={handleReverseJournal}
                disabled={reversing || !reversalReason.trim()}
              >
                {reversing ? "Processing Reversal..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
