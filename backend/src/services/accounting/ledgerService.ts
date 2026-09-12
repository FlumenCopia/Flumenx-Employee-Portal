import mongoose from 'mongoose';
import { ChartOfAccount, IChartOfAccount } from '../../models/accounting/ChartOfAccount.js';
import { JournalEntry, IJournalEntry } from '../../models/accounting/JournalEntry.js';
import { BankAccount } from '../../models/accounting/Banking.js';
import { Client } from '../../models/Client.js';
import '../../models/Project.js';
import '../../models/Employee.js';
import '../../models/accounting/AccountingEntities.js';
import { Vendor } from '../../models/accounting/Vendor.js';

export interface LedgerTransactionRow {
  journalId: string;
  journalNumber: string;
  voucherType: string;
  date: Date;
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  clientName?: string;
  projectName?: string;
}

export interface GeneralLedgerResponse {
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    subtype: string;
    nature: string;
  };
  startDate: Date;
  endDate: Date;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  transactions: LedgerTransactionRow[];
}

export async function getGeneralLedger(
  accountId: string | mongoose.Types.ObjectId,
  startDate?: Date | string,
  endDate?: Date | string
): Promise<GeneralLedgerResponse> {
  const account = await ChartOfAccount.findById(accountId);
  if (!account) {
    throw new Error('Account not found.');
  }

  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
  const end = endDate ? new Date(endDate) : new Date();

  // 1. Calculate opening balance prior to startDate
  const priorJournals = await JournalEntry.find({
    status: 'POSTED',
    date: { $lt: start },
    'lines.account': account._id,
  });

  let priorDebit = 0;
  let priorCredit = 0;
  for (const j of priorJournals) {
    for (const l of j.lines) {
      if (l.account.toString() === account._id.toString()) {
        priorDebit += l.debit;
        priorCredit += l.credit;
      }
    }
  }

  let openingBalance = account.openingBalance || 0;
  if (account.nature === 'DEBIT') {
    openingBalance = Math.round((openingBalance + priorDebit - priorCredit) * 100) / 100;
  } else {
    openingBalance = Math.round((openingBalance + priorCredit - priorDebit) * 100) / 100;
  }

  // 2. Fetch period journals chronologically
  const periodJournals = await JournalEntry.find({
    status: 'POSTED',
    date: { $gte: start, $lte: end },
    'lines.account': account._id,
  })
    .sort({ date: 1, createdAt: 1 })
    .populate('lines.client', 'name')
    .populate('lines.project', 'name');

  const transactions: LedgerTransactionRow[] = [];
  let currentRunningBalance = openingBalance;
  let periodDebit = 0;
  let periodCredit = 0;

  for (const j of periodJournals) {
    for (const l of j.lines) {
      if (l.account.toString() === account._id.toString()) {
        const debit = l.debit;
        const credit = l.credit;
        periodDebit += debit;
        periodCredit += credit;

        if (account.nature === 'DEBIT') {
          currentRunningBalance = Math.round((currentRunningBalance + debit - credit) * 100) / 100;
        } else {
          currentRunningBalance = Math.round((currentRunningBalance + credit - debit) * 100) / 100;
        }

        transactions.push({
          journalId: j._id.toString(),
          journalNumber: j.journalNumber,
          voucherType: j.voucherType,
          date: j.date,
          referenceNumber: j.referenceNumber || '',
          description: l.description || j.description,
          debit,
          credit,
          runningBalance: currentRunningBalance,
          clientName: (l.client as any)?.name || '',
          projectName: (l.project as any)?.name || '',
        });
      }
    }
  }

  const closingBalance = currentRunningBalance;

  return {
    account: {
      id: account._id.toString(),
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      nature: account.nature,
    },
    startDate: start,
    endDate: end,
    openingBalance,
    periodDebit: Math.round(periodDebit * 100) / 100,
    periodCredit: Math.round(periodCredit * 100) / 100,
    closingBalance,
    transactions,
  };
}

export async function getCustomerLedger(clientId: string | mongoose.Types.ObjectId, startDate?: Date, endDate?: Date) {
  const client = await Client.findById(clientId);
  if (!client) throw new Error('Client not found.');

  const start = startDate || new Date(new Date().getFullYear(), 0, 1);
  const end = endDate || new Date();

  // Find all journals involving this client
  const journals = await JournalEntry.find({
    status: 'POSTED',
    date: { $gte: start, $lte: end },
    'lines.client': client._id,
  }).sort({ date: 1 });

  const rows: any[] = [];
  let runningBalance = 0; // Net receivable from customer (Debit nature)

  for (const j of journals) {
    for (const l of j.lines) {
      if (l.client && l.client.toString() === client._id.toString()) {
        const debit = l.debit;
        const credit = l.credit;
        runningBalance = Math.round((runningBalance + debit - credit) * 100) / 100;

        rows.push({
          date: j.date,
          voucherType: j.voucherType,
          journalNumber: j.journalNumber,
          referenceNumber: j.referenceNumber,
          description: l.description || j.description,
          invoiceAmount: debit, // Invoiced to customer
          receiptAmount: credit, // Paid by customer
          runningBalance,
        });
      }
    }
  }

  return {
    client: { id: client._id, name: client.name },
    startDate: start,
    endDate: end,
    closingBalance: runningBalance,
    statements: rows,
  };
}

export async function getVendorLedger(vendorId: string | mongoose.Types.ObjectId, startDate?: Date, endDate?: Date) {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw new Error('Vendor not found.');

  const start = startDate || new Date(new Date().getFullYear(), 0, 1);
  const end = endDate || new Date();

  const apAccount = await ChartOfAccount.findOne({ code: '2110' });
  if (!apAccount) throw new Error('Accounts Payable account (2110) not found.');

  // Find journals related to bills and payments for this vendor
  const journals = await JournalEntry.find({
    status: 'POSTED',
    date: { $gte: start, $lte: end },
    voucherType: { $in: ['PURCHASE', 'PAYMENT', 'DEBIT_NOTE', 'CREDIT_NOTE'] },
    'lines.account': apAccount._id,
  }).sort({ date: 1 });

  const rows: any[] = [];
  let runningBalance = 0; // Credit nature (Amount owed to vendor)

  for (const j of journals) {
    if (j.description.includes(vendor.name) || j.referenceNumber?.includes(vendor.code)) {
      for (const l of j.lines) {
        if (l.account.toString() === apAccount._id.toString()) {
          const debit = l.debit; // Payment made to vendor (reduces payable)
          const credit = l.credit; // Bill received from vendor (increases payable)
          runningBalance = Math.round((runningBalance + credit - debit) * 100) / 100;

          rows.push({
            date: j.date,
            voucherType: j.voucherType,
            journalNumber: j.journalNumber,
            referenceNumber: j.referenceNumber,
            description: l.description || j.description,
            billAmount: credit,
            paidAmount: debit,
            runningBalance,
          });
        }
      }
    }
  }

  return {
    vendor: { id: vendor._id, name: vendor.name, code: vendor.code },
    startDate: start,
    endDate: end,
    closingBalance: runningBalance,
    statements: rows,
  };
}
