import mongoose from 'mongoose';
import { ChartOfAccount, IChartOfAccount } from '../../models/accounting/ChartOfAccount.js';
import { JournalEntry, IJournalEntry, IJournalEntryLine, VoucherType, TransactionSourceType } from '../../models/accounting/JournalEntry.js';
import { Invoice } from '../../models/accounting/Invoice.js';
import { CustomerReceipt } from '../../models/accounting/CustomerReceipt.js';
import { Bill } from '../../models/accounting/Bill.js';
import { VendorPayment } from '../../models/accounting/VendorPayment.js';
import { ExpenseTransaction } from '../../models/accounting/ExpenseTransaction.js';
import { AuditLog } from '../../models/AuditLog.js';

export interface CreateJournalLineInput {
  accountId?: string | mongoose.Types.ObjectId;
  account?: string | mongoose.Types.ObjectId;
  debit: number;
  credit: number;
  description?: string;
  clientId?: string | mongoose.Types.ObjectId | null;
  projectId?: string | mongoose.Types.ObjectId | null;
  employeeId?: string | mongoose.Types.ObjectId | null;
  costCenterId?: string | mongoose.Types.ObjectId | null;
  partyType?: 'CLIENT' | 'VENDOR' | 'EMPLOYEE' | 'OTHER' | 'NONE';
  partyName?: string;
  partyReference?: string;
  reference?: string;
}

export interface PostJournalInput {
  date: Date;
  voucherType: VoucherType;
  referenceNumber?: string;
  sourceType?: TransactionSourceType;
  sourceId?: mongoose.Types.ObjectId | null;
  description: string;
  client?: string | mongoose.Types.ObjectId | null;
  clientName?: string;
  clientReference?: string;
  lines: CreateJournalLineInput[];
  userId?: mongoose.Types.ObjectId | null;
}

/**
 * Generate sequential formatted voucher number e.g. JV-2026-0001, INV-2026-0001
 */
export async function generateDocumentNumber(prefix: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const searchPattern = new RegExp(`^${prefix}-${currentYear}-\\d{4,}$`);

  let lastNumber = 0;
  if (prefix === 'JV') {
    const lastEntry = await JournalEntry.findOne({ journalNumber: searchPattern }).sort({ journalNumber: -1 });
    if (lastEntry) {
      const parts = lastEntry.journalNumber.split('-');
      lastNumber = parseInt(parts[2], 10) || 0;
    }
  } else if (prefix === 'INV') {
    const last = await Invoice.findOne({ invoiceNumber: searchPattern }).sort({ invoiceNumber: -1 });
    if (last) {
      const parts = last.invoiceNumber.split('-');
      lastNumber = parseInt(parts[2], 10) || 0;
    }
  } else if (prefix === 'RCP') {
    const last = await CustomerReceipt.findOne({ receiptNumber: searchPattern }).sort({ receiptNumber: -1 });
    if (last) {
      const parts = last.receiptNumber.split('-');
      lastNumber = parseInt(parts[2], 10) || 0;
    }
  } else if (prefix === 'BILL') {
    const last = await Bill.findOne({ billNumber: searchPattern }).sort({ billNumber: -1 });
    if (last) {
      const parts = last.billNumber.split('-');
      lastNumber = parseInt(parts[2], 10) || 0;
    }
  } else if (prefix === 'PMT') {
    const last = await VendorPayment.findOne({ paymentNumber: searchPattern }).sort({ paymentNumber: -1 });
    if (last) {
      const parts = last.paymentNumber.split('-');
      lastNumber = parseInt(parts[2], 10) || 0;
    }
  } else if (prefix === 'EXP') {
    const last = await ExpenseTransaction.findOne({ expenseNumber: searchPattern }).sort({ expenseNumber: -1 });
    if (last) {
      const parts = last.expenseNumber.split('-');
      lastNumber = parseInt(parts[2], 10) || 0;
    }
  } else {
    const lastEntry = await JournalEntry.findOne({ journalNumber: searchPattern }).sort({ journalNumber: -1 });
    if (lastEntry) {
      const parts = lastEntry.journalNumber.split('-');
      lastNumber = parseInt(parts[2], 10) || 0;
    }
  }

  const nextSeq = String(lastNumber + 1).padStart(4, '0');
  return `${prefix}-${currentYear}-${nextSeq}`;
}

/**
 * Validates and posts a balanced Double-Entry Journal Entry.
 * Updates running account balances atomically.
 */
