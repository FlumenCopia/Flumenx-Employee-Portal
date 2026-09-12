"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderTree,
  BookOpen,
  FileSpreadsheet,
  FileText,
  CreditCard,
  TrendingDown,
  Building2,
  Scale,
  Landmark,
} from "lucide-react";
import { Shell, useShellUser } from "@/components/shell";
import { PageHeader } from "@/components/ui";
import type { WorkspaceRole } from "@/lib/types";
import { AccountingDashboardView } from "./AccountingDashboardView";
import { ChartOfAccountsView } from "./ChartOfAccountsView";
import { GeneralLedgerView } from "./GeneralLedgerView";
import { JournalEntriesView } from "./JournalEntriesView";
import { InvoicesAndReceiptsView } from "./InvoicesAndReceiptsView";
import { BillsAndPaymentsView } from "./BillsAndPaymentsView";
import { ExpensesView } from "./ExpensesView";
import { BankingView } from "./BankingView";
import { FinancialReportsView } from "./FinancialReportsView";

interface Props {
  role?: WorkspaceRole;
}

type TabKey =
  | "dashboard"
  | "accounts"
  | "ledger"
  | "journal"
  | "invoices"
  | "bills"
  | "expenses"
  | "banking"
  | "reports";

export function AccountingMainPage({ role = "admin" }: Props) {
  const router = useRouter();
  const user = useShellUser();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [targetAccountForLedger, setTargetAccountForLedger] = useState<string | undefined>(undefined);

  // Quick Action Modal Triggers
  const [openNewInvoice, setOpenNewInvoice] = useState(false);
  const [openNewReceipt, setOpenNewReceipt] = useState(false);
  const [openNewBill, setOpenNewBill] = useState(false);
  const [openNewPayment, setOpenNewPayment] = useState(false);
  const [openNewJournal, setOpenNewJournal] = useState(false);

  const userRole = (((user as any)?.portal_role || (user as any)?.role || "") as string).toUpperCase();
  const hasAccess = Boolean(
    user && (
      userRole === "SUPER_ADMIN" ||
      userRole === "ADMIN" ||
      userRole === "ACCOUNTANT" ||
      userRole === "CFO" ||
      Boolean((user as any)?.is_superuser || (user as any)?.isSuperuser) ||
      Boolean((user as any)?.permissions?.ACCOUNTING?.canView)
    )
  );

  if (user && !hasAccess) {
    return (
      <Shell role={role}>
        <div style={{ padding: "80px 20px", textAlign: "center", maxWidth: "480px", margin: "0 auto" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Landmark size={28} />
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary, #0f172a)", marginBottom: "8px" }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary, #64748b)", lineHeight: "1.6", marginBottom: "20px" }}>
            You do not have permission to view or manage Accounting & Finance. Please contact your system administrator or CFO to request access.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/")}
          >
            Return to Workspace
          </button>
        </div>
      </Shell>
    );
  }

  const handleSelectAccountForLedger = (code: string) => {
    setTargetAccountForLedger(code);
    setActiveTab("ledger");
  };

  const navItems: { id: TabKey; label: string; icon: any }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "accounts", label: "Chart of Accounts", icon: FolderTree },
    { id: "ledger", label: "General Ledger", icon: BookOpen },
    { id: "journal", label: "Journal Vouchers", icon: FileSpreadsheet },
    { id: "invoices", label: "Sales & Invoicing", icon: FileText },
    { id: "bills", label: "Purchases & Bills", icon: CreditCard },
    { id: "expenses", label: "Expenses", icon: TrendingDown },
    { id: "banking", label: "Banking & Treasury", icon: Building2 },
    { id: "reports", label: "Financial Reports", icon: Scale },
  ];

  return (
    <Shell role={role}>
      <div style={{ maxWidth: "1600px", margin: "0 auto", paddingBottom: "48px" }}>
        <PageHeader
          eyebrow="FLUMENX OS FINANCE & TREASURY"
          title="Accounting & Financial Management"
          subtitle="Enterprise double-entry general ledger, client billing, vendor payables, treasury reconciliation, and financial reports."
        />

        {/* Tab Navigation Navigation Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "var(--panel, #ffffff)",
            border: "1px solid var(--border, #DCE3E0)",
            borderRadius: "12px",
            padding: "6px",
            marginBottom: "24px",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== "ledger") setTargetAccountForLedger(undefined);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: isActive ? "var(--primary-green, #087A5B)" : "transparent",
                  color: isActive ? "#ffffff" : "var(--txt2, #5F6F69)",
                  fontSize: "12.5px",
                  fontWeight: isActive ? 700 : 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 2px 6px rgba(8, 122, 91, 0.25)" : "none",
                }}
                className={!isActive ? "hover:bg-slate-100 hover:text-slate-900" : ""}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        {activeTab === "dashboard" && (
          <AccountingDashboardView
            onNavigateTab={(tab) => setActiveTab(tab as TabKey)}
            onOpenNewInvoice={() => {
              setActiveTab("invoices");
              setOpenNewInvoice(true);
            }}
            onOpenNewReceipt={() => {
              setActiveTab("invoices");
              setOpenNewReceipt(true);
            }}
            onOpenNewBill={() => {
              setActiveTab("bills");
              setOpenNewBill(true);
            }}
            onOpenNewPayment={() => {
              setActiveTab("bills");
              setOpenNewPayment(true);
            }}
            onOpenNewJournal={() => {
              setActiveTab("journal");
              setOpenNewJournal(true);
            }}
          />
        )}

        {activeTab === "accounts" && (
          <ChartOfAccountsView onSelectAccountForLedger={handleSelectAccountForLedger} />
        )}

        {activeTab === "ledger" && (
          <GeneralLedgerView initialAccountCode={targetAccountForLedger} />
        )}

        {activeTab === "journal" && (
          <JournalEntriesView
            initialOpenNewModal={openNewJournal}
            onModalClose={() => setOpenNewJournal(false)}
          />
        )}

        {activeTab === "invoices" && (
          <InvoicesAndReceiptsView
            initialOpenInvoice={openNewInvoice}
            initialOpenReceipt={openNewReceipt}
            onModalClose={() => {
              setOpenNewInvoice(false);
              setOpenNewReceipt(false);
            }}
          />
        )}

        {activeTab === "bills" && (
          <BillsAndPaymentsView
            initialOpenBill={openNewBill}
            initialOpenPayment={openNewPayment}
            onModalClose={() => {
              setOpenNewBill(false);
              setOpenNewPayment(false);
            }}
          />
        )}

        {activeTab === "expenses" && <ExpensesView />}

        {activeTab === "banking" && <BankingView />}

        {activeTab === "reports" && <FinancialReportsView />}
      </div>
    </Shell>
  );
}
