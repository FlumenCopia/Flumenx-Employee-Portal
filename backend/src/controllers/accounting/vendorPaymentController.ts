import { Request, Response } from 'express';
import { VendorPayment } from '../../models/accounting/VendorPayment.js';
import { createAndPostVendorPayment } from '../../services/accounting/payableService.js';

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
