import { Request, Response } from 'express';
import { CustomerReceipt } from '../../models/accounting/CustomerReceipt.js';
import { createAndPostReceipt } from '../../services/accounting/receivableService.js';

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
