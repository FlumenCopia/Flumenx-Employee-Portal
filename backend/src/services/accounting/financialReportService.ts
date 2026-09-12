import mongoose from 'mongoose';
import { ChartOfAccount, IChartOfAccount } from '../../models/accounting/ChartOfAccount.js';
import { JournalEntry } from '../../models/accounting/JournalEntry.js';
import { Invoice } from '../../models/accounting/Invoice.js';
import { Bill } from '../../models/accounting/Bill.js';
import { BankAccount } from '../../models/accounting/Banking.js';

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  nature: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalanceResponse {
  asOfDate: Date;
  accounts: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  difference: number;
}

export async function getTrialBalance(asOfDate?: Date | string): Promise<TrialBalanceResponse> {
  const asOf = asOfDate ? new Date(asOfDate) : new Date();

  const accounts = await ChartOfAccount.find({ isActive: true }).sort({ code: 1 });

  // Fetch all posted journals up to asOf date
  const journals = await JournalEntry.find({
    status: 'POSTED',
    date: { $lte: asOf },
  });

  const accountTotals: Record<string, { debit: number; credit: number }> = {};
  for (const acc of accounts) {
    accountTotals[acc._id.toString()] = { debit: 0, credit: 0 };
  }

  for (const j of journals) {
    for (const l of j.lines) {
      const accId = l.account.toString();
      if (accountTotals[accId]) {
        accountTotals[accId].debit += l.debit;
        accountTotals[accId].credit += l.credit;
      }
    }
  }

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const acc of accounts) {
    const accId = acc._id.toString();
    const period = accountTotals[accId] || { debit: 0, credit: 0 };

    const netDebit = Math.round(period.debit * 100) / 100;
    const netCredit = Math.round(period.credit * 100) / 100;
    let openingDebit = 0;
    let openingCredit = 0;
    if (acc.openingBalance) {
      if (acc.nature === 'DEBIT') openingDebit = acc.openingBalance;
      else openingCredit = acc.openingBalance;
    }

    let closingDebit = 0;
    let closingCredit = 0;

    if (acc.nature === 'DEBIT') {
      const balance = Math.round((netDebit - netCredit) * 100) / 100;
      if (balance >= 0) closingDebit = balance;
      else closingCredit = Math.abs(balance);
    } else {
      const balance = Math.round((netCredit - netDebit) * 100) / 100;
      if (balance >= 0) closingCredit = balance;
      else closingDebit = Math.abs(balance);
    }

    totalDebit += closingDebit;
    totalCredit += closingCredit;

    rows.push({
      accountId: accId,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      nature: acc.nature,
      openingDebit,
      openingCredit,
      periodDebit: Math.round(period.debit * 100) / 100,
      periodCredit: Math.round(period.credit * 100) / 100,
      closingDebit,
      closingCredit,
    });
  }

  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;
  const difference = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;

  return {
    asOfDate: asOf,
    accounts: rows,
    totalDebit,
    totalCredit,
    isBalanced: difference <= 0.05,
    difference,
  };
}

export interface ReportLineItem {
  accountCode: string;
  accountName: string;
  amount: number;
  accountId?: string;
}

export interface ProfitAndLossResponse {
  startDate: Date;
  endDate: Date;
  revenue: {
    items: ReportLineItem[];
    totalRevenue: number;
  };
  costOfSales: {
    items: ReportLineItem[];
    totalCostOfSales: number;
  };
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: {
    categories: {
      categoryName: string;
      items: ReportLineItem[];
      total: number;
    }[];
    totalOperatingExpenses: number;
  };
  operatingProfit: number;
  operatingMarginPct: number;
  otherIncome: {
    items: ReportLineItem[];
    totalOtherIncome: number;
  };
  netProfit: number;
  netMarginPct: number;
}

