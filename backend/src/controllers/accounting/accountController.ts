import { Request, Response } from 'express';
import { ChartOfAccount } from '../../models/accounting/ChartOfAccount.js';
import { postJournalEntry } from '../../services/accounting/accountingEngine.js';

export async function getAccounts(req: Request, res: Response): Promise<void> {
  const { type, subtype, is_active } = req.query;
  const filter: any = {};

  if (type) filter.type = type;
  if (subtype) filter.subtype = subtype;
  if (is_active !== undefined) filter.isActive = is_active === 'true';

  const accounts = await ChartOfAccount.find(filter).sort({ code: 1 }).populate('parentAccount', 'code name');
  res.json({
    count: accounts.length,
    results: accounts,
  });
}

export async function getAccountById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const account = await ChartOfAccount.findById(id).populate('parentAccount', 'code name');
  if (!account) {
    res.status(404).json({ detail: 'Account not found.' });
    return;
  }
  res.json(account);
}

export async function createAccount(req: Request, res: Response): Promise<void> {
  const { code, name, type, subtype, parentAccount, nature, openingBalance, description } = req.body;

  if (!code || !name || !type || !subtype || !nature) {
    res.status(400).json({ detail: 'Code, name, type, subtype, and nature are mandatory fields.' });
    return;
  }

  const existing = await ChartOfAccount.findOne({ code: code.trim() });
  if (existing) {
    res.status(400).json({ detail: `Account code ${code} already exists in Chart of Accounts.` });
    return;
  }

  const opBal = Math.abs(Number(openingBalance || 0));

  const account = new ChartOfAccount({
    code: code.trim(),
    name: name.trim(),
    type,
    subtype,
    parentAccount: parentAccount || null,
    nature,
    openingBalance: opBal,
    currentBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    description: description || '',
    isActive: true,
    isSystemAccount: false,
  });

  await account.save();

  if (opBal > 0) {
    const equityAcc = await ChartOfAccount.findOne({ code: '3010' }) || await ChartOfAccount.findOne({ type: 'EQUITY' });
    if (equityAcc) {
      const isDebit = nature === 'DEBIT';
      try {
        await postJournalEntry({
          date: new Date(),
          voucherType: 'JOURNAL',
          description: `Opening Balance for ${account.code} - ${account.name}`,
          referenceNumber: `OPBAL-${account.code}`,
          lines: [
            {
              account: account._id,
              debit: isDebit ? opBal : 0,
              credit: isDebit ? 0 : opBal,
              description: `Opening balance for ${account.name}`,
            },
            {
              account: equityAcc._id,
              debit: isDebit ? 0 : opBal,
              credit: isDebit ? opBal : 0,
              description: `Equity offset for opening balance of ${account.code}`,
            },
          ],
        });
      } catch (err) {
        console.error(`[createAccount] Warning: Could not post opening balance journal:`, err);
      }
    }
  }

  const refreshed = await ChartOfAccount.findById(account._id);
  res.status(201).json(refreshed || account);
}

export async function updateAccount(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, description, isActive } = req.body;

  const account = await ChartOfAccount.findById(id);
  if (!account) {
    res.status(404).json({ detail: 'Account not found.' });
    return;
  }

  if (name) account.name = name.trim();
  if (description !== undefined) account.description = description;
  if (isActive !== undefined) {
    if (account.isSystemAccount && !isActive) {
      res.status(400).json({ detail: 'System protected accounts cannot be deactivated.' });
      return;
    }
    account.isActive = Boolean(isActive);
  }

  await account.save();
  res.json(account);
}
