"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  BookOpen,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { Modal } from "@/features/common/Modal";
import type { ChartOfAccount, AccountType, AccountSubtype, BalanceNature } from "@/lib/types";
import {
  formatCurrency,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_COLORS,
  unpackResults,
  exportToCsv,
} from "./accountingUtils";

interface Props {
  onSelectAccountForLedger?: (accountCode: string) => void;
}

const ACCOUNT_SUBTYPES: Record<AccountType, string[]> = {
  ASSET: [
    "CASH",
    "BANK",
    "ACCOUNTS_RECEIVABLE",
    "CURRENT_ASSET",
    "PREPAID_EXPENSE",
    "FIXED_ASSET",
    "ACCUMULATED_DEPRECIATION",
    "NON_CURRENT_ASSET",
  ],
  LIABILITY: [
    "ACCOUNTS_PAYABLE",
    "CURRENT_LIABILITY",
    "PAYROLL_PAYABLE",
    "TAX_PAYABLE",
    "NON_CURRENT_LIABILITY",
    "LOAN",
  ],
  EQUITY: [
    "EQUITY",
    "RETAINED_EARNINGS",
    "CAPITAL",
  ],
  REVENUE: [
    "DIRECT_REVENUE",
    "INDIRECT_REVENUE",
    "SERVICE_REVENUE",
    "OTHER_INCOME",
  ],
  EXPENSE: [
    "DIRECT_EXPENSE",
    "OPERATING_EXPENSE",
    "EMPLOYEE_EXPENSE",
    "OFFICE_EXPENSE",
    "TECH_EXPENSE",
    "SALES_EXPENSE",
    "DEPRECIATION_EXPENSE",
    "FINANCE_EXPENSE",
  ],
};

