"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Receipt,
  CreditCard,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import type { ExecutiveFinancialSummary, JournalEntry } from "@/lib/types";
import { formatCurrency, formatDate, STATUS_COLORS } from "./accountingUtils";

interface Props {
  onNavigateTab: (tabId: string) => void;
  onOpenNewInvoice: () => void;
  onOpenNewReceipt: () => void;
  onOpenNewBill: () => void;
  onOpenNewPayment: () => void;
  onOpenNewJournal: () => void;
}

export function AccountingDashboardView({
  onNavigateTab,
  onOpenNewInvoice,
  onOpenNewReceipt,
  onOpenNewBill,
  onOpenNewPayment,
  onOpenNewJournal,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ExecutiveFinancialSummary | null>(null);
  const [recentJournals, setRecentJournals] = useState<JournalEntry[]>([]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const [sumData, jeData] = await Promise.all([
        api<ExecutiveFinancialSummary>("/accounting/reports/dashboard-summary"),
        api<{ count: number; results: JournalEntry[] }>("/accounting/journals"),
      ]);
      setSummary(sumData);
      setRecentJournals(jeData?.results?.slice(0, 5) || []);
    } catch (err: any) {
      console.error("Failed to load accounting dashboard summary:", err);
      toast.error(err.message || "Failed to load financial dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "360px", gap: "12px" }}>
        <RefreshCw size={28} className="animate-spin" style={{ animation: "spin 1s linear infinite", color: "#3b82f6" }} />
        <p style={{ color: "var(--text-secondary, #64748b)", fontSize: "14px", fontWeight: 500 }}>
          Calculating double-entry balances & financial positions...
        </p>
      </div>
    );
  }

  const kpis = summary?.kpis;
  const arAging = summary?.arAging;
  const apAging = summary?.apAging;

  const totalCashAndBank = (kpis?.cashBalance || 0) + (kpis?.bankBalance || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Quick Action Bar */}
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
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
            Financial Overview & Quick Actions
          </h2>
          <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "var(--text-secondary, #64748b)" }}>
            Strict Double-Entry General Ledger System & Real-Time Balances
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchSummary}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenNewJournal}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <FileSpreadsheet size={14} /> Journal Voucher
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenNewReceipt}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowDownRight size={14} color="#059669" /> Customer Receipt
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenNewPayment}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowUpRight size={14} color="#dc2626" /> Vendor Payment
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenNewInvoice}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} /> New Invoice
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Cash & Bank */}
        <div
          onClick={() => onNavigateTab("banking")}
          style={{
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderTop: "3px solid #3b82f6",
            borderRadius: "12px",
            padding: "18px 20px",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", letterSpacing: "0.05em" }}>
              Cash & Bank Balance
            </span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.1)", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={16} />
            </div>
          </div>
          <strong style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary, #0f172a)", display: "block" }}>
            {formatCurrency(totalCashAndBank)}
          </strong>
          <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-secondary, #64748b)", display: "flex", justifyContent: "space-between" }}>
            <span>Cash: {formatCurrency(kpis?.cashBalance || 0)}</span>
            <span style={{ color: "#2563eb", fontWeight: 600 }}>Reconcile &rarr;</span>
          </div>
        </div>

        {/* Accounts Receivable */}
        <div
          onClick={() => onNavigateTab("invoices")}
          style={{
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderTop: "3px solid #10b981",
            borderRadius: "12px",
            padding: "18px 20px",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", letterSpacing: "0.05em" }}>
              Accounts Receivable (A/R)
            </span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Receipt size={16} />
            </div>
          </div>
          <strong style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary, #0f172a)", display: "block" }}>
            {formatCurrency(kpis?.accountsReceivable || 0)}
          </strong>
          <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-secondary, #64748b)", display: "flex", justifyContent: "space-between" }}>
            <span>90+ Overdue: {formatCurrency(arAging?.days90Plus || 0)}</span>
            <span style={{ color: "#059669", fontWeight: 600 }}>Invoices &rarr;</span>
          </div>
        </div>

        {/* Accounts Payable */}
        <div
          onClick={() => onNavigateTab("bills")}
          style={{
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderTop: "3px solid #ef4444",
            borderRadius: "12px",
            padding: "18px 20px",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", letterSpacing: "0.05em" }}>
              Accounts Payable (A/P)
            </span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={16} />
            </div>
          </div>
          <strong style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary, #0f172a)", display: "block" }}>
            {formatCurrency(kpis?.accountsPayable || 0)}
          </strong>
          <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-secondary, #64748b)", display: "flex", justifyContent: "space-between" }}>
            <span>90+ Overdue: {formatCurrency(apAging?.days90Plus || 0)}</span>
            <span style={{ color: "#dc2626", fontWeight: 600 }}>Bills &rarr;</span>
          </div>
        </div>

        {/* Operating Revenue */}
        <div
          onClick={() => onNavigateTab("reports")}
          style={{
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderTop: "3px solid #8b5cf6",
            borderRadius: "12px",
            padding: "18px 20px",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", letterSpacing: "0.05em" }}>
              Operating Revenue (YTD)
            </span>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(139, 92, 246, 0.1)", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <strong style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary, #0f172a)", display: "block" }}>
            {formatCurrency(kpis?.totalRevenue || 0)}
          </strong>
          <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-secondary, #64748b)", display: "flex", justifyContent: "space-between" }}>
            <span>Net Profit: {formatCurrency(kpis?.netProfit || 0)}</span>
            <span style={{ color: "#7c3aed", fontWeight: 600 }}>P&L &rarr;</span>
          </div>
        </div>
      </div>

      {/* Aging Summaries */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
        {/* A/R Aging */}
        <div
          style={{
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                A/R Aging Breakdown (Customer Invoices)
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                Outstanding payments due from clients
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => onNavigateTab("reports")}
              style={{ fontSize: "12px" }}
            >
              Full Aging Report &rarr;
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", textAlign: "center" }}>
            <div style={{ padding: "12px 8px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#059669" }}>1-30 Days</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
                {formatCurrency(arAging?.days1_30 || 0)}
              </div>
            </div>
            <div style={{ padding: "12px 8px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#2563eb" }}>31-60 Days</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
                {formatCurrency(arAging?.days31_60 || 0)}
              </div>
            </div>
            <div style={{ padding: "12px 8px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#d97706" }}>61-90 Days</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
                {formatCurrency(arAging?.days61_90 || 0)}
              </div>
            </div>
            <div style={{ padding: "12px 8px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#dc2626" }}>90+ Days</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
                {formatCurrency(arAging?.days90Plus || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* A/P Aging */}
        <div
          style={{
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                A/P Aging Breakdown (Vendor Bills)
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                Outstanding liabilities due to suppliers & service providers
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => onNavigateTab("reports")}
              style={{ fontSize: "12px" }}
            >
              Full Aging Report &rarr;
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", textAlign: "center" }}>
            <div style={{ padding: "12px 8px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#059669" }}>1-30 Days</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
                {formatCurrency(apAging?.days1_30 || 0)}
              </div>
            </div>
            <div style={{ padding: "12px 8px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#2563eb" }}>31-60 Days</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
                {formatCurrency(apAging?.days31_60 || 0)}
              </div>
            </div>
            <div style={{ padding: "12px 8px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#d97706" }}>61-90 Days</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
                {formatCurrency(apAging?.days61_90 || 0)}
              </div>
            </div>
            <div style={{ padding: "12px 8px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#dc2626" }}>90+ Days</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginTop: "4px" }}>
                {formatCurrency(apAging?.days90Plus || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Posted Journal Entries */}
      <div
        style={{
          background: "var(--surface-panel, #ffffff)",
          border: "1px solid var(--border-light, #e2e8f0)",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
              Recent General Ledger Journal Vouchers
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
              Double-entry postings generated by billing, payouts, and manual adjustments
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => onNavigateTab("journal")}
            style={{ fontSize: "12px" }}
          >
            View All Vouchers &rarr;
          </button>
        </div>

        {recentJournals.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary, #64748b)", fontSize: "13px" }}>
            No journal entries recorded yet. Create an invoice or record a manual journal voucher to start.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)", textAlign: "left", color: "var(--text-secondary, #64748b)" }}>
                  <th style={{ padding: "10px 12px" }}>Voucher #</th>
                  <th style={{ padding: "10px 12px" }}>Date</th>
                  <th style={{ padding: "10px 12px" }}>Type</th>
                  <th style={{ padding: "10px 12px" }}>Description</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Total Amount</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentJournals.map((je) => {
                  const statusStyle = STATUS_COLORS[je.status] || { bg: "#f1f5f9", text: "#475569" };
                  return (
                    <tr
                      key={je._id}
                      style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)", cursor: "pointer" }}
                      onClick={() => onNavigateTab("journal")}
                    >
                      <td style={{ padding: "12px", fontWeight: 600, color: "var(--brand-primary, #3b82f6)", fontFamily: "monospace" }}>
                        {je.journalNumber}
                      </td>
                      <td style={{ padding: "12px", color: "var(--text-secondary, #64748b)" }}>
                        {formatDate(je.date)}
                      </td>
                      <td style={{ padding: "12px" }}>
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
                      <td style={{ padding: "12px", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {je.description}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                        {formatCurrency(je.totalDebit || 0)}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
