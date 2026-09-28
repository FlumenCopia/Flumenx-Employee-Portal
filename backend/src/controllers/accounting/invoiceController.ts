import { Request, Response } from 'express';
import { Invoice } from '../../models/accounting/Invoice.js';
import { JournalEntry } from '../../models/accounting/JournalEntry.js';
import { CustomerReceipt } from '../../models/accounting/CustomerReceipt.js';
import { AuditLog } from '../../models/AuditLog.js';
import { createAndPostInvoice } from '../../services/accounting/receivableService.js';
import { revertJournalEntryBalances } from '../../services/accounting/accountingEngine.js';

export async function getInvoices(req: Request, res: Response): Promise<void> {
  const { client, status, search, start_date, end_date } = req.query;
  const filter: any = {};

  if (client) filter.client = client;
  if (status) filter.status = status;

  if (start_date || end_date) {
    filter.invoiceDate = {};
    if (start_date) filter.invoiceDate.$gte = new Date(start_date as string);
    if (end_date) filter.invoiceDate.$lte = new Date(end_date as string);
  }

  if (search) {
    const sRegex = new RegExp(String(search), 'i');
    filter.$or = [
      { invoiceNumber: sRegex },
      { clientName: sRegex },
      { clientReference: sRegex },
      { notes: sRegex },
    ];
  }

  const invoices = await Invoice.find(filter)
    .sort({ invoiceDate: -1, createdAt: -1 })
    .populate('client', 'name industry')
    .populate('project', 'name')
    .populate('journalEntry', 'journalNumber totalDebit status');

  res.json({
    count: invoices.length,
    results: invoices,
  });
}

export async function getInvoiceById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const invoice = await Invoice.findById(id)
    .populate('client')
    .populate('project')
    .populate('lines.account', 'code name')
    .populate('journalEntry');

  if (!invoice) {
    res.status(404).json({ detail: 'Invoice not found.' });
    return;
  }
  res.json(invoice);
}

export async function createInvoice(req: Request, res: Response): Promise<void> {
  try {
    const invoice = await createAndPostInvoice(req.body, req.user?._id);
    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to create and post invoice.' });
  }
}

export async function deleteInvoice(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      res.status(404).json({ detail: 'Invoice not found.' });
      return;
    }

    if (invoice.amountPaid > 0) {
      res.status(400).json({
        detail: `Cannot delete invoice ${invoice.invoiceNumber}: Customer payments (₹${invoice.amountPaid.toFixed(2)}) have been applied to this invoice. Delete or unallocate associated customer receipts first.`,
      });
      return;
    }

    const linkedReceipt = await CustomerReceipt.findOne({ 'allocations.invoice': invoice._id });
    if (linkedReceipt) {
      res.status(400).json({
        detail: `Cannot delete invoice ${invoice.invoiceNumber}: Receipt ${linkedReceipt.receiptNumber} references this invoice. Delete or remove allocation from receipt first.`,
      });
      return;
    }

    if (invoice.journalEntry) {
      const journal = await JournalEntry.findById(invoice.journalEntry);
      if (journal) {
        await revertJournalEntryBalances(journal);
        await JournalEntry.findByIdAndDelete(journal._id);
      }
    }

    await Invoice.findByIdAndDelete(id);

    try {
      await AuditLog.create({
        user: req.user?._id || null,
        action: 'DELETE_INVOICE',
        module: 'ACCOUNTING',
        details: `Super Admin permanently deleted invoice ${invoice.invoiceNumber} for client ${invoice.clientName} (₹${invoice.totalAmount}). Reverted General Ledger postings.`,
      });
    } catch (e) {
      // Non-blocking
    }

    res.json({ message: `Invoice ${invoice.invoiceNumber} deleted successfully.`, id });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to delete invoice.' });
  }
}

