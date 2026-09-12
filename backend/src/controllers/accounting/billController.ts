import { Request, Response } from 'express';
import { Bill } from '../../models/accounting/Bill.js';
import { createAndPostBill } from '../../services/accounting/payableService.js';

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
