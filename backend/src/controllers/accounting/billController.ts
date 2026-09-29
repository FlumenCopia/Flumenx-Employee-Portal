import { Request, Response } from 'express';
import { Bill } from '../../models/accounting/Bill.js';
import { JournalEntry } from '../../models/accounting/JournalEntry.js';
import { VendorPayment } from '../../models/accounting/VendorPayment.js';
import { AuditLog } from '../../models/AuditLog.js';
import { createAndPostBill } from '../../services/accounting/payableService.js';
import { revertJournalEntryBalances } from '../../services/accounting/accountingEngine.js';

export async function getBills(req: Request, res: Response): Promise<void> {
  const { vendor, status, search, start_date, end_date } = req.query;
  const filter: any = {};

  if (vendor) filter.vendor = vendor;
  if (status) filter.status = status;

  if (start_date || end_date) {
    filter.billDate = {};
    if (start_date) filter.billDate.$gte = new Date(start_date as string);
    if (end_date) filter.billDate.$lte = new Date(end_date as string);
  }

  if (search) {
    const sRegex = new RegExp(String(search), 'i');
    filter.$or = [
      { billNumber: sRegex },
      { vendorName: sRegex },
      { vendorReference: sRegex },
      { vendorInvoiceNumber: sRegex },
    ];
  }

  const bills = await Bill.find(filter)
    .sort({ billDate: -1, createdAt: -1 })
    .populate('vendor', 'name code taxId')
    .populate('journalEntry', 'journalNumber totalDebit status');

  res.json({
    count: bills.length,
    results: bills,
  });
}

export async function getBillById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const bill = await Bill.findById(id)
    .populate('vendor')
    .populate('lines.account', 'code name')
    .populate('lines.costCenter', 'code name')
    .populate('lines.project', 'name')
    .populate('journalEntry');

  if (!bill) {
    res.status(404).json({ detail: 'Bill not found.' });
    return;
  }
  res.json(bill);
}

export async function createBill(req: Request, res: Response): Promise<void> {
  try {
    const bill = await createAndPostBill(req.body, req.user?._id);
    res.status(201).json(bill);
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to record and post vendor bill.' });
  }
}

export async function updateBill(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { notes, vendorReference, vendorInvoiceNumber, dueDate, status } = req.body;

  try {
    const bill = await Bill.findById(id);
    if (!bill) {
      res.status(404).json({ detail: 'Bill not found.' });
      return;
    }

    if (notes !== undefined) bill.notes = notes;
    if (vendorReference !== undefined) bill.vendorReference = vendorReference;
    if (vendorInvoiceNumber !== undefined) bill.vendorInvoiceNumber = vendorInvoiceNumber;
    if (dueDate !== undefined) bill.dueDate = new Date(dueDate);
    if (status !== undefined && ['DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED'].includes(status)) {
      bill.status = status as any;
    }

    await bill.save();

    try {
      await AuditLog.create({
        actor: req.user?._id || null,
        action: 'BILL_UPDATED',
        entityType: 'Bill',
        entityId: String(bill._id),
        details: { billNumber: bill.billNumber, status: bill.status },
      });
    } catch (e) {
      // Non-blocking
    }

    res.json(bill);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to update bill.' });
  }
}

export async function deleteBill(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const bill = await Bill.findById(id);
    if (!bill) {
      res.status(404).json({ detail: 'Bill not found.' });
      return;
    }

    if (bill.amountPaid > 0) {
      res.status(400).json({
        detail: `Cannot delete bill ${bill.billNumber}: Payments (₹${bill.amountPaid.toFixed(2)}) have been applied to this bill. Delete or unallocate associated payments first.`,
      });
      return;
    }

    const linkedPayment = await VendorPayment.findOne({ 'allocations.bill': bill._id });
    if (linkedPayment) {
      res.status(400).json({
        detail: `Cannot delete bill ${bill.billNumber}: Payment ${linkedPayment.paymentNumber} references this bill. Delete payment or remove allocation first.`,
      });
      return;
    }

    if (bill.journalEntry) {
      const journal = await JournalEntry.findById(bill.journalEntry);
      if (journal) {
        await revertJournalEntryBalances(journal);
        await JournalEntry.findByIdAndDelete(journal._id);
      }
    }

    await Bill.findByIdAndDelete(id);

    try {
      await AuditLog.create({
        actor: req.user?._id || null,
        action: 'BILL_DELETED',
        entityType: 'Bill',
        entityId: String(bill._id),
        details: { billNumber: bill.billNumber, vendor: bill.vendorName, totalAmount: bill.totalAmount },
      });
    } catch (e) {
      // Non-blocking
    }

    res.json({ message: `Bill ${bill.billNumber} deleted successfully.`, id });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to delete bill.' });
  }
}

