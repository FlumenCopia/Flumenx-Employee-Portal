"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  RefreshCw,
  Download,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import type { GeneralLedgerReport, GeneralLedgerTransaction, ChartOfAccount } from "@/lib/types";
import { formatCurrency, formatDate, unpackResults, exportToCsv } from "./accountingUtils";

interface Props {
  initialAccountCode?: string;
}

export function GeneralLedgerView({ initialAccountCode }: Props) {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [ledgerReport, setLedgerReport] = useState<GeneralLedgerReport | null>(null);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await api<any>("/accounting/accounts");
        const parsed = unpackResults<ChartOfAccount>(data);
        if (parsed.length > 0) {
          setAccounts(parsed);
          if (initialAccountCode) {
            const found = parsed.find((a) => a.code === initialAccountCode);
            if (found) setSelectedAccountId(found._id);
          } else if (!selectedAccountId) {
            const preferred = parsed.find((a) => a.code === "1130") || parsed.find((a) => a.code === "1110") || parsed[0];
            setSelectedAccountId(preferred._id);
          }
        }
      } catch (err: any) {
        console.error("Failed to load accounts for ledger:", err);
      }
    };
    loadAccounts();
  }, [initialAccountCode]);

  const fetchLedger = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const data = await api<GeneralLedgerReport>(
        `/accounting/ledger/account/${selectedAccountId}?${params.toString()}`
      );
      setLedgerReport(data);
    } catch (err: any) {
      console.error("Failed to fetch general ledger:", err);
      toast.error(err.message || "Failed to load account ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      fetchLedger();
    }
  }, [selectedAccountId, startDate, endDate]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a._id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const rawTransactions = useMemo(() => {
    return (ledgerReport?.transactions || ledgerReport?.entries || []) as GeneralLedgerTransaction[];
  }, [ledgerReport]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rawTransactions;
    return rawTransactions.filter((item: any) => {
      const num = item.journalNumber || item.entryNumber || item.referenceNumber || "";
      const desc = item.description || "";
      const party = item.partyName || item.clientName || "";
      const type = item.voucherType || item.entryType || "";
      return (
        num.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        party.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q)
      );
    });
  }, [rawTransactions, searchQuery]);

  const handleExportLedgerCsv = () => {
    if (!selectedAccount) {
      toast.warning("Please select an account first");
      return;
    }
    const headers = [
      "Posting Date",
      "Voucher / Journal #",
      "Type",
      "Narration / Description",
      "Debit (INR)",
      "Credit (INR)",
      "Running Balance (INR)",
    ];
    const rows = [
      [
        "-",
        "OPENING",
        "-",
        "Opening Balance brought forward",
        0,
        0,
        ledgerReport?.openingBalance || 0,
      ],
      ...filteredTransactions.map((item: any) => [
        formatDate(item.date),
        item.journalNumber || item.entryNumber || item.referenceNumber || "",
        item.voucherType || item.entryType || "",
        item.description || "",
        item.debit || 0,
        item.credit || 0,
        item.runningBalance || 0,
      ]),
    ];
    exportToCsv(
      `ledger_${selectedAccount.code}_${selectedAccount.name.replace(/\s+/g, "_")}`,
      headers,
      rows
    );
    toast.success(`Exported General Ledger for ${selectedAccount.code} - ${selectedAccount.name} to CSV`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Selector & Filter Bar */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", flex: 1 }}>
          <div style={{ minWidth: "260px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", display: "block", marginBottom: "4px" }}>
              Select Account
            </label>
            <select
              className="input"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={{ fontSize: "13px", fontWeight: 600 }}
            >
              <option value="">-- Choose Account --</option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.code} - {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", display: "block", marginBottom: "4px" }}>
              From Date
            </label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ fontSize: "13px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", display: "block", marginBottom: "4px" }}>
              To Date
            </label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ fontSize: "13px" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", display: "block", marginBottom: "4px" }}>
              Filter Entries
            </label>
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
              />
              <input
                type="text"
                className="input"
                placeholder="Search voucher #, desc..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: "12px", paddingLeft: "30px", width: "180px" }}
              />
            </div>
          </div>

          {(startDate || endDate || searchQuery) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setSearchQuery("");
              }}
              style={{ alignSelf: "flex-end", fontSize: "12px" }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", alignSelf: "flex-end" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportLedgerCsv}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchLedger}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Account Info & Opening Balance Summary Banner */}
      {selectedAccount && ledgerReport && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderRadius: "12px",
            padding: "18px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)" }}>
              Account Code & Name
            </span>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
              <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "8px" }}>
                {selectedAccount.code}
              </span>
              {selectedAccount.name}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)", marginTop: "2px" }}>
              {selectedAccount.type} &bull; Natural: {selectedAccount.nature}
            </div>
          </div>

          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)" }}>
              Prior Period Opening Balance
            </span>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
              {formatCurrency(ledgerReport.openingBalance || 0)}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)", marginTop: "2px" }}>
              Brought forward to period start
            </div>
          </div>

          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)" }}>
              Period Activity (Debits / Credits)
            </span>
            <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "4px" }}>
              <span style={{ color: "#2563eb" }}>Dr {formatCurrency(ledgerReport.periodDebit || 0)}</span>
              <span style={{ margin: "0 8px", color: "#cbd5e1" }}>|</span>
              <span style={{ color: "#9333ea" }}>Cr {formatCurrency(ledgerReport.periodCredit || 0)}</span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)", marginTop: "2px" }}>
              {ledgerReport.entries?.length || 0} transactions in range
            </div>
          </div>

          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)" }}>
              Closing / Current Balance
            </span>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: (ledgerReport.closingBalance || 0) < 0 ? "#dc2626" : "var(--text-primary, #0f172a)",
                marginTop: "4px",
              }}
            >
              {formatCurrency(ledgerReport.closingBalance || 0)}
            </div>
            <div style={{ fontSize: "12px", color: "#10b981", fontWeight: 600, marginTop: "2px" }}>
              As of {formatDate(ledgerReport.endDate || ledgerReport.startDate || new Date().toISOString())}
            </div>
          </div>
        </div>
      )}

      {/* General Ledger Running Balance Table */}
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
                <th style={{ padding: "12px 16px" }}>Posting Date</th>
                <th style={{ padding: "12px 16px" }}>Voucher #</th>
                <th style={{ padding: "12px 16px" }}>Type</th>
                <th style={{ padding: "12px 16px" }}>Narration / Description</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Debit (Dr)</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit (Cr)</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                    <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
                    Calculating running balance ledger...
                  </td>
                </tr>
              ) : !ledgerReport || ((ledgerReport.transactions || ledgerReport.entries || []).length === 0) ? (
                <>
                  <tr style={{ background: "rgba(248, 250, 252, 0.6)", borderBottom: "1px solid var(--border-light, #e2e8f0)" }}>
                    <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>-</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>OPENING</td>
                    <td style={{ padding: "12px 16px" }}>-</td>
                    <td style={{ padding: "12px 16px", fontStyle: "italic", color: "var(--text-secondary, #64748b)" }}>
                      Opening Balance brought forward
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>-</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>-</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }}>
                      {formatCurrency(ledgerReport?.openingBalance || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      No posted transactions in the selected date range for this account.
                    </td>
                  </tr>
                </>
              ) : (
                <>
                  <tr style={{ background: "rgba(248, 250, 252, 0.8)", borderBottom: "1px solid var(--border-light, #e2e8f0)" }}>
                    <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>-</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-secondary, #64748b)" }}>
                      OPENING
                    </td>
                    <td style={{ padding: "12px 16px" }}>-</td>
                    <td style={{ padding: "12px 16px", fontStyle: "italic", color: "var(--text-secondary, #64748b)" }}>
                      Opening Balance brought forward
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>-</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>-</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                      {formatCurrency(ledgerReport.openingBalance || 0)}
                    </td>
                  </tr>

                  {filteredTransactions.map((item: GeneralLedgerTransaction, idx: number) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }}
                      className="hover:bg-slate-50"
                    >
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                        {formatDate(item.date)}
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#3b82f6" }}>
                        {item.journalNumber || item.entryNumber}
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
                          {item.voucherType || item.entryType}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.description}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: item.debit > 0 ? 700 : 400, color: item.debit > 0 ? "#2563eb" : "#94a3b8" }}>
                        {item.debit > 0 ? formatCurrency(item.debit) : "-"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: item.credit > 0 ? 700 : 400, color: item.credit > 0 ? "#9333ea" : "#94a3b8" }}>
                        {item.credit > 0 ? formatCurrency(item.credit) : "-"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "var(--text-primary, #0f172a)" }}>
                        {formatCurrency(item.runningBalance)}
                      </td>
                    </tr>
                  ))}

                  {/* Grand Totals */}
                  <tr style={{ background: "var(--surface-subtle, #f8fafc)", fontWeight: 800 }}>
                    <td colSpan={4} style={{ padding: "14px 16px", textAlign: "right" }}>
                      PERIOD TOTALS & CLOSING BALANCE:
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "#2563eb" }}>
                      {formatCurrency(ledgerReport.periodDebit || 0)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", color: "#9333ea" }}>
                      {formatCurrency(ledgerReport.periodCredit || 0)}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontSize: "14px", color: "var(--text-primary, #0f172a)" }}>
                      {formatCurrency(ledgerReport.closingBalance || 0)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