export function ChartOfAccountsView({ onSelectAccountForLedger }: Props) {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "ASSET" as AccountType,
    subtype: "CURRENT_ASSET" as AccountSubtype,
    nature: "DEBIT" as BalanceNature,
    parentAccount: "",
    description: "",
    openingBalance: 0,
  });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await api<any>("/accounting/accounts");
      setAccounts(unpackResults<ChartOfAccount>(data));
    } catch (err: any) {
      console.error("Failed to load Chart of Accounts:", err);
      toast.error(err.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleTypeChange = (newType: AccountType) => {
    const defaultNature: BalanceNature =
      newType === "ASSET" || newType === "EXPENSE" ? "DEBIT" : "CREDIT";
    const defaultSubtype = (ACCOUNT_SUBTYPES[newType]?.[0] || "CURRENT_ASSET") as AccountSubtype;
    setFormData((prev) => ({
      ...prev,
      type: newType,
      nature: defaultNature,
      subtype: defaultSubtype,
    }));
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Account Code and Name are required");
      return;
    }

    setSubmitting(true);
    try {
      await api("/accounting/accounts", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          parentAccount: formData.parentAccount || undefined,
          openingBalance: Number(formData.openingBalance) || 0,
        }),
      });
      toast.success(`Account ${formData.code} - ${formData.name} created successfully`);
      setShowAddModal(false);
      setFormData({
        code: "",
        name: "",
        type: "ASSET",
        subtype: "CURRENT_ASSET",
        nature: "DEBIT",
        parentAccount: "",
        description: "",
        openingBalance: 0,
      });
      fetchAccounts();
    } catch (err: any) {
      console.error("Failed to create account:", err);
      toast.error(err.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchesType = typeFilter === "ALL" || acc.type === typeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.code.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q) ||
        (acc.subtype && acc.subtype.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [accounts, typeFilter, searchQuery]);

  const handleExportAccountsCsv = () => {
    const headers = [
      "Account Code",
      "Account Name",
      "Type",
      "Subtype",
      "Normal Balance",
      "Opening Balance (INR)",
      "Current Balance (INR)",
      "Status",
      "System Account",
    ];
    const rows = filteredAccounts.map((acc) => [
      acc.code,
      acc.name,
      acc.type,
      acc.subtype || "",
      acc.nature,
      acc.openingBalance || 0,
      acc.currentBalance || 0,
      acc.isActive ? "ACTIVE" : "INACTIVE",
      acc.isSystemAccount ? "YES" : "NO",
    ]);
    exportToCsv("chart_of_accounts", headers, rows);
    toast.success(`Exported ${rows.length} accounts to CSV`);
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
              placeholder="Search code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "34px", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {["ALL", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((t) => (
              <button
                key={t}
                type="button"
                className={`btn btn-xs ${typeFilter === t ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTypeFilter(t)}
                style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px" }}
              >
                {t === "ALL" ? "All Accounts" : ACCOUNT_TYPE_LABELS[t] || t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportAccountsCsv}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchAccounts}
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
            <Plus size={14} /> New Account
          </button>
        </div>
      </div>

      {/* Account Table */}
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
                <th style={{ padding: "12px 16px", width: "100px" }}>Code</th>
                <th style={{ padding: "12px 16px" }}>Account Name</th>
                <th style={{ padding: "12px 16px" }}>Classification</th>
                <th style={{ padding: "12px 16px" }}>Subtype</th>
                <th style={{ padding: "12px 16px" }}>Natural Balance</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Current Balance</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                    <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
                    Loading Chart of Accounts...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                    No accounts found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const typeColor = ACCOUNT_TYPE_COLORS[acc.type] || {
                    bg: "#f1f5f9",
                    text: "#475569",
                    border: "#cbd5e1",
                  };
                  return (
                    <tr
                      key={acc._id}
                      style={{
                        borderBottom: "1px solid var(--border-light, #e2e8f0)",
                      }}
                      className="hover:bg-slate-50"
                    >
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--brand-primary, #3b82f6)" }}>
                        {acc.code}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                        {acc.name}
                        {acc.description && (
                          <div style={{ fontSize: "11px", fontWeight: 400, color: "var(--text-secondary, #64748b)" }}>
                            {acc.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "12px",
                            background: typeColor.bg,
                            color: typeColor.text,
                            border: `1px solid ${typeColor.border}`,
                          }}
                        >
                          {acc.type}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                        {acc.subtype?.replace(/_/g, " ")}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600 }}>
                        <span style={{ color: acc.nature === "DEBIT" ? "#2563eb" : "#9333ea" }}>
                          {acc.nature}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontSize: "13px" }}>
                        <span style={{ color: (acc.currentBalance || 0) < 0 ? "#dc2626" : "var(--text-primary, #0f172a)" }}>
                          {formatCurrency(acc.currentBalance || 0)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {acc.isActive ? (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: "12px" }}>
                            Active
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>Inactive</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => onSelectAccountForLedger?.(acc.code)}
                          title="View Account Ledger"
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                        >
                          <BookOpen size={12} /> Ledger
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <Modal
          title="Create New Chart of Account"
          eyebrow="DOUBLE-ENTRY LEDGER ACCOUNT"
          size="lg"
          onClose={() => setShowAddModal(false)}
        >
          <form onSubmit={handleCreateAccount} style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "8px 0 0 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
              <div>
                <label className="label">
                  Account Code *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 1170 or 5230"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.trim() })}
                  required
                />
              </div>
              <div>
                <label className="label">
                  Account Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Petty Cash Studio B"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
              <div>
                <label className="label">
                  Account Type *
                </label>
                <select
                  className="input"
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value as AccountType)}
                >
                  <option value="ASSET">Asset (1000s)</option>
                  <option value="LIABILITY">Liability (2000s)</option>
                  <option value="EQUITY">Equity (3000s)</option>
                  <option value="REVENUE">Revenue (4000s)</option>
                  <option value="EXPENSE">Expense (5000s)</option>
                </select>
              </div>

              <div>
                <label className="label">
                  Subtype *
                </label>
                <select
                  className="input"
                  value={formData.subtype}
                  onChange={(e) => setFormData({ ...formData, subtype: e.target.value as AccountSubtype })}
                >
                  {ACCOUNT_SUBTYPES[formData.type]?.map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  Natural Balance *
                </label>
                <select
                  className="input"
                  value={formData.nature}
                  onChange={(e) => setFormData({ ...formData, nature: e.target.value as BalanceNature })}
                >
                  <option value="DEBIT">Debit (Dr)</option>
                  <option value="CREDIT">Credit (Cr)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">
                Parent Account (Optional)
              </label>
              <select
                className="input"
                value={formData.parentAccount}
                onChange={(e) => setFormData({ ...formData, parentAccount: e.target.value })}
              >
                <option value="">-- No Parent (Top-level group) --</option>
                {accounts
                  .filter((a) => a.type === formData.type)
                  .map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="label">
                Description / Purpose
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="What is tracked under this account..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="label">
                Opening Balance (INR)
              </label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="0.00"
                value={formData.openingBalance === 0 ? "" : formData.openingBalance}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    openingBalance: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "12px",
                marginTop: "24px",
                paddingTop: "18px",
                borderTop: "1px solid var(--border, #DCE3E0)",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minWidth: "110px", height: "42px", fontSize: "13.5px" }}
                onClick={() => setShowAddModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ minWidth: "160px", height: "42px", fontSize: "13.5px" }}
                disabled={submitting}
              >
                {submitting ? "Creating Account..." : "Create Account"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
