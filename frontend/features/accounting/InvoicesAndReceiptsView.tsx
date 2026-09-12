"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  FileText,
  Receipt,
  Download,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { Modal } from "@/features/common/Modal";
import type {
  AccountingInvoice,
  CustomerReceipt,
  Client,
  ChartOfAccount,
  TaxRate,
} from "@/lib/types";
import { formatCurrency, formatDate, STATUS_COLORS, unpackResults, exportToCsv } from "./accountingUtils";

interface Props {
  initialOpenInvoice?: boolean;
  initialOpenReceipt?: boolean;
  onModalClose?: () => void;
}

interface NewInvoiceLine {
  description: string;
  accountId: string;
  quantity: number | string;
  unitPrice: number | string;
  taxRateId: string;
  taxRatePercent: number;
}

export function InvoicesAndReceiptsView({
  initialOpenInvoice = false,
  initialOpenReceipt = false,
  onModalClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<"INVOICES" | "RECEIPTS">("INVOICES");
  const [invoices, setInvoices] = useState<AccountingInvoice[]>([]);
  const [receipts, setReceipts] = useState<CustomerReceipt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Invoice Modal & Client Configuration
  const [showInvoiceModal, setShowInvoiceModal] = useState(initialOpenInvoice);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invClientMode, setInvClientMode] = useState<"ERP" | "MANUAL">("ERP");
  const [invClientId, setInvClientId] = useState("");
  const [invClientName, setInvClientName] = useState("");
  const [invClientRef, setInvClientRef] = useState("");
  const [invClientEmail, setInvClientEmail] = useState("");
  const [invClientPhone, setInvClientPhone] = useState("");
  const [invClientAddress, setInvClientAddress] = useState("");
  const [invClientGstin, setInvClientGstin] = useState("");
  const [invProjectId, setInvProjectId] = useState("");
  const [projects, setProjects] = useState<any[]>([]);

  const [invDate, setInvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invDueDate, setInvDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [invNotes, setInvNotes] = useState("");
  const [invLines, setInvLines] = useState<NewInvoiceLine[]>([
    { description: "", accountId: "", quantity: 1, unitPrice: "", taxRateId: "", taxRatePercent: 0 },
  ]);

  // Receipt Modal & Client Configuration
  const [showReceiptModal, setShowReceiptModal] = useState(initialOpenReceipt);
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);
  const [recClientMode, setRecClientMode] = useState<"ERP" | "MANUAL">("ERP");
  const [recClientId, setRecClientId] = useState("");
  const [recClientName, setRecClientName] = useState("");
  const [recClientRef, setRecClientRef] = useState("");
  const [recDate, setRecDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recPaymentMode, setRecPaymentMode] = useState("BANK_TRANSFER");
  const [recDepositAccountId, setRecDepositAccountId] = useState("");
  const [recAmount, setRecAmount] = useState<number | string>("");
  const [recReference, setRecReference] = useState("");
  const [recNotes, setRecNotes] = useState("");

  useEffect(() => {
    if (initialOpenInvoice) setShowInvoiceModal(true);
    if (initialOpenReceipt) setShowReceiptModal(true);
  }, [initialOpenInvoice, initialOpenReceipt]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invData, recData, clientData, accData, taxData, projData] = await Promise.all([
        api<{ count: number; results: AccountingInvoice[] }>("/accounting/invoices"),
        api<{ count: number; results: CustomerReceipt[] }>("/accounting/receipts"),
        api<any>("/accounting/entities/clients").catch(() => api<any>("/clients/").catch(() => [])),
        api<ChartOfAccount[]>("/accounting/accounts"),
        api<TaxRate[]>("/accounting/entities/tax-rates").catch(() => []),
        api<any>("/accounting/entities/projects").catch(() => []),
      ]);
      setInvoices(unpackResults(invData));
      setReceipts(unpackResults(recData));
      setClients(unpackResults(clientData));
      const parsedAccounts = unpackResults<ChartOfAccount>(accData);
      setAccounts(parsedAccounts);
      setTaxRates(unpackResults(taxData));
      setProjects(unpackResults(projData));

      if (parsedAccounts.length > 0) {
        const defaultBank = parsedAccounts.find((a) => a.code === "1130") || parsedAccounts.find((a) => a.code === "1110");
        if (defaultBank && !recDepositAccountId) {
          setRecDepositAccountId(defaultBank._id);
        }
      }
    } catch (err: any) {
      console.error("Failed to load invoice/receipt data:", err);
      toast.error(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const defaultRevenueAccount = useMemo(() => {
    return accounts.find((a) => a.code === "4000") || accounts.find((a) => a.type === "REVENUE");
  }, [accounts]);

  const calculatedTotals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    invLines.forEach((ln) => {
      const qty = parseFloat(String(ln.quantity)) || 0;
      const price = parseFloat(String(ln.unitPrice)) || 0;
      const lineAmt = qty * price;
      subtotal += lineAmt;
      const lineTax = (lineAmt * (ln.taxRatePercent || 0)) / 100;
      taxTotal += lineTax;
    });
    return {
      subtotal,
      taxTotal,
      total: subtotal + taxTotal,
    };
  }, [invLines]);

  const addInvoiceLine = () => {
    setInvLines((prev) => [
      ...prev,
      {
        description: "",
        accountId: defaultRevenueAccount ? defaultRevenueAccount._id : "",
        quantity: 1,
        unitPrice: "",
        taxRateId: "",
        taxRatePercent: 0,
      },
    ]);
  };

  const removeInvoiceLine = (index: number) => {
    if (invLines.length <= 1) return;
    setInvLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invClientMode === "ERP" && !invClientId) {
      toast.error("Please select an ERP Client, or switch to Manual Entry");
      return;
    }
    if (invClientMode === "MANUAL" && !invClientName.trim()) {
      toast.error("Please enter a customer/client name");
      return;
    }
    if (calculatedTotals.total <= 0) {
      toast.error("Invoice total must be greater than zero");
      return;
    }

    setInvoiceSubmitting(true);
    try {
      const selectedClient = clients.find((c: any) => String(c.id || c._id) === invClientId);
      const finalClientName = invClientMode === "ERP" ? (selectedClient?.name || "Client") : invClientName.trim();
      const payload = {
        client: invClientMode === "ERP" ? invClientId : null,
        clientName: finalClientName,
        customerName: finalClientName,
        clientReference: invClientRef.trim(),
        clientEmail: invClientEmail.trim(),
        clientPhone: invClientPhone.trim(),
        clientAddress: invClientAddress.trim(),
        clientGstin: invClientGstin.trim(),
        isManualClient: invClientMode === "MANUAL",
        project: (invClientMode === "ERP" && invProjectId) ? invProjectId : null,
        invoiceDate: invDate,
        dueDate: invDueDate,
        notes: invNotes,
        lines: invLines.map((ln) => {
          const qty = parseFloat(String(ln.quantity)) || 1;
          const price = parseFloat(String(ln.unitPrice)) || 0;
          const lineTotal = qty * price;
          const taxAmt = (lineTotal * (ln.taxRatePercent || 0)) / 100;
          return {
            description: ln.description || "Service",
            account: ln.accountId || defaultRevenueAccount?._id,
            quantity: qty,
            unitRate: price,
            taxAmount: taxAmt,
            totalAmount: lineTotal + taxAmt,
          };
        }),
      };

      await api("/accounting/invoices", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Sales Invoice created & double-entry journal posted successfully");
      setShowInvoiceModal(false);
      onModalClose?.();
      setInvClientName("");
      setInvClientRef("");
      setInvClientEmail("");
      setInvClientPhone("");
      setInvClientAddress("");
      setInvClientGstin("");
      setInvProjectId("");
      setInvNotes("");
      setInvLines([{ description: "", accountId: "", quantity: 1, unitPrice: "", taxRateId: "", taxRatePercent: 0 }]);
      fetchData();
    } catch (err: any) {
      console.error("Failed to create invoice:", err);
      toast.error(err.message || "Failed to create invoice");
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recClientMode === "ERP" && !recClientId) {
      toast.error("Please select an ERP Client, or switch to Manual Entry");
      return;
    }
    if (recClientMode === "MANUAL" && !recClientName.trim()) {
      toast.error("Please enter a customer/client name");
      return;
    }
    const amt = parseFloat(String(recAmount)) || 0;
    if (amt <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }
    if (!recDepositAccountId) {
      toast.error("Please select a deposit bank or cash account");
      return;
    }

    setReceiptSubmitting(true);
    try {
      const selectedClient = clients.find((c: any) => String(c.id || c._id) === recClientId);
      const finalClientName = recClientMode === "ERP" ? (selectedClient?.name || "Client") : recClientName.trim();
      const finalReference = (recClientRef || recReference).trim();
      const payload = {
        client: recClientMode === "ERP" ? recClientId : null,
        clientName: finalClientName,
        customerName: finalClientName,
        clientReference: finalReference,
        referenceNumber: finalReference,
        isManualClient: recClientMode === "MANUAL",
        paymentDate: recDate,
        paymentMode: recPaymentMode,
        depositAccount: recDepositAccountId,
        totalAmount: amt,
        notes: recNotes,
        autoAllocate: true,
      };

      await api("/accounting/receipts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Customer receipt recorded & posted to General Ledger");
      setShowReceiptModal(false);
      onModalClose?.();
      setRecClientName("");
      setRecClientRef("");
      setRecAmount("");
      setRecReference("");
      setRecNotes("");
      fetchData();
    } catch (err: any) {
      console.error("Failed to record receipt:", err);
      toast.error(err.message || "Failed to record customer receipt");
    } finally {
      setReceiptSubmitting(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
      const clientName = inv.clientName || (inv.client as any)?.name || "";
      const matchesClient =
        clientFilter === "ALL" ||
        (inv.client && ((inv.client as any)._id === clientFilter || (inv.client as any).id === clientFilter)) ||
        (inv.clientName && inv.clientName === clientFilter);

      const invDate = inv.invoiceDate ? inv.invoiceDate.slice(0, 10) : "";
      const matchesFrom = !startDate || invDate >= startDate;
      const matchesTo = !endDate || invDate <= endDate;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        clientName.toLowerCase().includes(q) ||
        (inv.clientReference || "").toLowerCase().includes(q) ||
        (inv.notes || "").toLowerCase().includes(q);

      return matchesStatus && matchesClient && matchesFrom && matchesTo && matchesSearch;
    });
  }, [invoices, statusFilter, clientFilter, startDate, endDate, searchQuery]);

  const filteredReceipts = useMemo(() => {
    return receipts.filter((rec) => {
      const clientName = rec.clientName || (rec.client as any)?.name || "";
      const matchesClient =
        clientFilter === "ALL" ||
        (rec.client && ((rec.client as any)._id === clientFilter || (rec.client as any).id === clientFilter)) ||
        (rec.clientName && rec.clientName === clientFilter);

      const recDate = rec.date ? rec.date.slice(0, 10) : "";
      const matchesFrom = !startDate || recDate >= startDate;
      const matchesTo = !endDate || recDate <= endDate;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rec.receiptNumber.toLowerCase().includes(q) ||
        clientName.toLowerCase().includes(q) ||
        (rec.clientReference || "").toLowerCase().includes(q) ||
        (rec.referenceNumber || "").toLowerCase().includes(q) ||
        (rec.notes || "").toLowerCase().includes(q);

      return matchesClient && matchesFrom && matchesTo && matchesSearch;
    });
  }, [receipts, clientFilter, startDate, endDate, searchQuery]);

  const handleExportInvoicesCsv = () => {
    const headers = [
      "Invoice #",
      "Invoice Date",
      "Due Date",
      "Customer / Client",
      "Client Type",
      "Client Reference / PO",
      "Subtotal (INR)",
      "Tax Amount (INR)",
      "Total Amount (INR)",
      "Amount Paid (INR)",
      "Balance Due (INR)",
      "Status",
    ];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      formatDate(inv.invoiceDate),
      formatDate(inv.dueDate),
      inv.clientName || (inv.client as any)?.name || "Client",
      inv.isManualClient ? "Manual" : "ERP",
      inv.clientReference || "",
      inv.subtotal || 0,
      inv.taxTotal || 0,
      inv.totalAmount || 0,
      inv.amountPaid || 0,
      inv.balanceDue || 0,
      inv.status,
    ]);
    exportToCsv("sales_invoices_report", headers, rows);
    toast.success(`Exported ${rows.length} sales invoices to CSV`);
  };

  const handleExportReceiptsCsv = () => {
    const headers = [
      "Receipt #",
      "Receipt Date",
      "Customer / Client",
      "Client Type",
      "Client Reference / PO",
      "Bank / Transaction Ref",
      "Amount Received (INR)",
      "Payment Mode",
      "Deposit Account",
      "Status",
    ];
    const rows = filteredReceipts.map((rec) => [
      rec.receiptNumber,
      formatDate(rec.date),
      rec.clientName || (rec.client as any)?.name || "Client",
      rec.isManualClient ? "Manual" : "ERP",
      rec.clientReference || "",
      rec.referenceNumber || "",
      rec.totalAmount || 0,
      rec.paymentMethod,
      (rec.depositAccount as any)?.name || "Bank Account",
      rec.status,
    ]);
    exportToCsv("customer_receipts_report", headers, rows);
    toast.success(`Exported ${rows.length} customer receipts to CSV`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header & Sub-Tab Switcher */}
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
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "INVOICES" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("INVOICES")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <FileText size={14} /> Sales Invoices ({invoices.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "RECEIPTS" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("RECEIPTS")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Receipt size={14} /> Customer Receipts ({receipts.length})
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          {activeTab === "INVOICES" ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowInvoiceModal(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={14} /> Create Invoice
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowReceiptModal(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={14} /> Record Receipt
            </button>
          )}
        </div>
      </div>

      {/* Filter & Export Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          background: "var(--surface-panel, #ffffff)",
          border: "1px solid var(--border-light, #e2e8f0)",
          borderRadius: "12px",
          padding: "14px 16px",
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
              placeholder={activeTab === "INVOICES" ? "Search invoice #, client, ref..." : "Search receipt #, client, ref..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "34px", fontSize: "13px" }}
            />
          </div>

          <select
            className="input"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{ width: "180px", fontSize: "13px" }}
          >
            <option value="ALL">All Clients (ERP & Manual)</option>
            {clients.map((c: any) => (
              <option key={c._id || c.id} value={c._id || c.id}>
                {c.companyName || c.name}
              </option>
            ))}
          </select>

          {activeTab === "INVOICES" && (
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "150px", fontSize: "13px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent / Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          )}

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
            {(startDate || endDate || clientFilter !== "ALL" || (activeTab === "INVOICES" && statusFilter !== "ALL") || searchQuery) && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setClientFilter("ALL");
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

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={activeTab === "INVOICES" ? handleExportInvoicesCsv : handleExportReceiptsCsv}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Invoices View */}
      {activeTab === "INVOICES" && (
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
                  <th style={{ padding: "12px 16px" }}>Invoice #</th>
                  <th style={{ padding: "12px 16px" }}>Date</th>
                  <th style={{ padding: "12px 16px" }}>Due Date</th>
                  <th style={{ padding: "12px 16px" }}>Customer / Client</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Subtotal</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Tax</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Total</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Balance Due</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
                      Loading sales invoices...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      No sales invoices found. Click "Create Invoice" to issue a client invoice.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const statusStyle = STATUS_COLORS[inv.status] || { bg: "#f1f5f9", text: "#475569" };
                    return (
                      <tr key={inv._id} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }} className="hover:bg-slate-50">
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--brand-primary, #3b82f6)" }}>
                          {inv.invoiceNumber}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                          {formatDate(inv.invoiceDate)}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                          {formatDate(inv.dueDate)}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span>{inv.clientName || (inv.client as any)?.name || "Client"}</span>
                              {inv.isManualClient ? (
                                <span style={{ fontSize: "10.5px", background: "#fef3c7", color: "#92400e", padding: "1px 5px", borderRadius: "4px", fontWeight: 600 }}>
                                  Manual
                                </span>
                              ) : (
                                <span style={{ fontSize: "10.5px", background: "#ecfdf5", color: "#065f46", padding: "1px 5px", borderRadius: "4px", fontWeight: 600 }}>
                                  ERP
                                </span>
                              )}
                            </div>
                            {inv.clientReference && (
                              <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: 500 }}>
                                Ref: {inv.clientReference}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          {formatCurrency(inv.subtotal || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          {formatCurrency(inv.taxTotal || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                          {formatCurrency(inv.totalAmount || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: (inv.balanceDue || 0) > 0 ? "#dc2626" : "#059669" }}>
                          {formatCurrency(inv.balanceDue || 0)}
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
                            {inv.status}
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
      )}

      {/* Receipts View */}
      {activeTab === "RECEIPTS" && (
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
                  <th style={{ padding: "12px 16px" }}>Receipt #</th>
                  <th style={{ padding: "12px 16px" }}>Date</th>
                  <th style={{ padding: "12px 16px" }}>Customer / Client</th>
                  <th style={{ padding: "12px 16px" }}>Payment Mode</th>
                  <th style={{ padding: "12px 16px" }}>Reference / UTR</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount Received</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Unallocated</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
                      Loading customer receipts...
                    </td>
                  </tr>
                ) : filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      No receipts recorded yet. Click "Record Receipt" to register client payments.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((rec) => {
                    const statusStyle = STATUS_COLORS[rec.status] || { bg: "#f1f5f9", text: "#475569" };
                    return (
                      <tr key={rec._id} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }} className="hover:bg-slate-50">
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#10b981" }}>
                          {rec.receiptNumber}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                          {formatDate(rec.date)}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span>{rec.clientName || (rec.client as any)?.name || "Client"}</span>
                              {rec.isManualClient && (
                                <span style={{ fontSize: "10.5px", background: "#fef3c7", color: "#92400e", padding: "1px 5px", borderRadius: "4px", fontWeight: 600 }}>
                                  Manual
                                </span>
                              )}
                            </div>
                            {rec.clientReference && (
                              <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: 500 }}>
                                Ref: {rec.clientReference}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            {rec.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)", fontFamily: "monospace" }}>
                          {rec.referenceNumber || "-"}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                          {formatCurrency(rec.totalAmount || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: (rec.unallocatedAmount || 0) > 0 ? "#d97706" : "#64748b" }}>
                          {formatCurrency(rec.unallocatedAmount || 0)}
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
                            {rec.status}
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
      )}

      {/* Create Invoice Modal */}
      {showInvoiceModal && (
        <Modal
          title="Create New Sales Invoice"
          eyebrow="ACCOUNTS RECEIVABLE & REVENUE RECOGNITION"
          size="xl"
          onClose={() => {
            setShowInvoiceModal(false);
            onModalClose?.();
          }}
        >
          <form onSubmit={handleCreateInvoice} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
            {/* Customer Identification & Billing Source */}
            <div style={{ background: "var(--card2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)", borderRadius: "8px", padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text, #18231F)" }}>
                  Customer Identification & Source
                </span>
                <div style={{ display: "inline-flex", background: "#e2e8f0", padding: "3px", borderRadius: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setInvClientMode("ERP")}
                    style={{
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: invClientMode === "ERP" ? 700 : 500,
                      background: invClientMode === "ERP" ? "#ffffff" : "transparent",
                      color: invClientMode === "ERP" ? "var(--primary-green, #087A5B)" : "#64748b",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: invClientMode === "ERP" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    🏢 ERP Client Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvClientMode("MANUAL")}
                    style={{
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: invClientMode === "MANUAL" ? 700 : 500,
                      background: invClientMode === "MANUAL" ? "#ffffff" : "transparent",
                      color: invClientMode === "MANUAL" ? "var(--primary-green, #087A5B)" : "#64748b",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: invClientMode === "MANUAL" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    ✍️ Manual Entry / Custom Ref
                  </button>
                </div>
              </div>

              {invClientMode === "ERP" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Select ERP Client *
                    </label>
                    <select
                      className="input"
                      value={invClientId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        setInvClientId(cid);
                        const sel = clients.find((c: any) => String(c.id || c._id) === cid);
                        if (sel) {
                          setInvClientName(sel.name);
                        }
                      }}
                      required={invClientMode === "ERP"}
                    >
                      <option value="">-- Choose ERP Client --</option>
                      {clients.map((c: any) => (
                        <option key={String(c.id || c._id)} value={String(c.id || c._id)}>
                          {c.name} {c.industry ? `(${c.industry})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Client Reference / PO # (Optional)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. PO-ACME-8821"
                      value={invClientRef}
                      onChange={(e) => setInvClientRef(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Linked ERP Project (Optional)
                    </label>
                    <select
                      className="input"
                      value={invProjectId}
                      onChange={(e) => setInvProjectId(e.target.value)}
                    >
                      <option value="">-- General / None --</option>
                      {projects
                        .filter((p: any) => !invClientId || String(p.client) === invClientId)
                        .map((p: any) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Customer / Client Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Global Tech Partners Inc"
                      value={invClientName}
                      onChange={(e) => setInvClientName(e.target.value)}
                      required={invClientMode === "MANUAL"}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Client Reference / PO #
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. WO-9021 / Custom Ref"
                      value={invClientRef}
                      onChange={(e) => setInvClientRef(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Billing Email / Contact
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="billing@company.com"
                      value={invClientEmail}
                      onChange={(e) => setInvClientEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Tax ID / GSTIN
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="27AAAAA0000A1Z5"
                      value={invClientGstin}
                      onChange={(e) => setInvClientGstin(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Invoice Date *
                </label>
                <input
                  type="date"
                  className="input"
                  value={invDate}
                  onChange={(e) => setInvDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Due Date *
                </label>
                <input
                  type="date"
                  className="input"
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                  Invoice Items & Services
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={addInvoiceLine}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Plus size={12} /> Add Item
                </button>
              </div>

              <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border-light, #e2e8f0)", textAlign: "left" }}>
                      <th style={{ padding: "8px 12px", width: "30%" }}>Description *</th>
                      <th style={{ padding: "8px 12px", width: "22%" }}>Revenue Account</th>
                      <th style={{ padding: "8px 12px", width: "10%", textAlign: "right" }}>Qty</th>
                      <th style={{ padding: "8px 12px", width: "14%", textAlign: "right" }}>Unit Price</th>
                      <th style={{ padding: "8px 12px", width: "12%" }}>Tax Rate</th>
                      <th style={{ padding: "8px 12px", width: "12%", textAlign: "right" }}>Line Total</th>
                      <th style={{ padding: "8px 12px", width: "4%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invLines.map((row, idx) => {
                      const qty = parseFloat(String(row.quantity)) || 0;
                      const price = parseFloat(String(row.unitPrice)) || 0;
                      const sub = qty * price;
                      const tax = (sub * (row.taxRatePercent || 0)) / 100;
                      const total = sub + tax;

                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              className="input"
                              style={{ fontSize: "12px", padding: "6px 8px" }}
                              placeholder="Service description"
                              value={row.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInvLines((prev) => {
                                  const c = [...prev];
                                  c[idx].description = val;
                                  return c;
                                });
                              }}
                              required
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <select
                              className="input"
                              style={{ fontSize: "12px", padding: "6px 8px" }}
                              value={row.accountId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInvLines((prev) => {
                                  const c = [...prev];
                                  c[idx].accountId = val;
                                  return c;
                                });
                              }}
                            >
                              <option value="">Default (4000 Sales)</option>
                              {accounts
                                .filter((a) => a.type === "REVENUE")
                                .map((a) => (
                                  <option key={a._id} value={a._id}>
                                    {a.code} - {a.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="number"
                              className="input"
                              style={{ fontSize: "12px", padding: "6px 8px", textAlign: "right" }}
                              value={row.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInvLines((prev) => {
                                  const c = [...prev];
                                  c[idx].quantity = val;
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
                              value={row.unitPrice}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInvLines((prev) => {
                                  const c = [...prev];
                                  c[idx].unitPrice = val;
                                  return c;
                                });
                              }}
                              required
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <select
                              className="input"
                              style={{ fontSize: "12px", padding: "6px 8px" }}
                              value={row.taxRatePercent}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setInvLines((prev) => {
                                  const c = [...prev];
                                  c[idx].taxRatePercent = val;
                                  return c;
                                });
                              }}
                            >
                              <option value="0">0% (Exempt)</option>
                              <option value="5">5% GST</option>
                              <option value="12">12% GST</option>
                              <option value="18">18% GST (Standard)</option>
                              <option value="28">28% GST</option>
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>
                            {formatCurrency(total)}
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeInvoiceLine(idx)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Breakdown */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: "320px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary, #64748b)" }}>Subtotal:</span>
                  <span>{formatCurrency(calculatedTotals.subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary, #64748b)" }}>Output GST:</span>
                  <span>{formatCurrency(calculatedTotals.taxTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-light, #e2e8f0)", paddingTop: "6px", fontSize: "15px", fontWeight: 800 }}>
                  <span>Total Amount:</span>
                  <span style={{ color: "var(--brand-primary, #3b82f6)" }}>{formatCurrency(calculatedTotals.total)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                Customer Notes & Payment Instructions
              </label>
              <textarea
                className="input"
                rows={2}
                placeholder="Bank account transfer details, payment terms, or client notes..."
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
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
                onClick={() => {
                  setShowInvoiceModal(false);
                  onModalClose?.();
                }}
                disabled={invoiceSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ minWidth: "180px", height: "42px", fontSize: "13.5px" }}
                disabled={invoiceSubmitting}
              >
                {invoiceSubmitting ? "Generating & Posting..." : "Create & Post Invoice"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Receipt Modal */}
      {showReceiptModal && (
        <Modal
          title="Record Customer Receipt / Inflow"
          eyebrow="DOUBLE-ENTRY PAYMENT COLLECTION"
          size="md"
          onClose={() => {
            setShowReceiptModal(false);
            onModalClose?.();
          }}
        >
          <form onSubmit={handleCreateReceipt} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
            {/* Customer Identification & Source */}
            <div style={{ background: "var(--card2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)", borderRadius: "8px", padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text, #18231F)" }}>
                  Customer Identification & Reference
                </span>
                <div style={{ display: "inline-flex", background: "#e2e8f0", padding: "3px", borderRadius: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setRecClientMode("ERP")}
                    style={{
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: recClientMode === "ERP" ? 700 : 500,
                      background: recClientMode === "ERP" ? "#ffffff" : "transparent",
                      color: recClientMode === "ERP" ? "var(--primary-green, #087A5B)" : "#64748b",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: recClientMode === "ERP" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    🏢 ERP Client Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecClientMode("MANUAL")}
                    style={{
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: recClientMode === "MANUAL" ? 700 : 500,
                      background: recClientMode === "MANUAL" ? "#ffffff" : "transparent",
                      color: recClientMode === "MANUAL" ? "var(--primary-green, #087A5B)" : "#64748b",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: recClientMode === "MANUAL" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    ✍️ Manual Customer / Ref
                  </button>
                </div>
              </div>

              {recClientMode === "ERP" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Select ERP Client *
                    </label>
                    <select
                      className="input"
                      value={recClientId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        setRecClientId(cid);
                        const sel = clients.find((c: any) => String(c.id || c._id) === cid);
                        if (sel) {
                          setRecClientName(sel.name);
                        }
                      }}
                      required={recClientMode === "ERP"}
                    >
                      <option value="">-- Choose ERP Client --</option>
                      {clients.map((c: any) => (
                        <option key={String(c.id || c._id)} value={String(c.id || c._id)}>
                          {c.name} {c.industry ? `(${c.industry})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Client / Payment Ref #
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. UTR-881920 / Cheque"
                      value={recClientRef}
                      onChange={(e) => setRecClientRef(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Customer / Client Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Acme Corp / Walk-in Customer"
                      value={recClientName}
                      onChange={(e) => setRecClientName(e.target.value)}
                      required={recClientMode === "MANUAL"}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Client / Payment Ref #
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. UTR-881920 / Cheque"
                      value={recClientRef}
                      onChange={(e) => setRecClientRef(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Payment Date *
                </label>
                <input
                  type="date"
                  className="input"
                  value={recDate}
                  onChange={(e) => setRecDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Payment Mode *
                </label>
                <select
                  className="input"
                  value={recPaymentMode}
                  onChange={(e) => setRecPaymentMode(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Deposit Account (Bank / Cash) *
                </label>
                <select
                  className="input"
                  value={recDepositAccountId}
                  onChange={(e) => setRecDepositAccountId(e.target.value)}
                  required
                >
                  <option value="">-- Select Deposit Account --</option>
                  {accounts
                    .filter((a) => a.type === "ASSET")
                    .map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Amount Received (INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="0.00"
                  value={recAmount}
                  onChange={(e) => setRecAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                Transaction Reference # / UTR
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. UTR-2026-HDFC-9938"
                value={recReference}
                onChange={(e) => setRecReference(e.target.value)}
              />
            </div>

            <div>
              <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                Notes / Remittance Advice
              </label>
              <textarea
                className="input"
                rows={2}
                placeholder="Payment remarks..."
                value={recNotes}
                onChange={(e) => setRecNotes(e.target.value)}
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
                onClick={() => {
                  setShowReceiptModal(false);
                  onModalClose?.();
                }}
                disabled={receiptSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ minWidth: "180px", height: "42px", fontSize: "13.5px" }}
                disabled={receiptSubmitting}
              >
                {receiptSubmitting ? "Posting Receipt..." : "Record & Post Receipt"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
