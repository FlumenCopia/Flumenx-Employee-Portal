import { Request, Response } from 'express';
import { JournalEntry } from '../../models/accounting/JournalEntry.js';
import { postJournalEntry, reverseJournalEntry } from '../../services/accounting/accountingEngine.js';

export async function getJournalEntries(req: Request, res: Response): Promise<void> {
  const { status, voucher_type, start_date, end_date, search } = req.query;
  const filter: any = {};

  if (status) filter.status = status;
  if (voucher_type) filter.voucherType = voucher_type;

  if (start_date || end_date) {
    filter.date = {};
    if (start_date) filter.date.$gte = new Date(start_date as string);
    if (end_date) filter.date.$lte = new Date(end_date as string);
  }

  if (search) {
    const sRegex = new RegExp(String(search), 'i');
    filter.$or = [
      { journalNumber: sRegex },
      { description: sRegex },
      { referenceNumber: sRegex },
      { clientName: sRegex },
      { clientReference: sRegex },
      { 'lines.partyName': sRegex },
      { 'lines.partyReference': sRegex },
    ];
  }

  const entries = await JournalEntry.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .populate('client', 'name')
    .populate('createdBy', 'username')
    .populate('approvedBy', 'username');

  res.json({
    count: entries.length,
    results: entries,
  });
}

export async function getJournalEntryById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const entry = await JournalEntry.findById(id)
    .populate('client', 'name')
    .populate('lines.account', 'code name type nature')
    .populate('lines.client', 'name')
    .populate('lines.project', 'name')
    .populate('lines.employee', 'name employeeCode')
    .populate('lines.costCenter', 'code name')
    .populate('createdBy', 'username')
    .populate('approvedBy', 'username')
    .populate('reversalJournal', 'journalNumber date totalDebit');

  if (!entry) {
    res.status(404).json({ detail: 'Journal entry not found.' });
    return;
  }
  res.json(entry);
}

export async function createManualJournal(req: Request, res: Response): Promise<void> {
  const { date, voucherType, referenceNumber, description, lines, client, clientName, clientReference } = req.body;

  if (!description || !lines || !Array.isArray(lines) || lines.length < 2) {
    res.status(400).json({ detail: 'Description and at least two line items (debit and credit) are required.' });
    return;
  }

  try {
    const journal = await postJournalEntry({
      date: date ? new Date(date) : new Date(),
      voucherType: voucherType || 'JOURNAL',
      referenceNumber: referenceNumber || '',
      client: client || null,
      clientName: clientName || '',
      clientReference: clientReference || '',
      sourceType: 'MANUAL',
      description: description.trim(),
      lines,
      userId: req.user?._id,
    });

    res.status(201).json(journal);
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to post journal entry.' });
  }
}

export async function reverseJournal(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || String(reason).trim().length < 3) {
    res.status(400).json({ detail: 'A detailed reason (minimum 3 characters) is required to reverse a journal entry.' });
    return;
  }

  try {
    const reversal = await reverseJournalEntry(id, reason.trim(), req.user?._id);
    res.json({
      message: 'Journal entry successfully reversed.',
      reversalJournal: reversal,
    });
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to reverse journal entry.' });
  }
}