export async function postJournalEntry(input: PostJournalInput): Promise<IJournalEntry> {
  let totalDebit = 0;
  let totalCredit = 0;

  const resolvedLines: IJournalEntryLine[] = [];

  for (const lineInput of input.lines) {
    const debit = Math.round(Number(lineInput.debit || 0) * 100) / 100;
    const credit = Math.round(Number(lineInput.credit || 0) * 100) / 100;

    if (debit < 0 || credit < 0) {
      throw new Error(`Invalid line amounts: Debit and credit must be non-negative numbers.`);
    }
    if (debit === 0 && credit === 0) {
      continue; // Skip zero balance lines
    }

    const targetAccountId = lineInput.accountId || (lineInput as any).account;
    const account = await ChartOfAccount.findById(targetAccountId);
    if (!account) {
      throw new Error(`Chart of Account not found for ID: ${targetAccountId}`);
    }
    if (!account.isActive) {
      throw new Error(`Account [${account.code}] ${account.name} is currently inactive and cannot receive postings.`);
    }

    totalDebit += debit;
    totalCredit += credit;

    resolvedLines.push({
      account: account._id as any,
      accountCode: account.code,
      accountName: account.name,
      debit,
      credit,
      description: lineInput.description || input.description,
      client: lineInput.clientId ? new mongoose.Types.ObjectId(lineInput.clientId as any) : null,
      project: lineInput.projectId ? new mongoose.Types.ObjectId(lineInput.projectId as any) : null,
      employee: lineInput.employeeId ? new mongoose.Types.ObjectId(lineInput.employeeId as any) : null,
      costCenter: lineInput.costCenterId ? new mongoose.Types.ObjectId(lineInput.costCenterId as any) : null,
      partyType: lineInput.partyType || (lineInput.clientId ? 'CLIENT' : 'NONE'),
      partyName: lineInput.partyName || input.clientName || '',
      partyReference: lineInput.partyReference || lineInput.reference || input.clientReference || '',
    });
  }

  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;

  if (resolvedLines.length < 2) {
    throw new Error(`Double-entry requires at least two lines (at least one debit and one credit).`);
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Double-Entry Invariant Violation: Total Debits (₹${totalDebit.toFixed(2)}) must equal Total Credits (₹${totalCredit.toFixed(2)}). Difference: ₹${Math.abs(totalDebit - totalCredit).toFixed(2)}`
    );
  }

  const journalNumber = await generateDocumentNumber(input.voucherType === 'JOURNAL' ? 'JV' : input.voucherType);

  const journal = new JournalEntry({
    journalNumber,
    date: input.date || new Date(),
    voucherType: input.voucherType,
    referenceNumber: input.referenceNumber || '',
    client: input.client && mongoose.Types.ObjectId.isValid(input.client) ? new mongoose.Types.ObjectId(input.client as any) : null,
    clientName: input.clientName || '',
    clientReference: input.clientReference || '',
    sourceType: input.sourceType || 'MANUAL',
    sourceId: input.sourceId || null,
    description: input.description,
    status: 'POSTED',
    totalDebit,
    totalCredit,
    lines: resolvedLines,
    createdBy: input.userId || null,
    approvedBy: input.userId || null,
    postedAt: new Date(),
  });

  await journal.save();

  // Update account balances
  for (const line of resolvedLines) {
    const acc = await ChartOfAccount.findById(line.account);
    if (acc) {
      acc.totalDebit = Math.round((acc.totalDebit + line.debit) * 100) / 100;
      acc.totalCredit = Math.round((acc.totalCredit + line.credit) * 100) / 100;

      if (acc.nature === 'DEBIT') {
        acc.currentBalance = Math.round((acc.currentBalance + line.debit - line.credit) * 100) / 100;
      } else {
        acc.currentBalance = Math.round((acc.currentBalance + line.credit - line.debit) * 100) / 100;
      }
      await acc.save();
    }
  }

  // Record audit log
  try {
    await AuditLog.create({
      user: input.userId || null,
      action: 'POST_JOURNAL_ENTRY',
      module: 'ACCOUNTING',
      details: `Posted ${input.voucherType} ${journalNumber} for ₹${totalDebit.toFixed(2)} - ${input.description}`,
    });
  } catch (err) {
    // Non-blocking
  }

  return journal;
}

/**
 * Reverses a posted journal entry by generating an exact opposite reversal journal.
 */
export async function reverseJournalEntry(
  journalId: string | mongoose.Types.ObjectId,
  reason: string,
  userId?: mongoose.Types.ObjectId | null
): Promise<IJournalEntry> {
  const original = await JournalEntry.findById(journalId);
  if (!original) {
    throw new Error('Original journal entry not found.');
  }
  if (original.status !== 'POSTED') {
    throw new Error(`Cannot reverse journal entry with status '${original.status}'. Only POSTED entries can be reversed.`);
  }
  if (original.isReversed) {
    throw new Error(`Journal entry ${original.journalNumber} has already been reversed.`);
  }

  // Create opposite lines
  const reversalLines: CreateJournalLineInput[] = original.lines.map((l) => ({
    accountId: l.account,
    debit: l.credit, // Invert
    credit: l.debit, // Invert
    description: `Reversal: ${l.description || original.description}`,
    clientId: l.client,
    projectId: l.project,
    employeeId: l.employee,
    costCenterId: l.costCenter,
  }));

  const reversalJournal = await postJournalEntry({
    date: new Date(),
    voucherType: 'ADJUSTMENT',
    referenceNumber: `REV-${original.journalNumber}`,
    sourceType: original.sourceType,
    sourceId: original._id as any,
    description: `Reversal of ${original.journalNumber}: ${reason}`,
    lines: reversalLines,
    userId,
  });

  original.isReversed = true;
  original.reversalJournal = reversalJournal._id as any;
  original.reversalReason = reason;
  await original.save();

  reversalJournal.reversalOf = original._id as any;
  await reversalJournal.save();

  return reversalJournal;
}