export async function getProfitAndLoss(
  startDate?: Date | string,
  endDate?: Date | string,
  filters?: { costCenterId?: string; projectId?: string; clientId?: string }
): Promise<ProfitAndLossResponse> {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const fyYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const start = startDate ? new Date(new Date(startDate).setHours(0, 0, 0, 0)) : new Date(`${fyYear}-04-01T00:00:00.000Z`);
  const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date(new Date().setHours(23, 59, 59, 999));

  // Find all posted journal entries in period
  const matchQuery: any = {
    status: 'POSTED',
    date: { $gte: start, $lte: end },
  };

  const journals = await JournalEntry.find(matchQuery);

  const revenueAccounts = await ChartOfAccount.find({ type: 'REVENUE', isActive: true });
  const expenseAccounts = await ChartOfAccount.find({ type: 'EXPENSE', isActive: true });

  const accountBalances: Record<string, number> = {};

  for (const j of journals) {
    for (const l of j.lines) {
      if (filters?.costCenterId && l.costCenter?.toString() !== filters.costCenterId) continue;
      if (filters?.projectId && l.project?.toString() !== filters.projectId) continue;
      if (filters?.clientId && l.client?.toString() !== filters.clientId) continue;

      const accId = l.account.toString();
      accountBalances[accId] = (accountBalances[accId] || 0) + (l.credit - l.debit); // Revenue credit nature
    }
  }

  // 1. Revenues
  const revenueItems: ReportLineItem[] = [];
  let totalRevenue = 0;

  const otherIncomeItems: ReportLineItem[] = [];
  let totalOtherIncome = 0;

  for (const acc of revenueAccounts) {
    const rawVal = accountBalances[acc._id.toString()] || 0;
    const amount = Math.round(rawVal * 100) / 100;
    if (amount !== 0) {
      if (acc.subtype === 'OTHER_INCOME') {
        otherIncomeItems.push({ accountCode: acc.code, accountName: acc.name, amount, accountId: acc._id.toString() });
        totalOtherIncome += amount;
      } else {
        revenueItems.push({ accountCode: acc.code, accountName: acc.name, amount, accountId: acc._id.toString() });
        totalRevenue += amount;
      }
    }
  }

  // 2. Cost of Sales (Direct Expenses: 5100 series)
  const costOfSalesItems: ReportLineItem[] = [];
  let totalCostOfSales = 0;

  const expenseCategoriesMap: Record<string, { categoryName: string; items: ReportLineItem[]; total: number }> = {
    EMPLOYEE: { categoryName: 'Employee Compensation & Benefits', items: [], total: 0 },
    OFFICE: { categoryName: 'Office & Infrastructure Expenses', items: [], total: 0 },
    TECH: { categoryName: 'Technology & Cloud Subscriptions', items: [], total: 0 },
    SALES: { categoryName: 'Sales & Marketing Expenses', items: [], total: 0 },
    DEPRECIATION: { categoryName: 'Depreciation Expense', items: [], total: 0 },
    FINANCE: { categoryName: 'Finance & Bank Charges', items: [], total: 0 },
    GENERAL: { categoryName: 'Other Operating Expenses', items: [], total: 0 },
  };

  let totalOperatingExpenses = 0;

  for (const acc of expenseAccounts) {
    const rawVal = accountBalances[acc._id.toString()] || 0;
    const amount = Math.round(-rawVal * 100) / 100; // Invert to show positive expense (debit nature)
    if (amount !== 0) {
      const item: ReportLineItem = { accountCode: acc.code, accountName: acc.name, amount, accountId: acc._id.toString() };

      if (acc.subtype === 'DIRECT_EXPENSE') {
        costOfSalesItems.push(item);
        totalCostOfSales += amount;
      } else {
        totalOperatingExpenses += amount;
        if (acc.subtype === 'EMPLOYEE_EXPENSE') {
          expenseCategoriesMap.EMPLOYEE.items.push(item);
          expenseCategoriesMap.EMPLOYEE.total += amount;
        } else if (acc.subtype === 'OFFICE_EXPENSE') {
          expenseCategoriesMap.OFFICE.items.push(item);
          expenseCategoriesMap.OFFICE.total += amount;
        } else if (acc.subtype === 'TECH_EXPENSE') {
          expenseCategoriesMap.TECH.items.push(item);
          expenseCategoriesMap.TECH.total += amount;
        } else if (acc.subtype === 'SALES_EXPENSE') {
          expenseCategoriesMap.SALES.items.push(item);
          expenseCategoriesMap.SALES.total += amount;
        } else if (acc.subtype === 'DEPRECIATION_EXPENSE') {
          expenseCategoriesMap.DEPRECIATION.items.push(item);
          expenseCategoriesMap.DEPRECIATION.total += amount;
        } else if (acc.subtype === 'FINANCE_EXPENSE') {
          expenseCategoriesMap.FINANCE.items.push(item);
          expenseCategoriesMap.FINANCE.total += amount;
        } else {
          expenseCategoriesMap.GENERAL.items.push(item);
          expenseCategoriesMap.GENERAL.total += amount;
        }
      }
    }
  }

  totalRevenue = Math.round(totalRevenue * 100) / 100;
  totalCostOfSales = Math.round(totalCostOfSales * 100) / 100;
  const grossProfit = Math.round((totalRevenue - totalCostOfSales) * 100) / 100;
  const grossMarginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;

  totalOperatingExpenses = Math.round(totalOperatingExpenses * 100) / 100;
  const operatingProfit = Math.round((grossProfit - totalOperatingExpenses) * 100) / 100;
  const operatingMarginPct = totalRevenue > 0 ? Math.round((operatingProfit / totalRevenue) * 1000) / 10 : 0;

  totalOtherIncome = Math.round(totalOtherIncome * 100) / 100;
  const netProfit = Math.round((operatingProfit + totalOtherIncome) * 100) / 100;
  const netMarginPct = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0;

  const categories = Object.values(expenseCategoriesMap)
    .filter((c) => c.items.length > 0)
    .map((c) => ({ ...c, total: Math.round(c.total * 100) / 100 }));

  return {
    startDate: start,
    endDate: end,
    revenue: { items: revenueItems, totalRevenue },
    costOfSales: { items: costOfSalesItems, totalCostOfSales },
    grossProfit,
    grossMarginPct,
    operatingExpenses: { categories, totalOperatingExpenses },
    operatingProfit,
    operatingMarginPct,
    otherIncome: { items: otherIncomeItems, totalOtherIncome },
    netProfit,
    netMarginPct,
  };
}

