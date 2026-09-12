"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  CreditCard,
  ArrowUpRight,
  Trash2,
  Users,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/ToastContext";
import { Modal } from "@/features/common/Modal";
import type {
  AccountingBill,
  VendorPayment,
  Vendor,
  ChartOfAccount,
} from "@/lib/types";
import { formatCurrency, formatDate, STATUS_COLORS, unpackResults, exportToCsv } from "./accountingUtils";

interface Props {
  initialOpenBill?: boolean;
  initialOpenPayment?: boolean;
  onModalClose?: () => void;
}

interface NewBillLine {
  description: string;
  accountId: string;
  quantity: number | string;
  unitPrice: number | string;
  taxRatePercent: number;
}

export function BillsAndPaymentsView({
  initialOpenBill = false,
  initialOpenPayment = false,
  onModalClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<"BILLS" | "PAYMENTS" | "VENDORS">("BILLS");
  const [bills, setBills] = useState<AccountingBill[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Bill Modal
  const [showBillModal, setShowBillModal] = useState(initialOpenBill);
  const [billSubmitting, setBillSubmitting] = useState(false);
  const [billVendorMode, setBillVendorMode] = useState<"VENDOR" | "MANUAL">("VENDOR");
  const [billVendorId, setBillVendorId] = useState("");
  const [billVendorName, setBillVendorName] = useState("");
  const [billVendorRef, setBillVendorRef] = useState("");
  const [billVendorGstin, setBillVendorGstin] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billDueDate, setBillDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [billNotes, setBillNotes] = useState("");
  const [billLines, setBillLines] = useState<NewBillLine[]>([
    { description: "", accountId: "", quantity: 1, unitPrice: "", taxRatePercent: 0 },
  ]);

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(initialOpenPayment);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [payVendorMode, setPayVendorMode] = useState<"VENDOR" | "MANUAL">("VENDOR");
  const [payVendorId, setPayVendorId] = useState("");
  const [payVendorName, setPayVendorName] = useState("");
  const [payVendorRef, setPayVendorRef] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMode, setPayMode] = useState("BANK_TRANSFER");
  const [payAccountId, setPayAccountId] = useState("");
  const [payAmount, setPayAmount] = useState<number | string>("");
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Vendor Modal
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorSubmitting, setVendorSubmitting] = useState(false);
  const [vName, setVName] = useState("");
  const [vCode, setVCode] = useState("");
  const [vContact, setVContact] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vGstin, setVGstin] = useState("");

  useEffect(() => {
    if (initialOpenBill) setShowBillModal(true);
    if (initialOpenPayment) setShowPaymentModal(true);
  }, [initialOpenBill, initialOpenPayment]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bData, pData, vData, aData] = await Promise.all([
        api<{ count: number; results: AccountingBill[] }>("/accounting/bills"),
        api<{ count: number; results: VendorPayment[] }>("/accounting/vendor-payments"),
        api<any>("/accounting/entities/vendors"),
        api<ChartOfAccount[]>("/accounting/accounts"),
      ]);
      setBills(unpackResults(bData));
      setPayments(unpackResults(pData));
      const parsedVendors = unpackResults<Vendor>(vData);
      setVendors(parsedVendors);
      const parsedAccounts = unpackResults<ChartOfAccount>(aData);
      setAccounts(parsedAccounts);

      if (parsedAccounts.length > 0 && !payAccountId) {
        const bank = parsedAccounts.find((a) => a.code === "1130") || parsedAccounts.find((a) => a.code === "1110");
        if (bank) setPayAccountId(bank._id);
      }
    } catch (err: any) {
      console.error("Failed to load bills/payments:", err);
      toast.error(err.message || "Failed to load payables data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const calculatedBillTotals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    billLines.forEach((ln) => {
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
  }, [billLines]);

  const addBillLine = () => {
    setBillLines((prev) => [
      ...prev,
      { description: "", accountId: "", quantity: 1, unitPrice: "", taxRatePercent: 0 },
    ]);
  };

  const removeBillLine = (index: number) => {
    if (billLines.length <= 1) return;
    setBillLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billVendorId) {
      toast.error("Please select a vendor");
      return;
    }
    if (billVendorMode === "VENDOR" && !billVendorId) {
      toast.error("Please select a vendor, or switch to Manual Vendor Entry");
      return;
    }
    if (billVendorMode === "MANUAL" && !billVendorName.trim()) {
      toast.error("Please enter a vendor / supplier name");
      return;
    }
    if (calculatedBillTotals.total <= 0) {
      toast.error("Bill total must be greater than zero");
      return;
    }

    setBillSubmitting(true);
    try {
      const vendor = vendors.find((v) => v._id === billVendorId);
      const defaultExpenseAcc = accounts.find((a) => a.type === "EXPENSE");
      const finalVendorName = billVendorMode === "VENDOR" ? (vendor?.name || "Vendor") : billVendorName.trim();
      const payload = {
        vendor: billVendorMode === "VENDOR" ? billVendorId : null,
        vendorName: finalVendorName,
        vendorInvoiceNumber: billVendorRef.trim(),
        vendorReference: billVendorRef.trim(),
        vendorGstin: billVendorGstin.trim(),
        isManualVendor: billVendorMode === "MANUAL",
        billDate,
        dueDate: billDueDate,
        notes: billNotes,
        lines: billLines.map((ln) => {
          const qty = parseFloat(String(ln.quantity)) || 1;
          const price = parseFloat(String(ln.unitPrice)) || 0;
          const lineTotal = qty * price;
          const taxAmt = (lineTotal * (ln.taxRatePercent || 0)) / 100;
          return {
            description: ln.description || "Vendor Expense",
            account: ln.accountId || defaultExpenseAcc?._id,
            quantity: qty,
            unitRate: price,
            taxAmount: taxAmt,
            totalAmount: lineTotal + taxAmt,
          };
        }),
      };

      await api("/accounting/bills", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Vendor Bill recorded & double-entry journal posted");
      setShowBillModal(false);
      onModalClose?.();
      setBillVendorName("");
      setBillVendorRef("");
      setBillVendorGstin("");
      setBillNotes("");
      setBillLines([{ description: "", accountId: "", quantity: 1, unitPrice: "", taxRatePercent: 0 }]);
      fetchData();
    } catch (err: any) {
      console.error("Failed to record bill:", err);
      toast.error(err.message || "Failed to record bill");
    } finally {
      setBillSubmitting(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payVendorMode === "VENDOR" && !payVendorId) {
      toast.error("Please select a vendor, or switch to Manual Payee Entry");
      return;
    }
    if (payVendorMode === "MANUAL" && !payVendorName.trim()) {
      toast.error("Please enter a vendor / payee name");
      return;
    }
    const amt = parseFloat(String(payAmount)) || 0;
    if (amt <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }
    if (!payAccountId) {
      toast.error("Please select a disbursement bank or cash account");
      return;
    }

    setPaymentSubmitting(true);
    try {
      const vendor = vendors.find((v) => v._id === payVendorId);
      const finalVendorName = payVendorMode === "VENDOR" ? (vendor?.name || "Vendor") : payVendorName.trim();
      const finalRef = (payVendorRef || payReference).trim();
      const payload = {
        vendor: payVendorMode === "VENDOR" ? payVendorId : null,
        vendorName: finalVendorName,
        vendorReference: finalRef,
        referenceNumber: finalRef,
        isManualVendor: payVendorMode === "MANUAL",
        date: payDate,
        paymentMethod: payMode,
        paidFromAccount: payAccountId,
        totalAmount: amt,
        notes: payNotes,
        autoAllocate: true,
      };

      await api("/accounting/vendor-payments", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Vendor payment recorded & posted to General Ledger");
      setShowPaymentModal(false);
      onModalClose?.();
      setPayVendorName("");
      setPayVendorRef("");
      setPayAmount("");
      setPayReference("");
      setPayNotes("");
      fetchData();
    } catch (err: any) {
      console.error("Failed to record payment:", err);
      toast.error(err.message || "Failed to record vendor payment");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) {
      toast.error("Vendor name is required");
      return;
    }

    setVendorSubmitting(true);
    try {
      await api("/accounting/entities/vendors", {
        method: "POST",
        body: JSON.stringify({
          name: vName,
          code: vCode || undefined,
          contactPerson: vContact,
          email: vEmail,
          phone: vPhone,
          taxId: vGstin,
          paymentTerms: "NET_30",
        }),
      });

      toast.success(`Vendor ${vName} added successfully`);
      setShowVendorModal(false);
      setVName("");
      setVCode("");
      setVContact("");
      setVEmail("");
      setVPhone("");
      setVGstin("");
      fetchData();
    } catch (err: any) {
      console.error("Failed to create vendor:", err);
      toast.error(err.message || "Failed to create vendor");
    } finally {
      setVendorSubmitting(false);
    }
  };

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;
      const vendorName = b.vendorName || (b.vendor as any)?.name || "";
      const matchesVendor =
        vendorFilter === "ALL" ||
        (b.vendor && ((b.vendor as any)._id === vendorFilter || (b.vendor as any).id === vendorFilter)) ||
        (b.vendorName && b.vendorName === vendorFilter);

      const billDateStr = b.billDate ? b.billDate.slice(0, 10) : "";
      const matchesFrom = !startDate || billDateStr >= startDate;
      const matchesTo = !endDate || billDateStr <= endDate;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.billNumber.toLowerCase().includes(q) ||
        vendorName.toLowerCase().includes(q) ||
        (b.vendorReference && b.vendorReference.toLowerCase().includes(q)) ||
        (b.vendorInvoiceNumber && b.vendorInvoiceNumber.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q));

      return matchesStatus && matchesVendor && matchesFrom && matchesTo && matchesSearch;
    });
  }, [bills, statusFilter, vendorFilter, startDate, endDate, searchQuery]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const vendorName = p.vendorName || (p.vendor as any)?.name || "";
      const matchesVendor =
        vendorFilter === "ALL" ||
        (p.vendor && ((p.vendor as any)._id === vendorFilter || (p.vendor as any).id === vendorFilter)) ||
        (p.vendorName && p.vendorName === vendorFilter);

      const payDateStr = p.date ? p.date.slice(0, 10) : "";
      const matchesFrom = !startDate || payDateStr >= startDate;
      const matchesTo = !endDate || payDateStr <= endDate;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.paymentNumber.toLowerCase().includes(q) ||
        vendorName.toLowerCase().includes(q) ||
        (p.vendorReference && p.vendorReference.toLowerCase().includes(q)) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q));

      return matchesVendor && matchesFrom && matchesTo && matchesSearch;
    });
  }, [payments, vendorFilter, startDate, endDate, searchQuery]);

  const handleExportBillsCsv = () => {
    const headers = [
      "Bill #",
      "Bill Date",
      "Due Date",
      "Vendor",
      "Vendor Type",
      "Vendor Ref / Invoice #",
      "Subtotal (INR)",
      "Tax Amount (INR)",
      "Total Amount (INR)",
      "Amount Paid (INR)",
      "Balance Due (INR)",
      "Status",
    ];
    const rows = filteredBills.map((b) => [
      b.billNumber,
      formatDate(b.billDate),
      formatDate(b.dueDate),
      b.vendorName || (b.vendor as any)?.name || "Vendor",
      b.isManualVendor ? "Manual" : "Registered",
      b.vendorReference || b.vendorInvoiceNumber || "",
      b.subtotal || 0,
      b.taxTotal || 0,
      b.totalAmount || 0,
      b.amountPaid || 0,
      b.balanceDue || 0,
      b.status,
    ]);
    exportToCsv("vendor_bills_report", headers, rows);
    toast.success(`Exported ${rows.length} vendor bills to CSV`);
  };

  const handleExportPaymentsCsv = () => {
    const headers = [
      "Payment #",
      "Payment Date",
      "Vendor",
      "Vendor Type",
      "Reference #",
      "Amount Paid (INR)",
      "Payment Mode",
      "Paid From Account",
      "Status",
    ];
    const rows = filteredPayments.map((p) => [
      p.paymentNumber,
      formatDate(p.date),
      p.vendorName || (p.vendor as any)?.name || "Vendor",
      p.isManualVendor ? "Manual" : "Registered",
      p.vendorReference || p.referenceNumber || "",
      p.totalAmount || 0,
      p.paymentMethod,
      (p.paidFromAccount as any)?.name || "Bank Account",
      p.status,
    ]);
    exportToCsv("vendor_payments_report", headers, rows);
    toast.success(`Exported ${rows.length} outward payments to CSV`);
  };

  const handleExportVendorsCsv = () => {
    const headers = [
      "Vendor Code",
      "Vendor Name",
      "Tax ID / GSTIN",
      "Contact Person",
      "Email",
      "Phone",
      "Payment Terms",
      "Status",
    ];
    const rows = vendors.map((v) => [
      v.code,
      v.name,
      v.taxId || "",
      v.contactPerson || "",
      v.email || "",
      v.phone || "",
      v.paymentTerms || "Net 30 Days",
      v.isActive ? "ACTIVE" : "INACTIVE",
    ]);
    exportToCsv("vendors_master_report", headers, rows);
    toast.success(`Exported ${rows.length} vendors to CSV`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Tab Switcher & Top Bar */}
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
            className={`btn btn-sm ${activeTab === "BILLS" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("BILLS")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <CreditCard size={14} /> Vendor Bills ({bills.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "PAYMENTS" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("PAYMENTS")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowUpRight size={14} /> Outward Payments ({payments.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "VENDORS" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("VENDORS")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Users size={14} /> Vendors Master ({vendors.length})
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

          {activeTab === "BILLS" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowBillModal(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={14} /> Record Bill
            </button>
          )}

          {activeTab === "PAYMENTS" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowPaymentModal(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={14} /> Record Payment
            </button>
          )}

          {activeTab === "VENDORS" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowVendorModal(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={14} /> New Vendor
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
              placeholder={
                activeTab === "BILLS"
                  ? "Search bill #, vendor, ref..."
                  : activeTab === "PAYMENTS"
                  ? "Search payment #, vendor, ref..."
                  : "Search vendor name..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "34px", fontSize: "13px" }}
            />
          </div>

          {(activeTab === "BILLS" || activeTab === "PAYMENTS") && (
            <select
              className="input"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              style={{ width: "180px", fontSize: "13px" }}
            >
              <option value="ALL">All Vendors (Registered & Manual)</option>
              {vendors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
          )}

          {activeTab === "BILLS" && (
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "160px", fontSize: "13px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved / Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          )}

          {(activeTab === "BILLS" || activeTab === "PAYMENTS") && (
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
              {(startDate || endDate || vendorFilter !== "ALL" || (activeTab === "BILLS" && statusFilter !== "ALL") || searchQuery) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setVendorFilter("ALL");
                    setStatusFilter("ALL");
                    setSearchQuery("");
                  }}
                  style={{ fontSize: "11.5px", padding: "4px 8px" }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={
            activeTab === "BILLS"
              ? handleExportBillsCsv
              : activeTab === "PAYMENTS"
              ? handleExportPaymentsCsv
              : handleExportVendorsCsv
          }
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Bills Table */}
      {activeTab === "BILLS" && (
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
                  <th style={{ padding: "12px 16px" }}>Bill #</th>
                  <th style={{ padding: "12px 16px" }}>Vendor Ref</th>
                  <th style={{ padding: "12px 16px" }}>Date</th>
                  <th style={{ padding: "12px 16px" }}>Due Date</th>
                  <th style={{ padding: "12px 16px" }}>Vendor</th>
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
                    <td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
                      Loading vendor bills...
                    </td>
                  </tr>
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      No bills recorded. Click "Record Bill" to log supplier invoices.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((b) => {
                    const statusStyle = STATUS_COLORS[b.status] || { bg: "#f1f5f9", text: "#475569" };
                    return (
                      <tr key={b._id} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }} className="hover:bg-slate-50">
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#ef4444" }}>
                          {b.billNumber}
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--text-secondary, #64748b)" }}>
                          {b.vendorInvoiceNumber || "-"}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                          {formatDate(b.billDate)}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                          {formatDate(b.dueDate)}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span>{b.vendorName || (b.vendor as any)?.name || "Vendor"}</span>
                              {b.isManualVendor ? (
                                <span style={{ fontSize: "10.5px", background: "#fef3c7", color: "#92400e", padding: "1px 5px", borderRadius: "4px", fontWeight: 600 }}>
                                  Manual
                                </span>
                              ) : (
                                <span style={{ fontSize: "10.5px", background: "#ecfdf5", color: "#065f46", padding: "1px 5px", borderRadius: "4px", fontWeight: 600 }}>
                                  Vendor
                                </span>
                              )}
                            </div>
                            {b.vendorReference && (
                              <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: 500 }}>
                                Ref: {b.vendorReference}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          {formatCurrency(b.subtotal || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          {formatCurrency(b.taxTotal || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                          {formatCurrency(b.totalAmount || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: (b.balanceDue || 0) > 0 ? "#dc2626" : "#059669" }}>
                          {formatCurrency(b.balanceDue || 0)}
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
                            {b.status}
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

      {/* Payments Table */}
      {activeTab === "PAYMENTS" && (
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
                  <th style={{ padding: "12px 16px" }}>Payment #</th>
                  <th style={{ padding: "12px 16px" }}>Date</th>
                  <th style={{ padding: "12px 16px" }}>Vendor</th>
                  <th style={{ padding: "12px 16px" }}>Payment Mode</th>
                  <th style={{ padding: "12px 16px" }}>Reference #</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount Paid</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Unallocated</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      <RefreshCw size={20} className="animate-spin" style={{ display: "inline", marginRight: "8px" }} />
                      Loading vendor payments...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      No vendor payments recorded yet. Click "Record Payment" to register payouts.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const statusStyle = STATUS_COLORS[p.status] || { bg: "#f1f5f9", text: "#475569" };
                    return (
                      <tr key={p._id} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }} className="hover:bg-slate-50">
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>
                          {p.paymentNumber}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                          {formatDate(p.date)}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                          {(p.vendor as any)?.name || "Vendor"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--text-secondary, #64748b)" }}>
                          {p.referenceNumber || "-"}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#dc2626" }}>
                          {formatCurrency(p.totalAmount || 0)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: (p.unallocatedAmount || 0) > 0 ? "#d97706" : "#64748b" }}>
                          {formatCurrency(p.unallocatedAmount || 0)}
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
                            {p.status}
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

      {/* Vendors Master Table */}
      {activeTab === "VENDORS" && (
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
                  <th style={{ padding: "12px 16px" }}>Code</th>
                  <th style={{ padding: "12px 16px" }}>Vendor Name</th>
                  <th style={{ padding: "12px 16px" }}>Contact Person</th>
                  <th style={{ padding: "12px 16px" }}>Email</th>
                  <th style={{ padding: "12px 16px" }}>Phone</th>
                  <th style={{ padding: "12px 16px" }}>GSTIN / Tax ID</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary, #64748b)" }}>
                      No vendors added yet. Click "New Vendor" to register suppliers.
                    </td>
                  </tr>
                ) : (
                  vendors.map((v) => (
                    <tr key={v._id} style={{ borderBottom: "1px solid var(--border-light, #e2e8f0)" }} className="hover:bg-slate-50">
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#3b82f6" }}>
                        {v.code}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
                        {v.name}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                        {v.contactPerson || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                        {v.email || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)" }}>
                        {v.phone || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>
                        {v.taxId || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {v.isActive ? (
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: "12px" }}>
                            Active
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Bill Modal */}
      {showBillModal && (
        <Modal
          title="Record New Vendor Bill"
          eyebrow="ACCOUNTS PAYABLE & EXPENSE RECOGNITION"
          size="xl"
          onClose={() => {
            setShowBillModal(false);
            onModalClose?.();
          }}
        >
          <form onSubmit={handleCreateBill} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
            {/* Vendor Identification & Sourcing */}
            <div style={{ background: "var(--card2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)", borderRadius: "8px", padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text, #18231F)" }}>
                  Vendor / Supplier Identification
                </span>
                <div style={{ display: "inline-flex", background: "#e2e8f0", padding: "3px", borderRadius: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setBillVendorMode("VENDOR")}
                    style={{
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: billVendorMode === "VENDOR" ? 700 : 500,
                      background: billVendorMode === "VENDOR" ? "#ffffff" : "transparent",
                      color: billVendorMode === "VENDOR" ? "var(--primary-green, #087A5B)" : "#64748b",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: billVendorMode === "VENDOR" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    🏢 Registered Vendor
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillVendorMode("MANUAL")}
                    style={{
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: billVendorMode === "MANUAL" ? 700 : 500,
                      background: billVendorMode === "MANUAL" ? "#ffffff" : "transparent",
                      color: billVendorMode === "MANUAL" ? "var(--primary-green, #087A5B)" : "#64748b",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: billVendorMode === "MANUAL" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    ✍️ Manual Vendor / Ad-hoc Bill
                  </button>
                </div>
              </div>

              {billVendorMode === "VENDOR" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Select Registered Vendor *
                    </label>
                    <select
                      className="input"
                      value={billVendorId}
                      onChange={(e) => {
                        const vid = e.target.value;
                        setBillVendorId(vid);
                        const sel = vendors.find((v) => v._id === vid);
                        if (sel) setBillVendorName(sel.name);
                      }}
                      required={billVendorMode === "VENDOR"}
                    >
                      <option value="">-- Choose Vendor --</option>
                      {vendors.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.name} {v.code ? `(${v.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Vendor Invoice / Ref # (Optional)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. INV-99021"
                      value={billVendorRef}
                      onChange={(e) => setBillVendorRef(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Vendor / Supplier Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Office Depot / Cloud Hosting"
                      value={billVendorName}
                      onChange={(e) => setBillVendorName(e.target.value)}
                      required={billVendorMode === "MANUAL"}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Vendor Bill / Ref #
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. BILL-9921 / Ref"
                      value={billVendorRef}
                      onChange={(e) => setBillVendorRef(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Vendor Tax ID / GSTIN
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="27AAAAA0000A1Z5"
                      value={billVendorGstin}
                      onChange={(e) => setBillVendorGstin(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Bill Date *
                </label>
                <input
                  type="date"
                  className="input"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
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
                  value={billDueDate}
                  onChange={(e) => setBillDueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary, #0f172a)" }}>
                  Bill Expenses & Line Items
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={addBillLine}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Plus size={12} /> Add Line
                </button>
              </div>

              <div style={{ border: "1px solid var(--border-light, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-subtle, #f8fafc)", borderBottom: "1px solid var(--border-light, #e2e8f0)", textAlign: "left" }}>
                      <th style={{ padding: "8px 12px", width: "30%" }}>Description *</th>
                      <th style={{ padding: "8px 12px", width: "24%" }}>Expense / Asset Account</th>
                      <th style={{ padding: "8px 12px", width: "10%", textAlign: "right" }}>Qty</th>
                      <th style={{ padding: "8px 12px", width: "14%", textAlign: "right" }}>Unit Cost</th>
                      <th style={{ padding: "8px 12px", width: "10%" }}>GST %</th>
                      <th style={{ padding: "8px 12px", width: "12%", textAlign: "right" }}>Total</th>
                      <th style={{ padding: "8px 12px", width: "4%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {billLines.map((row, idx) => {
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
                              placeholder="e.g. AWS Cloud Hosting May"
                              value={row.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBillLines((prev) => {
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
                                setBillLines((prev) => {
                                  const c = [...prev];
                                  c[idx].accountId = val;
                                  return c;
                                });
                              }}
                            >
                              <option value="">-- Choose Account --</option>
                              {accounts
                                .filter((a) => a.type === "EXPENSE" || a.type === "ASSET")
                                .map((a) => (
                                  <option key={a._id} value={a._id}>
                                    {a.code} - {a.name} ({a.type})
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
                                setBillLines((prev) => {
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
                                setBillLines((prev) => {
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
                                setBillLines((prev) => {
                                  const c = [...prev];
                                  c[idx].taxRatePercent = val;
                                  return c;
                                });
                              }}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>
                            {formatCurrency(total)}
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeBillLine(idx)}
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
              <div style={{ width: "300px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary, #64748b)" }}>Subtotal:</span>
                  <span>{formatCurrency(calculatedBillTotals.subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary, #64748b)" }}>Input Tax (ITC):</span>
                  <span>{formatCurrency(calculatedBillTotals.taxTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-light, #e2e8f0)", paddingTop: "6px", fontSize: "15px", fontWeight: 800 }}>
                  <span>Total Payable:</span>
                  <span style={{ color: "#ef4444" }}>{formatCurrency(calculatedBillTotals.total)}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border, #E2E8F0)" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: "42px", minWidth: "110px", padding: "0 20px", fontSize: "13.5px", fontWeight: 600 }}
                onClick={() => {
                  setShowBillModal(false);
                  onModalClose?.();
                }}
                disabled={billSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: "42px", minWidth: "180px", padding: "0 24px", fontSize: "13.5px", fontWeight: 600 }}
                disabled={billSubmitting}
              >
                {billSubmitting ? "Recording Bill..." : "Record & Post Bill"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Vendor Payment Modal */}
      {showPaymentModal && (
        <Modal
          title="Record Outward Vendor Payment"
          eyebrow="DOUBLE-ENTRY DISBURSEMENT"
          size="md"
          onClose={() => {
            setShowPaymentModal(false);
            onModalClose?.();
          }}
        >
          <form onSubmit={handleCreatePayment} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
            {/* Vendor Identification & Source */}
            <div style={{ background: "var(--card2, #F8FAF9)", border: "1px solid var(--border, #DCE3E0)", borderRadius: "8px", padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text, #18231F)" }}>
                  Vendor / Payee Identification
                </span>
                <div style={{ display: "inline-flex", background: "#e2e8f0", padding: "3px", borderRadius: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setPayVendorMode("VENDOR")}
                    style={{
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: payVendorMode === "VENDOR" ? 700 : 500,
                      background: payVendorMode === "VENDOR" ? "#ffffff" : "transparent",
                      color: payVendorMode === "VENDOR" ? "var(--primary-green, #087A5B)" : "#64748b",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: payVendorMode === "VENDOR" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    🏢 Registered Vendor
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayVendorMode("MANUAL")}
                    style={{
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: payVendorMode === "MANUAL" ? 700 : 500,
                      background: payVendorMode === "MANUAL" ? "#ffffff" : "transparent",
                      color: payVendorMode === "MANUAL" ? "var(--primary-green, #087A5B)" : "#64748b",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: payVendorMode === "MANUAL" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    ✍️ Manual Payee / Ref
                  </button>
                </div>
              </div>

              {payVendorMode === "VENDOR" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Select Registered Vendor *
                    </label>
                    <select
                      className="input"
                      value={payVendorId}
                      onChange={(e) => {
                        const vid = e.target.value;
                        setPayVendorId(vid);
                        const sel = vendors.find((v) => v._id === vid);
                        if (sel) setPayVendorName(sel.name);
                      }}
                      required={payVendorMode === "VENDOR"}
                    >
                      <option value="">-- Choose Vendor --</option>
                      {vendors.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Payment / Cheque Ref #
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. CHQ-8821 / NEFT"
                      value={payVendorRef}
                      onChange={(e) => setPayVendorRef(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Vendor / Payee Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Office Depot / One-off Contractor"
                      value={payVendorName}
                      onChange={(e) => setPayVendorName(e.target.value)}
                      required={payVendorMode === "MANUAL"}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                      Payment / Cheque Ref #
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. CHQ-8821 / NEFT"
                      value={payVendorRef}
                      onChange={(e) => setPayVendorRef(e.target.value)}
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
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Payment Mode *
                </label>
                <select
                  className="input"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Disbursement Account *
                </label>
                <select
                  className="input"
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  required
                >
                  <option value="">-- Select Bank/Cash --</option>
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
                  Amount Paid (INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                Transaction Ref # / Cheque #
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. TXN-HDFC-88219"
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border, #E2E8F0)" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: "42px", minWidth: "110px", padding: "0 20px", fontSize: "13.5px", fontWeight: 600 }}
                onClick={() => {
                  setShowPaymentModal(false);
                  onModalClose?.();
                }}
                disabled={paymentSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: "42px", minWidth: "180px", padding: "0 24px", fontSize: "13.5px", fontWeight: 600 }}
                disabled={paymentSubmitting}
              >
                {paymentSubmitting ? "Disbursing..." : "Record & Post Payment"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New Vendor Modal */}
      {showVendorModal && (
        <Modal
          title="Add New Vendor / Supplier"
          eyebrow="ACCOUNTS PAYABLE MASTER"
          size="md"
          onClose={() => setShowVendorModal(false)}
        >
          <form onSubmit={handleCreateVendor} style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "12px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Vendor / Business Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Amazon Web Services Inc."
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Vendor Code
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. VND-004"
                  value={vCode}
                  onChange={(e) => setVCode(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Contact Person
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Name"
                  value={vContact}
                  onChange={(e) => setVContact(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="+91..."
                  value={vPhone}
                  onChange={(e) => setVPhone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="input"
                  placeholder="billing@vendor.com"
                  value={vEmail}
                  onChange={(e) => setVEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: "12px", fontWeight: 600 }}>
                  GSTIN / Tax ID
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="27AAAAA0000A1Z5"
                  value={vGstin}
                  onChange={(e) => setVGstin(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border, #E2E8F0)" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: "42px", minWidth: "110px", padding: "0 20px", fontSize: "13.5px", fontWeight: 600 }}
                onClick={() => setShowVendorModal(false)}
                disabled={vendorSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: "42px", minWidth: "150px", padding: "0 24px", fontSize: "13.5px", fontWeight: 600 }}
                disabled={vendorSubmitting}
              >
                {vendorSubmitting ? "Adding Vendor..." : "Save Vendor"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
