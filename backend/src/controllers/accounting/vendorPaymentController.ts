import { Request, Response } from 'express';
import { VendorPayment } from '../../models/accounting/VendorPayment.js';
import { Bill } from '../../models/accounting/Bill.js';
import { JournalEntry } from '../../models/accounting/JournalEntry.js';
import { AuditLog } from '../../models/AuditLog.js';
import { createAndPostVendorPayment } from '../../services/accounting/payableService.js';
import { revertJournalEntryBalances } from '../../services/accounting/accountingEngine.js';

export async function getVendorPayments(req: Request, res: Response): Promise<void> {
  const { vendor, start_date, end_date, search } = req.query;
  const filter: any = {};

  if (vendor) filter.vendor = vendor;

  if (start_date || end_date) {
    filter.date = {};
    if (start_date) filter.date.$gte = new Date(start_date as string);
    if (end_date) filter.date.$lte = new Date(end_date as string);
  }

  if (search) {
    const sRegex = new RegExp(String(search), 'i');
    filter.$or = [
      { paymentNumber: sRegex },
      { vendorName: sRegex },
      { vendorReference: sRegex },
      { referenceNumber: sRegex },
    ];
  }

  const payments = await VendorPayment.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .populate('vendor', 'name code')
    .populate('paidFromAccount', 'code name')
    .populate('allocations.bill', 'billNumber totalAmount balanceDue')
    .populate('journalEntry', 'journalNumber totalDebit');

  res.json({
    count: payments.length,
    results: payments,
  });
}

export async function createVendorPayment(req: Request, res: Response): Promise<void> {
  try {
    const payment = await createAndPostVendorPayment(req.body, req.user?._id);
    res.status(201).json(payment);
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to record vendor payment.' });
  }
}

export async function deleteVendorPayment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const payment = await VendorPayment.findById(id);
    if (!payment) {
      res.status(404).json({ detail: 'Vendor payment not found.' });
      return;
    }

    // Unallocate from bills
    if (payment.allocations && Array.isArray(payment.allocations)) {
      for (const alloc of payment.allocations) {
        if (alloc.bill) {
          const bill = await Bill.findById(alloc.bill);
          if (bill) {
            bill.amountPaid = Math.max(0, Math.round((bill.amountPaid - (alloc.allocatedAmount || 0)) * 100) / 100);
            bill.balanceDue = Math.round((bill.totalAmount - bill.amountPaid) * 100) / 100;
            if (bill.amountPaid <= 0.01) {
              bill.status = 'APPROVED';
            } else {
              bill.status = 'PARTIALLY_PAID';
            }
            await bill.save();
          }
        }
      }
    }

    // Revert journal balances
    if (payment.journalEntry) {
      const journal = await JournalEntry.findById(payment.journalEntry);
      if (journal) {
        await revertJournalEntryBalances(journal);
        await JournalEntry.findByIdAndDelete(journal._id);
      }
    }

    await VendorPayment.findByIdAndDelete(id);

    try {
      await AuditLog.create({
        actor: req.user?._id || null,
        action: 'VENDOR_PAYMENT_DELETED',
        entityType: 'VendorPayment',
        entityId: String(payment._id),
        details: { paymentNumber: payment.paymentNumber, vendor: payment.vendorName, totalAmount: payment.totalAmount },
      });
    } catch (e) {
      // Non-blocking
    }

    res.json({ message: `Vendor payment ${payment.paymentNumber} deleted successfully.`, id });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to delete vendor payment.' });
  }
}

