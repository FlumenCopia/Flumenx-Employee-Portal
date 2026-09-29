import { Request, Response } from 'express';
import { ExpenseTransaction } from '../../models/accounting/ExpenseTransaction.js';
import { ChartOfAccount } from '../../models/accounting/ChartOfAccount.js';
import { JournalEntry } from '../../models/accounting/JournalEntry.js';
import { AuditLog } from '../../models/AuditLog.js';
import { postJournalEntry, generateDocumentNumber, CreateJournalLineInput, revertJournalEntryBalances } from '../../services/accounting/accountingEngine.js';

export async function getExpenses(req: Request, res: Response): Promise<void> {
  const { category, status, employee, vendor, start_date, end_date, search } = req.query;
  const filter: any = {};

  if (category) filter.category = category;
  if (status) filter.approvalStatus = status;
  if (employee) filter.employee = employee;
  if (vendor) filter.vendor = vendor;

  if (start_date || end_date) {
    filter.date = {};
    if (start_date) filter.date.$gte = new Date(start_date as string);
    if (end_date) filter.date.$lte = new Date(end_date as string);
  }

  if (search) {
    filter.$or = [
      { expenseNumber: new RegExp(String(search), 'i') },
      { title: new RegExp(String(search), 'i') },
      { description: new RegExp(String(search), 'i') },
    ];
  }

  const expenses = await ExpenseTransaction.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .populate('expenseAccount', 'code name')
    .populate('paidFromAccount', 'code name')
    .populate('vendor', 'name')
    .populate('employee', 'name employeeCode')
    .populate('project', 'name')
    .populate('costCenter', 'code name')
    .populate('journalEntry', 'journalNumber totalDebit');

  res.json({
    count: expenses.length,
    results: expenses,
  });
}

export async function createExpense(req: Request, res: Response): Promise<void> {
  const {
    date,
    title,
    category,
    expenseAccount,
    paidFromAccount,
    vendor,
    employee,
    project,
    client,
    costCenter,
    subtotal,
    taxRate,
    taxAmount,
    paymentMethod,
    referenceNumber,
    receiptUrl,
    description,
    autoPost,
  } = req.body;

  if (!title || !category || !expenseAccount || !paidFromAccount || subtotal === undefined) {
    res.status(400).json({ detail: 'Title, category, expense account, paid from account, and subtotal are mandatory.' });
    return;
  }

  try {
    const expenseNumber = await generateDocumentNumber('EXP');
    const sub = Math.round(Number(subtotal) * 100) / 100;
    const tax = Math.round(Number(taxAmount || 0) * 100) / 100;
    const total = Math.round((sub + tax) * 100) / 100;

    const expense = new ExpenseTransaction({
      expenseNumber,
      date: date ? new Date(date) : new Date(),
      title: title.trim(),
      category: category.trim(),
      expenseAccount,
      paidFromAccount,
      vendor: vendor || null,
      employee: employee || null,
      project: project || null,
      client: client || null,
      costCenter: costCenter || null,
      subtotal: sub,
      taxRate: taxRate || null,
      taxAmount: tax,
      totalAmount: total,
      paymentMethod: paymentMethod || 'BANK_TRANSFER',
      referenceNumber: referenceNumber || '',
      receiptUrl: receiptUrl || '',
      description: description || '',
      approvalStatus: autoPost ? 'POSTED' : 'SUBMITTED',
      createdBy: req.user?._id,
    });

    if (autoPost) {
      const journalLines: CreateJournalLineInput[] = [
        {
          accountId: expenseAccount,
          debit: sub,
          credit: 0,
          description: `${title} - ${category}`,
          projectId: project,
          clientId: client,
          employeeId: employee,
          costCenterId: costCenter,
        },
      ];

      if (tax > 0) {
        const inputTaxAcc = await ChartOfAccount.findOne({ code: '2155' });
        if (inputTaxAcc) {
          journalLines.push({
            accountId: inputTaxAcc._id as any,
            debit: tax,
            credit: 0,
            description: `GST Input Tax for ${expenseNumber}`,
          });
        }
      }

      journalLines.push({
        accountId: paidFromAccount,
        debit: 0,
        credit: total,
        description: `Paid via ${expense.paymentMethod} (${expenseNumber})`,
      });

      const journal = await postJournalEntry({
        date: expense.date,
        voucherType: 'PAYMENT',
        referenceNumber: expenseNumber,
        sourceType: 'EXPENSE',
        sourceId: expense._id as any,
        description: `Expense: ${title} (${category})`,
        lines: journalLines,
        userId: req.user?._id,
      });

      expense.journalEntry = journal._id as any;
      expense.approvedBy = req.user?._id;
      expense.approvedAt = new Date();
    }

    await expense.save();
    res.status(201).json(expense);
  } catch (err: any) {
    res.status(400).json({ detail: err.message || 'Failed to record expense.' });
  }
}

export async function updateExpense(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { title, category, description, referenceNumber, paymentMethod } = req.body;

  try {
    const expense = await ExpenseTransaction.findById(id);
    if (!expense) {
      res.status(404).json({ detail: 'Expense not found.' });
      return;
    }

    if (title !== undefined) expense.title = title.trim();
    if (category !== undefined) expense.category = category.trim();
    if (description !== undefined) expense.description = description;
    if (referenceNumber !== undefined) expense.referenceNumber = referenceNumber;
    if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;

    await expense.save();

    try {
      await AuditLog.create({
        actor: req.user?._id || null,
        action: 'EXPENSE_UPDATED',
        entityType: 'ExpenseTransaction',
        entityId: String(expense._id),
        details: { expenseNumber: expense.expenseNumber, title: expense.title },
      });
    } catch (e) {
      // Non-blocking
    }

    res.json(expense);
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to update expense.' });
  }
}

export async function deleteExpense(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const expense = await ExpenseTransaction.findById(id);
    if (!expense) {
      res.status(404).json({ detail: 'Expense not found.' });
      return;
    }

    if (expense.journalEntry) {
      const journal = await JournalEntry.findById(expense.journalEntry);
      if (journal) {
        await revertJournalEntryBalances(journal);
        await JournalEntry.findByIdAndDelete(journal._id);
      }
    }

    await ExpenseTransaction.findByIdAndDelete(id);

    try {
      await AuditLog.create({
        actor: req.user?._id || null,
        action: 'EXPENSE_DELETED',
        entityType: 'ExpenseTransaction',
        entityId: String(expense._id),
        details: { expenseNumber: expense.expenseNumber, title: expense.title, totalAmount: expense.totalAmount },
      });
    } catch (e) {
      // Non-blocking
    }

    res.json({ message: `Expense ${expense.expenseNumber} deleted successfully.`, id });
  } catch (err: any) {
    res.status(500).json({ detail: err.message || 'Failed to delete expense.' });
  }
}

