"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Building2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Download,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { Modal } from "@/features/common/Modal";
import type { BankAccount, BankTransaction, ChartOfAccount } from "@/lib/types";
import { formatCurrency, formatDate, unpackResults, exportToCsv } from "./accountingUtils";

export function BankingView() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Add Bank Account Modal
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bName, setBName] = useState("");
  const [bAccName, setBAccName] = useState("");
  const [bAccNum, setBAccNum] = useState("");
  const [bIfsc, setBIfsc] = useState("");
  const [bBranch, setBBranch] = useState("");
  const [bGlAccountId, setBGlAccountId] = useState("");
  const [bOpeningBalance, setBOpeningBalance] = useState<number | string>(0);

  // Bank Reconciliation State
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [recSubmitting, setRecSubmitting] = useState(false);
  const [stmtDate, setStmtDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [stmtEndingBalance, setStmtEndingBalance] = useState<number | string>("");
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bankData, glData] = await Promise.all([
        api<any>("/accounting/banking/accounts"),
        api<ChartOfAccount[]>("/accounting/accounts"),
      ]);
      const parsedBanks = unpackResults<BankAccount>(bankData);
      const parsedAccounts = unpackResults<ChartOfAccount>(glData);
      setBankAccounts(parsedBanks);
      setAccounts(parsedAccounts);

      if (parsedBanks.length > 0 && !selectedBankId) {
        setSelectedBankId(parsedBanks[0]._id);
      }
    } catch (err: any) {
      console.error("Failed to load banking data:", err);
      toast.error(err.message || "Failed to load bank accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchTransactions = async () => {
    if (!selectedBankId) return;
    try {
      const txData = await api<any>(
        `/accounting/banking/transactions?bankAccountId=${selectedBankId}`
      );
      setTransactions(unpackResults<BankTransaction>(txData));
    } catch (err: any) {
      console.error("Failed to load bank transactions:", err);
    }
  };

  useEffect(() => {
    if (selectedBankId) {
      fetchTransactions();
    }
  }, [selectedBankId]);

  const selectedBank = useMemo(() => {
    return bankAccounts.find((b) => b._id === selectedBankId);
  }, [bankAccounts, selectedBankId]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return transactions;
    return transactions.filter(
      (tx) =>
        tx.description.toLowerCase().includes(q) ||
        (tx.referenceNumber && tx.referenceNumber.toLowerCase().includes(q))
    );
  }, [transactions, searchQuery]);

  const handleExportBankTransactionsCsv = () => {
    if (!selectedBank) {
      toast.warning("Select a bank account first");
      return;
    }
    const headers = [
      "Posting Date",
      "Reference #",
      "Description",
      "Deposit / Credit (INR)",
      "Withdrawal / Debit (INR)",
      "Reconciliation Status",
    ];
    const rows = filteredTransactions.map((tx) => [
      formatDate(tx.date),
      tx.referenceNumber || "",
      tx.description,
      tx.depositAmount || 0,
      tx.withdrawalAmount || 0,
      tx.reconciliationStatus,
    ]);
    exportToCsv(`bank_statement_${selectedBank.bankName.replace(/\s+/g, "_")}`, headers, rows);
    toast.success(`Exported ${rows.length} transactions to CSV`);
  };

  const handleCreateBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim() || !bAccNum.trim()) {
      toast.error("Bank name and account number are required");
      return;
    }

    setBankSubmitting(true);
    try {
      await api("/accounting/banking/accounts", {
        method: "POST",
        body: JSON.stringify({
          bankName: bName,
          accountName: bAccName || bName,
          accountNumber: bAccNum,
          ifscSwift: bIfsc,
          branchName: bBranch,
          glAccount: bGlAccountId || undefined,
          openingBalance: parseFloat(String(bOpeningBalance)) || 0,
        }),
      });

      toast.success(`Bank account ${bName} added successfully`);
      setShowAddBankModal(false);
      setBName("");
      setBAccName("");
      setBAccNum("");
      setBIfsc("");
      setBBranch("");
      fetchData();
    } catch (err: any) {
      console.error("Failed to add bank account:", err);
      toast.error(err.message || "Failed to add bank account");
    } finally {
      setBankSubmitting(false);
    }
  };

  const unreconciledTransactions = useMemo(() => {
    return transactions.filter((t) => t.reconciliationStatus !== "RECONCILED");
  }, [transactions]);

  const clearedTotal = useMemo(() => {
    let sum = 0;
    unreconciledTransactions.forEach((t) => {
      if (selectedTxIds.includes(t._id)) {
        sum += (t.depositAmount || 0) - (t.withdrawalAmount || 0);
      }
    });
    return sum;
  }, [unreconciledTransactions, selectedTxIds]);

  const calculatedBookBalance = (selectedBank?.currentBalance || 0) + clearedTotal;
  const targetStmtBal = parseFloat(String(stmtEndingBalance)) || 0;
  const reconcileDiff = Math.abs(calculatedBookBalance - targetStmtBal);
  const isReconciliationBalanced = stmtEndingBalance !== "" && reconcileDiff < 0.01;

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecuteReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stmtEndingBalance === "") {
      toast.error("Please enter your bank statement ending balance");
      return;
    }

    setRecSubmitting(true);
    try {
      await api("/accounting/banking/reconcile", {
        method: "POST",
        body: JSON.stringify({
          bankAccountId: selectedBankId,
          statementDate: stmtDate,
          statementEndingBalance: targetStmtBal,
          reconciledTransactionIds: selectedTxIds,
        }),
      });

      toast.success("Bank account reconciled successfully!");
      setShowReconcileModal(false);
      setSelectedTxIds([]);
      setStmtEndingBalance("");
      fetchData();
      fetchTransactions();
    } catch (err: any) {
      console.error("Failed to reconcile statement:", err);
      toast.error(err.message || "Failed to reconcile statement");
    } finally {
      setRecSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header & Actions */}
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
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
            Banking & Statement Reconciliation
          </h2>
          <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "var(--text-secondary, #64748b)" }}>
            Monitor real cash positions, match bank statements, and resolve discrepancies
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              fetchData();
              fetchTransactions();
            }}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowReconcileModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ShieldCheck size={14} color="#059669" /> Reconcile Statement
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddBankModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} /> Add Bank Account
          </button>
        </div>
      </div>

      {/* Bank Account Cards Carousel / Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        {bankAccounts.map((b) => {
          const isSelected = b._id === selectedBankId;
          return (
            <div
              key={b._id}
              onClick={() => setSelectedBankId(b._id)}
              style={{
                background: "var(--surface-panel, #ffffff)",
                border: isSelected ? "2px solid #3b82f6" : "1px solid var(--border-light, #e2e8f0)",
                borderRadius: "12px",
                padding: "20px",
                cursor: "pointer",
                boxShadow: isSelected ? "0 4px 12px rgba(59, 130, 246, 0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                    {b.bankName}
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)", marginTop: "2px" }}>
                    {b.accountName}
                  </div>
                </div>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.1)", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={18} />
                </div>
              </div>

              <div style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--text-secondary, #64748b)", marginBottom: "12px" }}>
                A/C: &bull;&bull;&bull;&bull; {b.accountNumber?.slice(-4) || b.accountNumber}
              </div>

              <div style={{ borderTop: "1px solid var(--border-light, #e2e8f0)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)" }}>
                    Book Balance
                  </span>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary, #0f172a)", marginTop: "2px" }}>
                    {formatCurrency(b.currentBalance || 0)}
                  </div>
                </div>
                {isSelected && (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#3b82f6", background: "rgba(59, 130, 246, 0.1)", padding: "2px 8px", borderRadius: "12px" }}>
                    Active
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transactions of Selected Bank */}
      <div
        style={{
          background: "var(--surface-panel, #ffffff)",
          border: "1px solid var(--border-light, #e2e8f0)",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light, #e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
              {selectedBank ? `${selectedBank.bankName} Transactions` : "Bank Activity"}
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
              Ledger postings & reconciled statement movements ({filteredTransactions.length} recorded)
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
              />
              <input
                type="text"
                className="input"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: "12px", paddingLeft: "30px", width: "170px" }}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportBankTransactionsCsv}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border-light, #e2e8f0)", textAlign: "left", color: "var(--text-secondary, #64748b)" }}>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Description</th>
                <th style={{ padding: "12px 16px" }}>Reference #</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Inflow / Deposit</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Outflow / Withdrawal</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                    No bank transactions recorded for this account yet. Customer receipts and vendor payments will appear here.
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                    No bank transactions found. Record receipts, payments, or manual postings to see ledger records.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const hasDeposit = (tx.depositAmount || 0) > 0;
                  const hasWithdrawal = (tx.withdrawalAmount || 0) > 0;
                  return (
                    <tr key={tx._id} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }} className="hover:bg-slate-50">
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                        {formatDate(tx.date)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--text-primary, #0f172a)" }}>
                        {tx.description}
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--text-secondary, #64748b)" }}>
                        {tx.referenceNumber || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: hasDeposit ? 700 : 400, color: hasDeposit ? "#059669" : "#94a3b8" }}>
                        {hasDeposit ? formatCurrency(tx.depositAmount) : "-"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: hasWithdrawal ? 700 : 400, color: hasWithdrawal ? "#dc2626" : "#94a3b8" }}>
                        {hasWithdrawal ? formatCurrency(tx.withdrawalAmount) : "-"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {tx.reconciliationStatus === "RECONCILED" ? (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: "12px" }}>
                            Reconciled
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
                            Unreconciled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Bank Account Modal */}
      {showAddBankModal && (
        <Modal
          title="Add New Bank Account"
          eyebrow="TREASURY & CASH MASTER"
          size="md"
          onClose={() => setShowAddBankModal(false)}
        >
          <form onSubmit={handleCreateBankAccount} style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "12px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Bank Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. HDFC Bank Ltd."
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Account Title
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Operating Current A/C"
                  value={bAccName}
                  onChange={(e) => setBAccName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Account Number *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 50200048192819"
                  value={bAccNum}
                  onChange={(e) => setBAccNum(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  IFSC / Swift
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. HDFC0000123"
                  value={bIfsc}
                  onChange={(e) => setBIfsc(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Branch
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Nariman Point, Mumbai"
                  value={bBranch}
                  onChange={(e) => setBBranch(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Opening Balance (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={bOpeningBalance}
                  onChange={(e) => setBOpeningBalance(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                Linked Chart of Account (1130 Bank)
              </label>
              <select
                className="input"
                value={bGlAccountId}
                onChange={(e) => setBGlAccountId(e.target.value)}
              >
                <option value="">Default (1130 HDFC Bank Current)</option>
                {accounts
                  .filter((a) => a.type === "ASSET")
                  .map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border, #E2E8F0)" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: "42px", minWidth: "110px", padding: "0 20px", fontSize: "13.5px", fontWeight: 600 }}
                onClick={() => setShowAddBankModal(false)}
                disabled={bankSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: "42px", minWidth: "160px", padding: "0 24px", fontSize: "13.5px", fontWeight: 600 }}
                disabled={bankSubmitting}
              >
                {bankSubmitting ? "Saving..." : "Save Bank Account"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bank Reconciliation Modal Workbench */}
      {showReconcileModal && (
        <Modal
          title={`Reconcile ${selectedBank?.bankName || "Bank Account"}`}
          eyebrow="STATEMENT MATCHING WORKBENCH"
          size="lg"
          onClose={() => setShowReconcileModal(false)}
        >
          <form onSubmit={handleExecuteReconciliation} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Statement Ending Date *
                </label>
                <input
                  type="date"
                  className="input"
                  value={stmtDate}
                  onChange={(e) => setStmtDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Bank Statement Ending Balance (INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="0.00"
                  value={stmtEndingBalance}
                  onChange={(e) => setStmtEndingBalance(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Checklist of unreconciled items */}
            <div>
              <label className="label" style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px", display: "block" }}>
                Select transactions cleared on your statement ({selectedTxIds.length} of {unreconciledTransactions.length} selected):
              </label>

              <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px" }}>
                {unreconciledTransactions.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary, #64748b)", fontSize: "13px" }}>
                    All transactions on this account are currently marked as reconciled.
                  </div>
                ) : (
                  <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px", width: "40px" }}></th>
                        <th style={{ padding: "8px 12px" }}>Date</th>
                        <th style={{ padding: "8px 12px" }}>Description</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unreconciledTransactions.map((t) => {
                        const isChecked = selectedTxIds.includes(t._id);
                        const isDep = (t.depositAmount || 0) > 0;
                        const amt = isDep ? t.depositAmount : t.withdrawalAmount;
                        return (
                          <tr
                            key={t._id}
                            onClick={() => toggleSelectTx(t._id)}
                            style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: isChecked ? "rgba(59, 130, 246, 0.05)" : "transparent" }}
                          >
                            <td style={{ padding: "8px 12px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                              />
                            </td>
                            <td style={{ padding: "8px 12px", color: "#64748b" }}>
                              {formatDate(t.date)}
                            </td>
                            <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                              {t.description}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: isDep ? "#059669" : "#dc2626" }}>
                              {isDep ? `+${formatCurrency(amt)}` : `-${formatCurrency(amt)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Reconciliation Comparison Summary */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                padding: "12px 16px",
                borderRadius: "8px",
                background: isReconciliationBalanced ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
                border: `1px solid ${isReconciliationBalanced ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
              }}
            >
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                  Difference
                </div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: isReconciliationBalanced ? "#059669" : "#d97706", marginTop: "2px" }}>
                  {formatCurrency(reconcileDiff)}
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "#64748b" }}>Cleared Items: </span>
                  <strong>{formatCurrency(clearedTotal)}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Statement Ending: </span>
                  <strong>{formatCurrency(targetStmtBal)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border, #E2E8F0)" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: "42px", minWidth: "110px", padding: "0 20px", fontSize: "13.5px", fontWeight: 600 }}
                onClick={() => setShowReconcileModal(false)}
                disabled={recSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: "42px", minWidth: "190px", padding: "0 24px", fontSize: "13.5px", fontWeight: 600 }}
                disabled={recSubmitting || selectedTxIds.length === 0}
              >
                {recSubmitting ? "Finalizing..." : "Complete Reconciliation"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
