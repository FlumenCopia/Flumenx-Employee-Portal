import { Request, Response } from 'express';
import { BankAccount, BankTransaction, BankReconciliation } from '../../models/accounting/Banking.js';
import { ChartOfAccount } from '../../models/accounting/ChartOfAccount.js';

export async function getBankAccounts(req: Request, res: Response): Promise<void> {
  const accounts = await BankAccount.find({ isActive: true }).populate('glAccount', 'code name currentBalance');
  res.json({
    count: accounts.length,
    results: accounts,
  });
}

export async function createBankAccount(req: Request, res: Response): Promise<void> {
  const { accountName, bankName, accountNumber, ifscSwift, branchName, accountType, glAccount, openingBalance } = req.body;

  if (!accountName || !bankName || !accountNumber || !glAccount) {
    res.status(400).json({ detail: 'Account name, bank name, account number, and GL Account are mandatory.' });
    return;
  }

  const opBal = Number(openingBalance || 0);

  const bank = new BankAccount({
    accountName: accountName.trim(),
    bankName: bankName.trim(),
    accountNumber: accountNumber.trim(),
    ifscSwift: ifscSwift || '',
    branchName: branchName || '',
    accountType: accountType || 'CURRENT',
    glAccount,
    openingBalance: opBal,
    currentBalance: opBal,
    isActive: true,
  });

  await bank.save();
  res.status(201).json(bank);
}

export async function getBankTransactions(req: Request, res: Response): Promise<void> {
  const bankAccountId = (req.query.bankAccountId || req.query.bank_account_id) as string;
  const reconciliationStatus = (req.query.reconciliationStatus || req.query.reconciliation_status) as string;
  const filter: any = {};

  if (bankAccountId) filter.bankAccount = bankAccountId;
  if (reconciliationStatus) filter.reconciliationStatus = reconciliationStatus;

  const transactions = await BankTransaction.find(filter).sort({ date: -1, createdAt: -1 });
  res.json({
    count: transactions.length,
    results: transactions,
  });
}

export async function createBankTransaction(req: Request, res: Response): Promise<void> {
  const { bankAccount, date, description, referenceNumber, withdrawalAmount, depositAmount } = req.body;

  if (!bankAccount || !description) {
    res.status(400).json({ detail: 'Bank account and description are mandatory.' });
    return;
  }

  const tx = new BankTransaction({
    bankAccount,
    date: date ? new Date(date) : new Date(),
    description: description.trim(),
    referenceNumber: referenceNumber || '',
    withdrawalAmount: Number(withdrawalAmount || 0),
    depositAmount: Number(depositAmount || 0),
    reconciliationStatus: 'UNRECONCILED',
  });

  await tx.save();
  res.status(201).json(tx);
}

export async function reconcileBankStatement(req: Request, res: Response): Promise<void> {
  const { bankAccountId, statementDate, statementClosingBalance, reconciledTransactionIds, notes } = req.body;

  if (!bankAccountId || statementClosingBalance === undefined) {
    res.status(400).json({ detail: 'bankAccountId and statementClosingBalance are mandatory.' });
    return;
  }

  const bank = await BankAccount.findById(bankAccountId).populate('glAccount');
  if (!bank) {
    res.status(404).json({ detail: 'Bank account not found.' });
    return;
  }

  const systemClosingBalance = (bank.glAccount as any)?.currentBalance || bank.currentBalance || 0;
  const stmtBal = Number(statementClosingBalance);

  // Mark transactions as reconciled
  if (reconciledTransactionIds && Array.isArray(reconciledTransactionIds) && reconciledTransactionIds.length > 0) {
    await BankTransaction.updateMany(
      { _id: { $in: reconciledTransactionIds } },
      { $set: { reconciliationStatus: 'RECONCILED', reconciledAt: new Date() } }
    );
  }

  const diff = Math.round(Math.abs(stmtBal - systemClosingBalance) * 100) / 100;

  const recon = new BankReconciliation({
    bankAccount: bank._id,
    statementDate: statementDate ? new Date(statementDate) : new Date(),
    statementClosingBalance: stmtBal,
    systemClosingBalance,
    reconciledBalance: stmtBal,
    difference: diff,
    status: diff <= 0.05 ? 'RECONCILED' : 'IN_PROGRESS',
    reconciledBy: req.user?._id,
    reconciledAt: new Date(),
    notes: notes || '',
  });

  await recon.save();

  res.json({
    message: diff <= 0.05 ? 'Bank reconciliation balanced successfully.' : 'Reconciliation saved with discrepancies.',
    reconciliation: recon,
  });
}