export interface BalanceSheetSection {
  title: string;
  items: ReportLineItem[];
  subtotal: number;
}

export interface BalanceSheetResponse {
  asOfDate: Date;
  assets: {
    currentAssets: BalanceSheetSection;
    nonCurrentAssets: BalanceSheetSection;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: BalanceSheetSection;
    nonCurrentLiabilities: BalanceSheetSection;
    totalLiabilities: number;
  };
  equity: {
    capitalItems: ReportLineItem[];
    currentYearNetProfit: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  difference: number;
}

export async function getBalanceSheet(asOfDate?: Date | string): Promise<BalanceSheetResponse> {
  const asOf = asOfDate ? new Date(asOfDate) : new Date();

  // 1. Get Trial Balance as of date
  const tb = await getTrialBalance(asOf);

  // 2. Get Net Profit from P&L for Current Year
  const currentYear = asOf.getFullYear();
  const fyStart = new Date(`${asOf.getMonth() >= 3 ? currentYear : currentYear - 1}-04-01T00:00:00.000Z`);
  const pl = await getProfitAndLoss(fyStart, asOf);
  const currentYearNetProfit = pl.netProfit;

  const currentAssetItems: ReportLineItem[] = [];
  let currentAssetsSubtotal = 0;

  const nonCurrentAssetItems: ReportLineItem[] = [];
  let nonCurrentAssetsSubtotal = 0;

  const currentLiabItems: ReportLineItem[] = [];
  let currentLiabSubtotal = 0;

  const nonCurrentLiabItems: ReportLineItem[] = [];
  let nonCurrentLiabSubtotal = 0;

  const capitalItems: ReportLineItem[] = [];
  let capitalSubtotal = 0;

  for (const r of tb.accounts) {
    const netVal = r.closingDebit - r.closingCredit;

    if (r.type === 'ASSET') {
      const amount = Math.round(netVal * 100) / 100;
      const item: ReportLineItem = { accountCode: r.code, accountName: r.name, amount, accountId: r.accountId };
      if (['FIXED_ASSET', 'ACCUMULATED_DEPRECIATION', 'NON_CURRENT_ASSET'].includes(r.subtype)) {
        nonCurrentAssetItems.push(item);
        nonCurrentAssetsSubtotal += amount;
      } else {
        currentAssetItems.push(item);
        currentAssetsSubtotal += amount;
      }
    } else if (r.type === 'LIABILITY') {
      const amount = Math.round(-netVal * 100) / 100; // Credit nature positive
      const item: ReportLineItem = { accountCode: r.code, accountName: r.name, amount, accountId: r.accountId };
      if (['LOAN', 'NON_CURRENT_LIABILITY'].includes(r.subtype)) {
        nonCurrentLiabItems.push(item);
        nonCurrentLiabSubtotal += amount;
      } else {
        currentLiabItems.push(item);
        currentLiabSubtotal += amount;
      }
    } else if (r.type === 'EQUITY') {
      if (r.code !== '3030') {
        // Exclude dynamically calculated current year P&L placeholder
        const amount = Math.round(-netVal * 100) / 100;
        capitalItems.push({ accountCode: r.code, accountName: r.name, amount, accountId: r.accountId });
        capitalSubtotal += amount;
      }
    }
  }

  const totalAssets = Math.round((currentAssetsSubtotal + nonCurrentAssetsSubtotal) * 100) / 100;
  const totalLiabilities = Math.round((currentLiabSubtotal + nonCurrentLiabSubtotal) * 100) / 100;
  const totalEquity = Math.round((capitalSubtotal + currentYearNetProfit) * 100) / 100;
  const totalLiabilitiesAndEquity = Math.round((totalLiabilities + totalEquity) * 100) / 100;

  const difference = Math.round(Math.abs(totalAssets - totalLiabilitiesAndEquity) * 100) / 100;
  const isBalanced = difference <= 0.05;

  return {
    asOfDate: asOf,
    assets: {
      currentAssets: { title: 'Current Assets', items: currentAssetItems, subtotal: Math.round(currentAssetsSubtotal * 100) / 100 },
      nonCurrentAssets: { title: 'Non-Current / Fixed Assets', items: nonCurrentAssetItems, subtotal: Math.round(nonCurrentAssetsSubtotal * 100) / 100 },
      totalAssets,
    },
    liabilities: {
      currentLiabilities: { title: 'Current Liabilities', items: currentLiabItems, subtotal: Math.round(currentLiabSubtotal * 100) / 100 },
      nonCurrentLiabilities: { title: 'Long-Term Liabilities', items: nonCurrentLiabItems, subtotal: Math.round(nonCurrentLiabSubtotal * 100) / 100 },
      totalLiabilities,
    },
    equity: {
      capitalItems,
      currentYearNetProfit,
      totalEquity,
    },
    totalLiabilitiesAndEquity,
    isBalanced,
    difference,
  };
}

export interface AgingBucketItem {
  id: string;
  number: string;
  name: string; // Customer or Vendor name
  date: Date;
  dueDate: Date;
  totalAmount: number;
  balanceDue: number;
  daysOverdue: number;
}

export interface AgingReportResponse {
  asOfDate: Date;
  totalOutstanding: number;
  buckets: {
    current: number; // Not yet due
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
  };
  items: AgingBucketItem[];
}

export async function getARAgingReport(asOfDate?: Date | string): Promise<AgingReportResponse> {
  const now = asOfDate ? new Date(asOfDate) : new Date();
  const invoices = await Invoice.find({
    status: { $in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
    balanceDue: { $gt: 0 },
  }).populate('client', 'name');

  const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0 };
  let totalOutstanding = 0;
  const items: AgingBucketItem[] = [];

  for (const inv of invoices) {
    const dueTime = new Date(inv.dueDate).getTime();
    const diffDays = Math.floor((now.getTime() - dueTime) / (1000 * 3600 * 24));
    const bal = inv.balanceDue;
    totalOutstanding += bal;

    if (diffDays <= 0) buckets.current += bal;
    else if (diffDays <= 30) buckets.days1_30 += bal;
    else if (diffDays <= 60) buckets.days31_60 += bal;
    else if (diffDays <= 90) buckets.days61_90 += bal;
    else buckets.days90Plus += bal;

    items.push({
      id: inv._id.toString(),
      number: inv.invoiceNumber,
      name: (inv.client as any)?.name || 'Unknown Client',
      date: inv.invoiceDate,
      dueDate: inv.dueDate,
      totalAmount: inv.totalAmount,
      balanceDue: bal,
      daysOverdue: Math.max(0, diffDays),
    });
  }

  return {
    asOfDate: now,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    buckets: {
      current: Math.round(buckets.current * 100) / 100,
      days1_30: Math.round(buckets.days1_30 * 100) / 100,
      days31_60: Math.round(buckets.days31_60 * 100) / 100,
      days61_90: Math.round(buckets.days61_90 * 100) / 100,
      days90Plus: Math.round(buckets.days90Plus * 100) / 100,
    },
    items,
  };
}

export async function getAPAgingReport(asOfDate?: Date | string): Promise<AgingReportResponse> {
  const now = asOfDate ? new Date(asOfDate) : new Date();
  const bills = await Bill.find({
    status: { $in: ['APPROVED', 'PARTIALLY_PAID', 'OVERDUE'] },
    balanceDue: { $gt: 0 },
  }).populate('vendor', 'name');

  const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0 };
  let totalOutstanding = 0;
  const items: AgingBucketItem[] = [];

