"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { Modal } from "@/features/common/Modal";
import type { ExpenseTransaction, ChartOfAccount } from "@/lib/types";
import { formatCurrency, formatDate, STATUS_COLORS, unpackResults, exportToCsv } from "./accountingUtils";

interface Props {
  initialOpenModal?: boolean;
  onModalClose?: () => void;
}

export function ExpensesView({ initialOpenModal = false, onModalClose }: Props) {
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(initialOpenModal);
  const [submitting, setSubmitting] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("OFFICE_EXPENSE");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [taxAmount, setTaxAmount] = useState<number | string>("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (initialOpenModal) setShowModal(true);
  }, [initialOpenModal]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expData, accData] = await Promise.all([
        api<{ count: number; results: ExpenseTransaction[] }>("/accounting/expenses"),
        api<ChartOfAccount[]>("/accounting/accounts"),
      ]);
      setExpenses(unpackResults<ExpenseTransaction>(expData));
      const parsedAccounts = unpackResults<ChartOfAccount>(accData);
      setAccounts(parsedAccounts);

      if (parsedAccounts.length > 0) {
        const defaultBank = parsedAccounts.find((a) => a.code === "1130") || parsedAccounts.find((a) => a.code === "1110");
        if (defaultBank && !paymentAccountId) setPaymentAccountId(defaultBank._id);

        const defaultExp = parsedAccounts.find((a) => a.code === "5220") || parsedAccounts.find((a) => a.type === "EXPENSE");
        if (defaultExp && !expenseAccountId) setExpenseAccountId(defaultExp._id);
      }
    } catch (err: any) {
      console.error("Failed to load expenses:", err);
      toast.error(err.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(String(amount)) || 0;
    if (amt <= 0) {
      toast.error("Expense amount must be greater than zero");
      return;
    }
    if (!expenseAccountId || !paymentAccountId) {
      toast.error("Please select both an Expense Account and a Payment Account");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date,
        title: title.trim() || "Operational Expense",
        category,
        expenseAccount: expenseAccountId,
        paidFromAccount: paymentAccountId,
        amount: amt,
        subtotal: amt,
        taxAmount: parseFloat(String(taxAmount)) || 0,
        totalAmount: amt + (parseFloat(String(taxAmount)) || 0),
        description: description.trim(),
      };

      await api("/accounting/expenses", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Expense recorded & double-entry journal posted");
      setShowModal(false);
      onModalClose?.();
      setAmount("");
      setTaxAmount("");
      setDescription("");
      setTitle("");
      fetchData();
    } catch (err: any) {
      console.error("Failed to record expense:", err);
      toast.error(err.message || "Failed to record expense");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesCategory = categoryFilter === "ALL" || exp.category === categoryFilter;
      const expDate = exp.date ? exp.date.slice(0, 10) : "";
      const matchesFrom = !startDate || expDate >= startDate;
      const matchesTo = !endDate || expDate <= endDate;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (exp.expenseNumber && exp.expenseNumber.toLowerCase().includes(q)) ||
        (exp.title && exp.title.toLowerCase().includes(q)) ||
        (exp.description && exp.description.toLowerCase().includes(q));
      return matchesCategory && matchesFrom && matchesTo && matchesSearch;
    });
  }, [expenses, categoryFilter, startDate, endDate, searchQuery]);

  const handleExportExpensesCsv = () => {
    const headers = [
      "Expense #",
      "Date",
      "Title",
      "Category",
      "Expense Account",
      "Paid From Account",
      "Subtotal (INR)",
      "Tax Amount (INR)",
      "Total Amount (INR)",
      "Status",
    ];
    const rows = filteredExpenses.map((exp: any) => [
      exp.expenseNumber || "",
      formatDate(exp.date),
      exp.title,
      exp.category,
      (exp.expenseAccount as any)?.name || "",
      (exp.paidFromAccount as any)?.name || "",
      exp.subtotal || exp.amount || 0,
      exp.taxAmount || 0,
      exp.totalAmount || exp.amount || 0,
      exp.status || "POSTED",
    ]);
    exportToCsv("expenses_report", headers, rows);
    toast.success(`Exported ${rows.length} expenses to CSV`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Bar */}
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
          <div style={{ position: "relative", minWidth: "240px" }}>
            <Search
              size={15}
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search expense #, title, note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "34px", fontSize: "13px" }}
            />
          </div>

          <select
            className="input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: "180px", fontSize: "13px" }}
          >
            <option value="ALL">All Categories</option>
            <option value="OFFICE_EXPENSE">Office Supplies</option>
            <option value="TRAVEL">Travel & Logistics</option>
            <option value="MEALS">Meals & Entertainment</option>
            <option value="UTILITIES">Utilities & Power</option>
            <option value="TECH_EXPENSE">Software & Tech</option>
            <option value="SALES_EXPENSE">Sales & Marketing</option>
            <option value="OPERATING_EXPENSE">Operational Expense</option>
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
            {(startDate || endDate || categoryFilter !== "ALL" || searchQuery) && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setCategoryFilter("ALL");
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
            onClick={handleExportExpensesCsv}
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
            onClick={() => setShowModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} /> Record Expense
          </button>
        </div>
      </div>

      {/* Expenses Table */}
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
              <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border-light, #e2e8f0)", textAlign: "left", color: "var(--text-secondary, #64748b)" }}>
                <th style={{ padding: "12px 16px" }}>Expense #</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Title / Purpose</th>
                <th style={{ padding: "12px 16px" }}>Category</th>
                <th style={{ padding: "12px 16px" }}>Description</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Net Amount</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Tax</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Paid</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                    <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
                    Loading operational expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                    No expenses recorded. Click "Record Expense" to register operational costs.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const statusStyle = STATUS_COLORS[exp.approvalStatus] || { bg: "#f1f5f9", text: "#475569" };
                  return (
                    <tr key={exp._id} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }} className="hover:bg-slate-50">
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#d97706" }}>
                        {exp.expenseNumber}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                        {formatDate(exp.date)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                        {exp.title}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.1)", color: "#d97706" }}>
                          {exp.category?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {exp.description || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {formatCurrency(exp.subtotal || 0)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {formatCurrency(exp.taxAmount || 0)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#dc2626" }}>
                        {formatCurrency(exp.totalAmount || 0)}
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
                          {exp.approvalStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {showModal && (
        <Modal
          title="Record Direct Operational Expense"
          eyebrow="DOUBLE-ENTRY DISBURSEMENT"
          size="md"
          onClose={() => {
            setShowModal(false);
            onModalClose?.();
          }}
        >
          <form onSubmit={handleCreateExpense} style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "12px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Expense Date *
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
                  Category *
                </label>
                <select
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="OFFICE_EXPENSE">Office Supplies</option>
                  <option value="TRAVEL">Travel & Logistics</option>
                  <option value="MEALS">Meals & Entertainment</option>
                  <option value="UTILITIES">Utilities & Power</option>
                  <option value="TECH_EXPENSE">Software & Tech</option>
                  <option value="SALES_EXPENSE">Sales & Marketing</option>
                  <option value="OPERATING_EXPENSE">Operational Expense</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                Expense Title / Merchant *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Swiggy Team Lunch / Uber Client Visit"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Expense Account (Dr) *
                </label>
                <select
                  className="input"
                  value={expenseAccountId}
                  onChange={(e) => setExpenseAccountId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Expense Account --</option>
                  {accounts
                    .filter((a) => a.type === "EXPENSE")
                    .map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Paid Through Account (Cr) *
                </label>
                <select
                  className="input"
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Bank / Cash --</option>
                  {accounts
                    .filter((a) => a.type === "ASSET" || a.code === "2110")
                    .map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Amount (INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Tax / GST (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="0.00"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                Description / Purpose
              </label>
              <textarea
                className="input"
                rows={2}
                placeholder="Reason or notes regarding this expense..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border, #E2E8F0)" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: "42px", minWidth: "110px", padding: "0 20px", fontSize: "13.5px", fontWeight: 600 }}
                onClick={() => {
                  setShowModal(false);
                  onModalClose?.();
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: "42px", minWidth: "180px", padding: "0 24px", fontSize: "13.5px", fontWeight: 600 }}
                disabled={submitting}
              >
                {submitting ? "Posting..." : "Record & Post Expense"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
