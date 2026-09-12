"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  Scale,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Layers,
  Download,
  Printer,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import type {
  TrialBalanceResponse,
  ProfitAndLossResponse,
  BalanceSheetResponse,
  AgingReportResponse,
} from "@/lib/types";
import { formatCurrency, formatDate, exportToCsv } from "./accountingUtils";

export function FinancialReportsView() {
  const [activeReport, setActiveReport] = useState<"TB" | "PL" | "BS" | "AGING">("TB");
  const [loading, setLoading] = useState(false);

  // Filters
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return `${year}-04-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Report Data States
  const [tbData, setTbData] = useState<TrialBalanceResponse | null>(null);
  const [plData, setPlData] = useState<ProfitAndLossResponse | null>(null);
  const [bsData, setBsData] = useState<BalanceSheetResponse | null>(null);
  const [arAging, setArAging] = useState<AgingReportResponse | null>(null);
  const [apAging, setApAging] = useState<AgingReportResponse | null>(null);

  const fetchTrialBalance = async () => {
    setLoading(true);
    try {
      const data = await api<TrialBalanceResponse>(
        `/accounting/reports/trial-balance?asOfDate=${asOfDate}`
      );
      setTbData(data);
    } catch (err: any) {
      console.error("Failed to load Trial Balance:", err);
      toast.error(err.message || "Failed to load Trial Balance");
    } finally {
      setLoading(false);
    }
  };

  const fetchProfitAndLoss = async () => {
    setLoading(true);
    try {
      const data = await api<ProfitAndLossResponse>(
        `/accounting/reports/profit-and-loss?startDate=${startDate}&endDate=${endDate}`
      );
      setPlData(data);
    } catch (err: any) {
      console.error("Failed to load P&L:", err);
      toast.error(err.message || "Failed to load Profit & Loss");
    } finally {
      setLoading(false);
    }
  };

  const fetchBalanceSheet = async () => {
    setLoading(true);
    try {
      const data = await api<BalanceSheetResponse>(
        `/accounting/reports/balance-sheet?asOfDate=${asOfDate}`
      );
      setBsData(data);
    } catch (err: any) {
      console.error("Failed to load Balance Sheet:", err);
      toast.error(err.message || "Failed to load Balance Sheet");
    } finally {
      setLoading(false);
    }
  };

  const fetchAgingReports = async () => {
    setLoading(true);
    try {
      const [ar, ap] = await Promise.all([
        api<AgingReportResponse>(`/accounting/reports/ar-aging?asOfDate=${asOfDate}`),
        api<AgingReportResponse>(`/accounting/reports/ap-aging?asOfDate=${asOfDate}`),
      ]);
      setArAging(ar);
      setApAging(ap);
    } catch (err: any) {
      console.error("Failed to load aging reports:", err);
      toast.error(err.message || "Failed to load Aging Reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeReport === "TB") fetchTrialBalance();
    if (activeReport === "PL") fetchProfitAndLoss();
    if (activeReport === "BS") fetchBalanceSheet();
    if (activeReport === "AGING") fetchAgingReports();
  }, [activeReport, asOfDate, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (activeReport === "TB") {
      if (!tbData) return;
      const headers = ["Account Code", "Account Name", "Classification", "Debit (INR)", "Credit (INR)"];
      const rows = (tbData.accounts || []).map((a) => [
        a.code,
        a.name,
        a.type,
        a.closingDebit || 0,
        a.closingCredit || 0,
      ]);
      rows.push(["TOTAL", "Grand Totals", "-", tbData.totalDebit || 0, tbData.totalCredit || 0]);
      exportToCsv(`trial_balance_${asOfDate}`, headers, rows);
      toast.success(`Exported Trial Balance to CSV`);
    } else if (activeReport === "PL") {
      if (!plData) return;
      const headers = ["Category", "Account Code", "Account Name", "Amount (INR)"];
      const rows: (string | number)[][] = [];
      (plData.revenue?.items || []).forEach((i) => rows.push(["Operating Revenue", i.accountCode, i.accountName, i.amount]));
      rows.push(["TOTAL REVENUE", "-", "Total Operating Revenue", plData.revenue?.totalRevenue || 0]);
      (plData.costOfSales?.items || []).forEach((i) => rows.push(["Cost of Sales", i.accountCode, i.accountName, i.amount]));
      rows.push(["GROSS PROFIT", "-", "Gross Margin", plData.grossProfit || 0]);
      (plData.operatingExpenses?.categories || []).forEach((cat) => {
        cat.items.forEach((i) => rows.push([`Operating Expense - ${cat.categoryName}`, i.accountCode, i.accountName, i.amount]));
      });
      rows.push(["TOTAL OPERATING EXPENSES", "-", "-", plData.operatingExpenses?.totalOperatingExpenses || 0]);
      rows.push(["NET PROFIT", "-", "Net Income Before Tax", plData.netProfit || 0]);
      exportToCsv(`profit_and_loss_${startDate}_to_${endDate}`, headers, rows);
      toast.success(`Exported Profit & Loss to CSV`);
    } else if (activeReport === "BS") {
      if (!bsData) return;
      const headers = ["Section", "Subtype", "Account Code", "Account Name", "Amount (INR)"];
      const rows: (string | number)[][] = [];
      (bsData.assets?.currentAssets?.items || []).forEach((i) => rows.push(["Assets", "Current Assets", i.accountCode, i.accountName, i.amount]));
      (bsData.assets?.nonCurrentAssets?.items || []).forEach((i) => rows.push(["Assets", "Non-Current Assets", i.accountCode, i.accountName, i.amount]));
      rows.push(["TOTAL ASSETS", "-", "-", "-", bsData.assets?.totalAssets || 0]);
      (bsData.liabilities?.currentLiabilities?.items || []).forEach((i) => rows.push(["Liabilities", "Current Liabilities", i.accountCode, i.accountName, i.amount]));
      (bsData.liabilities?.nonCurrentLiabilities?.items || []).forEach((i) => rows.push(["Liabilities", "Long-Term Liabilities", i.accountCode, i.accountName, i.amount]));
      rows.push(["TOTAL LIABILITIES", "-", "-", "-", bsData.liabilities?.totalLiabilities || 0]);
      (bsData.equity?.capitalItems || []).forEach((i) => rows.push(["Equity", "Owner Equity", i.accountCode, i.accountName, i.amount]));
      rows.push(["Current Year Net Profit", "-", "-", "-", bsData.equity?.currentYearNetProfit || 0]);
      rows.push(["TOTAL EQUITY", "-", "-", "-", bsData.equity?.totalEquity || 0]);
      exportToCsv(`balance_sheet_${asOfDate}`, headers, rows);
      toast.success(`Exported Balance Sheet to CSV`);
    } else if (activeReport === "AGING") {
      const headers = ["Ledger Type", "Document #", "Party Name", "Date", "Due Date", "Total (INR)", "Balance Due (INR)", "Days Overdue"];
      const rows: (string | number)[][] = [];
      (arAging?.items || []).forEach((item) =>
        rows.push(["Receivable (Customer)", item.number, item.name, formatDate(item.date), formatDate(item.dueDate), item.totalAmount, item.balanceDue, item.daysOverdue])
      );
      (apAging?.items || []).forEach((item) =>
        rows.push(["Payable (Vendor)", item.number, item.name, formatDate(item.date), formatDate(item.dueDate), item.totalAmount, item.balanceDue, item.daysOverdue])
      );
      exportToCsv(`aging_schedule_${asOfDate}`, headers, rows);
      toast.success(`Exported AR/AP Aging Schedule to CSV`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Report Selector & Filters */}
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
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn btn-sm ${activeReport === "TB" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveReport("TB")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Scale size={14} /> Trial Balance
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeReport === "PL" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveReport("PL")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <TrendingUp size={14} /> Profit & Loss (P&L)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeReport === "BS" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveReport("BS")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Layers size={14} /> Balance Sheet
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeReport === "AGING" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveReport("AGING")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Clock size={14} /> A/R & A/P Aging
          </button>
        </div>

        {/* Date Filter Controls based on active report */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {activeReport === "PL" ? (
            <>
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", display: "block" }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", display: "block" }}>
                  End Date
                </label>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                />
              </div>
            </>
          ) : (
            <div>
              <label style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary, #64748b)", display: "block" }}>
                As of Date
              </label>
              <input
                type="date"
                className="input"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                style={{ fontSize: "12px", padding: "4px 8px" }}
              />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "6px", alignSelf: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportCsv}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
              title="Export this report to CSV"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePrint}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
              title="Print formatted financial report"
            >
              <Printer size={14} /> Print
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (activeReport === "TB") fetchTrialBalance();
                if (activeReport === "PL") fetchProfitAndLoss();
                if (activeReport === "BS") fetchBalanceSheet();
                if (activeReport === "AGING") fetchAgingReports();
              }}
              title="Refresh report data"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Report 1: Trial Balance */}
      {activeReport === "TB" && (
        <div
          style={{
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-light, #e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--text-primary, #0f172a)" }}>
                FLUMENX TRIAL BALANCE
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                As of {formatDate(tbData?.asOfDate || asOfDate)} &bull; All Double-Entry Ledger Balances
              </p>
            </div>

            {tbData && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  background: tbData.isBalanced ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  color: tbData.isBalanced ? "#059669" : "#dc2626",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {tbData.isBalanced ? (
                  <>
                    <CheckCircle2 size={16} /> Balanced: Total Debits = Total Credits
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} /> Out of Balance by {formatCurrency(tbData.difference || 0)}
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border-light, #e2e8f0)", textAlign: "left", color: "var(--text-secondary, #64748b)" }}>
                  <th style={{ padding: "12px 20px", width: "120px" }}>Account Code</th>
                  <th style={{ padding: "12px 20px" }}>Account Name</th>
                  <th style={{ padding: "12px 20px" }}>Classification</th>
                  <th style={{ padding: "12px 20px", textAlign: "right" }}>Debit (Dr)</th>
                  <th style={{ padding: "12px 20px", textAlign: "right" }}>Credit (Cr)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "36px", color: "var(--text-secondary, #64748b)" }}>
                      <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
                      Computing trial balance from ledger...
                    </td>
                  </tr>
                ) : !tbData || tbData.accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "36px", color: "var(--text-secondary, #64748b)" }}>
                      No ledger accounts or transactions found.
                    </td>
                  </tr>
                ) : (
                  <>
                    {tbData.accounts.map((acc, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }} className="hover:bg-slate-50">
                        <td style={{ padding: "10px 20px", fontFamily: "monospace", fontWeight: 700, color: "#3b82f6" }}>
                          {acc.code}
                        </td>
                        <td style={{ padding: "10px 20px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                          {acc.name}
                        </td>
                        <td style={{ padding: "10px 20px", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                          {acc.type}
                        </td>
                        <td style={{ padding: "10px 20px", textAlign: "right", fontWeight: acc.closingDebit > 0 ? 700 : 400, color: acc.closingDebit > 0 ? "#0f172a" : "#94a3b8" }}>
                          {acc.closingDebit > 0 ? formatCurrency(acc.closingDebit) : "-"}
                        </td>
                        <td style={{ padding: "10px 20px", textAlign: "right", fontWeight: acc.closingCredit > 0 ? 700 : 400, color: acc.closingCredit > 0 ? "#0f172a" : "#94a3b8" }}>
                          {acc.closingCredit > 0 ? formatCurrency(acc.closingCredit) : "-"}
                        </td>
                      </tr>
                    ))}

                    <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderTop: "2px solid #0f172a", fontWeight: 800, fontSize: "14px" }}>
                      <td colSpan={3} style={{ padding: "14px 20px", textAlign: "right" }}>
                        GRAND TOTALS:
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "right", color: "#2563eb" }}>
                        {formatCurrency(tbData.totalDebit || 0)}
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "right", color: "#9333ea" }}>
                        {formatCurrency(tbData.totalCredit || 0)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 2: Profit & Loss */}
      {activeReport === "PL" && (
        <div
          style={{
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-light, #e2e8f0)" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--text-primary, #0f172a)" }}>
              STATEMENT OF PROFIT & LOSS (INCOME STATEMENT)
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
              For the period {formatDate(startDate)} to {formatDate(endDate)}
            </p>
          </div>

          {loading ? (
            <div style={{ padding: "36px", textAlign: "center", color: "var(--text-secondary, #64748b)" }}>
              <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
              Compiling revenue and expenditure statements...
            </div>
          ) : !plData ? (
            <div style={{ padding: "36px", textAlign: "center", color: "var(--text-secondary, #64748b)" }}>
              No financial data available for selected date range.
            </div>
          ) : (
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Revenue */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", color: "#059669", letterSpacing: "0.05em" }}>
                  Operating Revenue & Income
                </h4>
                <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                    <tbody>
                      {plData.revenue?.items?.length === 0 ? (
                        <tr>
                          <td style={{ padding: "10px 16px", color: "#94a3b8" }}>No revenue recorded in this period</td>
                          <td style={{ padding: "10px 16px", textAlign: "right" }}>-</td>
                        </tr>
                      ) : (
                        plData.revenue?.items?.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 16px" }}>
                              <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "8px" }}>{item.accountCode}</span>
                              {item.accountName}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                      <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
                        <td style={{ padding: "12px 16px" }}>TOTAL OPERATING REVENUE (A):</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: "#059669", fontSize: "14px" }}>
                          {formatCurrency(plData.revenue?.totalRevenue || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Direct Costs */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", color: "#d97706", letterSpacing: "0.05em" }}>
                  Cost of Sales & Direct Costs
                </h4>
                <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                    <tbody>
                      {plData.costOfSales?.items?.length === 0 ? (
                        <tr>
                          <td style={{ padding: "10px 16px", color: "#94a3b8" }}>No direct cost accounts allocated</td>
                          <td style={{ padding: "10px 16px", textAlign: "right" }}>-</td>
                        </tr>
                      ) : (
                        plData.costOfSales?.items?.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 16px" }}>
                              <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "8px" }}>{item.accountCode}</span>
                              {item.accountName}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                      <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
                        <td style={{ padding: "12px 16px" }}>TOTAL DIRECT COSTS (B):</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: "#d97706", fontSize: "14px" }}>
                          {formatCurrency(plData.costOfSales?.totalCostOfSales || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Gross Profit */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px",
                  background: "rgba(59, 130, 246, 0.08)",
                  borderRadius: "8px",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "#2563eb" }}>
                    GROSS PROFIT (A - B)
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)", marginTop: "2px" }}>
                    Margin: {plData.grossMarginPct?.toFixed(2) || "0.00"}%
                  </div>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#2563eb" }}>
                  {formatCurrency(plData.grossProfit || 0)}
                </div>
              </div>

              {/* Operating Expenses */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", color: "#dc2626", letterSpacing: "0.05em" }}>
                  Operating & Administrative Expenses
                </h4>
                <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                    <tbody>
                      {plData.operatingExpenses?.categories?.map((cat, cIdx) => (
                        <React.Fragment key={cIdx}>
                          {cat.items?.map((item, iIdx) => (
                            <tr key={iIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "10px 16px" }}>
                                <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "8px" }}>{item.accountCode}</span>
                                {item.accountName}
                              </td>
                              <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600 }}>
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                      <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
                        <td style={{ padding: "12px 16px" }}>TOTAL OPERATING EXPENSES (C):</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: "#dc2626", fontSize: "14px" }}>
                          {formatCurrency(plData.operatingExpenses?.totalOperatingExpenses || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Net Profit */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "20px 24px",
                  background: (plData.netProfit || 0) >= 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  borderRadius: "10px",
                  border: `2px solid ${(plData.netProfit || 0) >= 0 ? "#10b981" : "#ef4444"}`,
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 800, textTransform: "uppercase", color: (plData.netProfit || 0) >= 0 ? "#059669" : "#dc2626" }}>
                    NET PROFIT / (LOSS) FOR THE PERIOD
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary, #64748b)", marginTop: "2px" }}>
                    Net Margin: {plData.netMarginPct?.toFixed(2) || "0.00"}%
                  </div>
                </div>
                <div style={{ fontSize: "26px", fontWeight: 900, color: (plData.netProfit || 0) >= 0 ? "#059669" : "#dc2626" }}>
                  {formatCurrency(plData.netProfit || 0)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report 3: Balance Sheet */}
      {activeReport === "BS" && (
        <div
          style={{
            background: "var(--surface-panel, #ffffff)",
            border: "1px solid var(--border-light, #e2e8f0)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-light, #e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--text-primary, #0f172a)" }}>
                FLUMENX BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                As of {formatDate(bsData?.asOfDate || asOfDate)} &bull; Fundamental Equation: Assets = Liabilities + Equity
              </p>
            </div>

            {bsData && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  background: bsData.isBalanced ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  color: bsData.isBalanced ? "#059669" : "#dc2626",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {bsData.isBalanced ? (
                  <>
                    <CheckCircle2 size={16} /> Balanced: Assets = Liabilities + Equity
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} /> Out of Balance by {formatCurrency(bsData.difference || 0)}
                  </>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "36px", textAlign: "center", color: "var(--text-secondary, #64748b)" }}>
              <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
              Verifying balance sheet double-entry equality...
            </div>
          ) : !bsData ? (
            <div style={{ padding: "36px", textAlign: "center", color: "var(--text-secondary, #64748b)" }}>
              No balance sheet records available.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px", padding: "24px" }}>
              {/* ASSETS */}
              <div>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 800, textTransform: "uppercase", color: "#2563eb", letterSpacing: "0.05em" }}>
                  ASSETS
                </h4>

                {/* Current Assets */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary, #64748b)", marginBottom: "6px" }}>
                    Current Assets
                  </div>
                  <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                      <tbody>
                        {bsData.assets.currentAssets?.items?.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "6px" }}>{it.accountCode}</span>
                              {it.accountName}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>
                              {formatCurrency(it.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                          <td style={{ padding: "10px 12px" }}>Total Current Assets:</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#2563eb" }}>
                            {formatCurrency(bsData.assets.currentAssets?.subtotal || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Non-Current Assets */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary, #64748b)", marginBottom: "6px" }}>
                    Non-Current Assets (Fixed Assets)
                  </div>
                  <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                      <tbody>
                        {bsData.assets.nonCurrentAssets?.items?.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "6px" }}>{it.accountCode}</span>
                              {it.accountName}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>
                              {formatCurrency(it.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                          <td style={{ padding: "10px 12px" }}>Total Non-Current Assets:</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#2563eb" }}>
                            {formatCurrency(bsData.assets.nonCurrentAssets?.subtotal || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TOTAL ASSETS */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "rgba(59, 130, 246, 0.12)",
                    borderRadius: "8px",
                    border: "2px solid #3b82f6",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 800 }}>TOTAL ASSETS:</span>
                  <span style={{ fontSize: "18px", fontWeight: 900, color: "#2563eb" }}>
                    {formatCurrency(bsData.assets.totalAssets || 0)}
                  </span>
                </div>
              </div>

              {/* LIABILITIES & EQUITY */}
              <div>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 800, textTransform: "uppercase", color: "#dc2626", letterSpacing: "0.05em" }}>
                  LIABILITIES & EQUITY
                </h4>

                {/* Current Liabilities */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary, #64748b)", marginBottom: "6px" }}>
                    Current Liabilities & Payables
                  </div>
                  <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                      <tbody>
                        {bsData.liabilities.currentLiabilities?.items?.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "6px" }}>{it.accountCode}</span>
                              {it.accountName}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>
                              {formatCurrency(it.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                          <td style={{ padding: "10px 12px" }}>Total Liabilities:</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#dc2626" }}>
                            {formatCurrency(bsData.liabilities.totalLiabilities || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Equity */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary, #64748b)", marginBottom: "6px" }}>
                    Equity & Retained Earnings
                  </div>
                  <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                      <tbody>
                        {bsData.equity.capitalItems?.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "6px" }}>{it.accountCode}</span>
                              {it.accountName}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>
                              {formatCurrency(it.amount)}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ borderBottom: "1px solid #f1f5f9", background: "rgba(16, 185, 129, 0.05)" }}>
                          <td style={{ padding: "8px 12px", fontStyle: "italic" }}>
                            Current Year Net Profit (P&L transfer)
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: (bsData.equity.currentYearNetProfit || 0) >= 0 ? "#059669" : "#dc2626" }}>
                            {formatCurrency(bsData.equity.currentYearNetProfit || 0)}
                          </td>
                        </tr>
                        <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                          <td style={{ padding: "10px 12px" }}>Total Equity:</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#9333ea" }}>
                            {formatCurrency(bsData.equity.totalEquity || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TOTAL LIABILITIES & EQUITY */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "rgba(147, 51, 234, 0.12)",
                    borderRadius: "8px",
                    border: "2px solid #9333ea",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 800 }}>TOTAL LIABILITIES & EQUITY:</span>
                  <span style={{ fontSize: "18px", fontWeight: 900, color: "#9333ea" }}>
                    {formatCurrency(bsData.totalLiabilitiesAndEquity || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report 4: Aging */}
      {activeReport === "AGING" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* A/R Aging */}
          <div
            style={{
              background: "var(--surface-panel, #ffffff)",
              border: "1px solid var(--border-light, #e2e8f0)",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light, #e2e8f0)" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#059669" }}>
                ACCOUNTS RECEIVABLE (A/R) AGING REPORT
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                Breakdown of outstanding sales invoices by age
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border-light, #e2e8f0)", textAlign: "left", color: "var(--text-secondary, #64748b)" }}>
                    <th style={{ padding: "10px 16px" }}>Invoice / Customer</th>
                    <th style={{ padding: "10px 16px" }}>Invoice Date</th>
                    <th style={{ padding: "10px 16px" }}>Due Date</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Days Overdue</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Total Amount</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {!arAging || arAging.items?.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>
                        No outstanding accounts receivable found.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {arAging.items?.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }}>
                          <td style={{ padding: "10px 16px", fontWeight: 600 }}>
                            <span style={{ fontFamily: "monospace", color: "#3b82f6", marginRight: "8px" }}>{it.number}</span>
                            {it.name}
                          </td>
                          <td style={{ padding: "10px 16px", color: "var(--text-secondary, #64748b)" }}>{formatDate(it.date)}</td>
                          <td style={{ padding: "10px 16px", color: "var(--text-secondary, #64748b)" }}>{formatDate(it.dueDate)}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", color: it.daysOverdue > 30 ? "#dc2626" : "inherit" }}>
                            {it.daysOverdue > 0 ? `${it.daysOverdue} d` : "Current"}
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "right" }}>{formatCurrency(it.totalAmount)}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                            {formatCurrency(it.balanceDue)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
                        <td colSpan={5} style={{ padding: "12px 16px", textAlign: "right" }}>TOTAL A/R OUTSTANDING:</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: "#059669" }}>{formatCurrency(arAging.totalOutstanding)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* A/P Aging */}
          <div
            style={{
              background: "var(--surface-panel, #ffffff)",
              border: "1px solid var(--border-light, #e2e8f0)",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light, #e2e8f0)" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#dc2626" }}>
                ACCOUNTS PAYABLE (A/P) AGING REPORT
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-secondary, #64748b)" }}>
                Breakdown of outstanding vendor bills and payments due
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border-light, #e2e8f0)", textAlign: "left", color: "var(--text-secondary, #64748b)" }}>
                    <th style={{ padding: "10px 16px" }}>Bill / Vendor</th>
                    <th style={{ padding: "10px 16px" }}>Bill Date</th>
                    <th style={{ padding: "10px 16px" }}>Due Date</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Days Overdue</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Total Amount</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {!apAging || apAging.items?.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>
                        No outstanding accounts payable found.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {apAging.items?.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }}>
                          <td style={{ padding: "10px 16px", fontWeight: 600 }}>
                            <span style={{ fontFamily: "monospace", color: "#dc2626", marginRight: "8px" }}>{it.number}</span>
                            {it.name}
                          </td>
                          <td style={{ padding: "10px 16px", color: "var(--text-secondary, #64748b)" }}>{formatDate(it.date)}</td>
                          <td style={{ padding: "10px 16px", color: "var(--text-secondary, #64748b)" }}>{formatDate(it.dueDate)}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", color: it.daysOverdue > 30 ? "#dc2626" : "inherit" }}>
                            {it.daysOverdue > 0 ? `${it.daysOverdue} d` : "Current"}
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "right" }}>{formatCurrency(it.totalAmount)}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>
                            {formatCurrency(it.balanceDue)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
                        <td colSpan={5} style={{ padding: "12px 16px", textAlign: "right" }}>TOTAL A/P OUTSTANDING:</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(apAging.totalOutstanding)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