  for (const b of bills) {
    const dueTime = new Date(b.dueDate).getTime();
    const diffDays = Math.floor((now.getTime() - dueTime) / (1000 * 3600 * 24));
    const bal = b.balanceDue;
    totalOutstanding += bal;

    if (diffDays <= 0) buckets.current += bal;
    else if (diffDays <= 30) buckets.days1_30 += bal;
    else if (diffDays <= 60) buckets.days31_60 += bal;
    else if (diffDays <= 90) buckets.days61_90 += bal;
    else buckets.days90Plus += bal;

    items.push({
      id: b._id.toString(),
      number: b.billNumber,
      name: (b.vendor as any)?.name || 'Unknown Vendor',
      date: b.billDate,
      dueDate: b.dueDate,
      totalAmount: b.totalAmount,
      balanceDue: bal,
      daysOverdue: Math.max(0, diffDays),
    });
  }

  return {
    asOfDate: now,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    buckets: {
      current: Math.round(buckets.current * 100) / 100,
      days1_30: Math.round(buckets.days1_30 * 100) / 100,
      days31_60: Math.round(buckets.days31_60 * 100) / 100,
      days61_90: Math.round(buckets.days61_90 * 100) / 100,
      days90Plus: Math.round(buckets.days90Plus * 100) / 100,
    },
    items,
  };
}

