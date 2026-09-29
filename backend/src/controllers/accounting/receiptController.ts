import { Request, Response } from 'express';
import { CustomerReceipt } from '../../models/accounting/CustomerReceipt.js';
import { Invoice } from '../../models/accounting/Invoice.js';
import { JournalEntry } from '../../models/accounting/JournalEntry.js';
import { AuditLog } from '../../models/AuditLog.js';
import { createAndPostReceipt } from '../../services/accounting/receivableService.js';
import { revertJournalEntryBalances } from '../../services/accounting/accountingEngine.js';

export async function getReceipts(req: Request, res: Response): Promise<void> {
  const { client, start_date, end_date, search } = req.query;
  const filter: any = {};

  if (client) filter.client = client;

  if (start_date || end_date) {
    filter.date = {};
    if (start_date) filter.date.$gte = new Date(start_date as string);
    if (end_date) filter.date.$lte = new Date(end_date as string);
  }

  if (search) {
    const sRegex = new RegExp(String(search), 'i');
    filter.$or = [
      { receiptNumber: sRegex },
      { clientName: sRegex },
      { clientReference: sRegex },
      { referenceNumber: sRegex },
    ];
  }

  const receipts = await CustomerReceipt.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .populate('client', 'name')
    .populate('depositAccount', 'code name')
    .populate('allocations.invoice', 'invoiceNumber totalAmount balanceDue')
    .populate('journalEntry', 'journalNumber totalDebit');

  res.json({
    count: receipts.length,
    results: receipts,
  });
}

export async function createReceipt(req: Request, res: Response): Promise<void> {
  try {
    const receipt = await createAndPostReceipt(req.body, req.user?._id);
    res.status(201).json(receipt);
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to record customer receipt.' });
  }
}

export async function deleteReceipt(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const receipt = await CustomerReceipt.findById(id);
    if (!receipt) {
      res.status(404).json({ detail: 'Receipt not found.' });
      return;
    }

    // Unallocate from invoices
    if (receipt.allocations && Array.isArray(receipt.allocations)) {
      for (const alloc of receipt.allocations) {
        if (alloc.invoice) {
          const inv = await Invoice.findById(alloc.invoice);
          if (inv) {
            inv.amountPaid = Math.max(0, Math.round((inv.amountPaid - (alloc.allocatedAmount || 0)) * 100) / 100);
            inv.balanceDue = Math.round((inv.totalAmount - inv.amountPaid) * 100) / 100;
            if (inv.amountPaid <= 0.01) {
              inv.status = 'SENT';
              inv.paidAt = undefined;
            } else {
              inv.status = 'PARTIALLY_PAID';
            }
            await inv.save();
          }
        }
      }
    }

    // Revert journal balances
    if (receipt.journalEntry) {
      const journal = await JournalEntry.findById(receipt.journalEntry);
      if (journal) {
        await revertJournalEntryBalances(journal);
        await JournalEntry.findByIdAndDelete(journal._id);
      }
    }

    await CustomerReceipt.findByIdAndDelete(id);

    try {
      await AuditLog.create({
        actor: req.user?._id || null,
        action: 'RECEIPT_DELETED',
        entityType: 'CustomerReceipt',
        entityId: String(receipt._id),
        details: { receiptNumber: receipt.receiptNumber, client: receipt.clientName, totalAmount: receipt.totalAmount },
      });
    } catch (e) {
      // Non-blocking
    }

    res.json({ message: `Receipt ${receipt.receiptNumber} deleted successfully.`, id });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to delete receipt.' });
  }
}