export async function getExecutiveFinancialSummary() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const fyYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const fyStart = new Date(`${fyYear}-04-01T00:00:00.000Z`);
  const pl = await getProfitAndLoss(fyStart, new Date());
  const bs = await getBalanceSheet(new Date());
  const ar = await getARAgingReport();
  const ap = await getAPAgingReport();

  // Get cash & bank balances from Chart of Accounts GL
  const cashAccounts = await ChartOfAccount.find({ subtype: 'CASH', isActive: true });
  const totalCashBalance = cashAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const bankAccounts = await ChartOfAccount.find({ subtype: 'BANK', isActive: true });
  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  // Monthly Revenue & Expense trend (last 6 months)
  const monthlyTrends: { month: string; revenue: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    const mPL = await getProfitAndLoss(mStart, mEnd);
    monthlyTrends.push({
      month: mStart.toLocaleString('default', { month: 'short' }),
      revenue: mPL.revenue.totalRevenue,
      expense: mPL.operatingExpenses.totalOperatingExpenses + mPL.costOfSales.totalCostOfSales,
    });
  }

  return {
    kpis: {
      totalRevenue: pl.revenue.totalRevenue,
      totalExpenses: pl.operatingExpenses.totalOperatingExpenses + pl.costOfSales.totalCostOfSales,
      grossProfit: pl.grossProfit,
      grossMarginPct: pl.grossMarginPct,
      netProfit: pl.netProfit,
      netMarginPct: pl.netMarginPct,
      cashBalance: totalCashBalance,
      bankBalance: totalBankBalance,
      accountsReceivable: ar.totalOutstanding,
      accountsPayable: ap.totalOutstanding,
      workingCapital: Math.round((bs.assets.currentAssets.subtotal - bs.liabilities.currentLiabilities.subtotal) * 100) / 100,
      totalAssets: bs.assets.totalAssets,
      totalLiabilities: bs.liabilities.totalLiabilities,
      totalEquity: bs.equity.totalEquity,
    },
    arAging: ar.buckets,
    apAging: ap.buckets,
    monthlyTrends,
  };
}
