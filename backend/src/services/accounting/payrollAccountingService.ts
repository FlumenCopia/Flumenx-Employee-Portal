import mongoose from 'mongoose';
import { IPayrollRecord } from '../../models/PayrollRecord.js';
import { ChartOfAccount } from '../../models/accounting/ChartOfAccount.js';
import { BankAccount } from '../../models/accounting/Banking.js';
import { postJournalEntry, CreateJournalLineInput } from './accountingEngine.js';

export async function postPayrollAccrualJournal(
  payrollRecord: IPayrollRecord,
  userId?: mongoose.Types.ObjectId | null
) {
  // 1. Resolve required Chart of Accounts
  const salaryExpenseAcc = await ChartOfAccount.findOne({ code: '5210' }); // Salaries & Wages
  const employerPfAcc = await ChartOfAccount.findOne({ code: '5220' }); // Employer PF
  const employerEsiAcc = await ChartOfAccount.findOne({ code: '5225' }); // Employer ESI

  const payrollPayableAcc = await ChartOfAccount.findOne({ code: '2120' }); // Net Salaries Payable
  const pfPayableAcc = await ChartOfAccount.findOne({ code: '2130' }); // PF Payable
  const esiPayableAcc = await ChartOfAccount.findOne({ code: '2135' }); // ESI Payable
  const ptPayableAcc = await ChartOfAccount.findOne({ code: '2140' }); // PT Payable
  const tdsPayableAcc = await ChartOfAccount.findOne({ code: '2145' }); // TDS Payable

  if (!salaryExpenseAcc || !payrollPayableAcc) {
    throw new Error('Required payroll GL accounts (5210 Salaries Expense, 2120 Payroll Payable) not found.');
  }

  const lines: CreateJournalLineInput[] = [];

  // DEBITS (Expenses)
  const grossPay = Math.round((payrollRecord.grossSalary - (payrollRecord.attendanceDeduction || 0)) * 100) / 100;
  lines.push({
    accountId: salaryExpenseAcc._id as any,
    debit: grossPay,
    credit: 0,
    description: `Gross Salary Expense (${payrollRecord.attendanceCycle.cycleName})`,
    employeeId: payrollRecord.employee,
  });

  const pfEmployer = Math.round((payrollRecord.pfEmployer || 0) * 100) / 100;
  if (pfEmployer > 0 && employerPfAcc) {
    lines.push({
      accountId: employerPfAcc._id as any,
      debit: pfEmployer,
      credit: 0,
      description: 'Employer PF Contribution',
      employeeId: payrollRecord.employee,
    });
  }

  const esiEmployer = Math.round((payrollRecord.esiEmployer || 0) * 100) / 100;
  if (esiEmployer > 0 && employerEsiAcc) {
    lines.push({
      accountId: employerEsiAcc._id as any,
      debit: esiEmployer,
      credit: 0,
      description: 'Employer ESI Contribution',
      employeeId: payrollRecord.employee,
    });
  }

  // CREDITS (Liabilities)
  const netPay = Math.round(payrollRecord.netSalary * 100) / 100;
  lines.push({
    accountId: payrollPayableAcc._id as any,
    debit: 0,
    credit: netPay,
    description: `Net Salary Payable (${payrollRecord.attendanceCycle.cycleName})`,
    employeeId: payrollRecord.employee,
  });

  const totalPf = Math.round(((payrollRecord.pfEmployee || 0) + pfEmployer) * 100) / 100;
  if (totalPf > 0 && pfPayableAcc) {
    lines.push({
      accountId: pfPayableAcc._id as any,
      debit: 0,
      credit: totalPf,
      description: 'PF Liability (Employee + Employer)',
      employeeId: payrollRecord.employee,
    });
  }

  const totalEsi = Math.round(((payrollRecord.esiEmployee || 0) + esiEmployer) * 100) / 100;
  if (totalEsi > 0 && esiPayableAcc) {
    lines.push({
      accountId: esiPayableAcc._id as any,
      debit: 0,
      credit: totalEsi,
      description: 'ESI Liability (Employee + Employer)',
      employeeId: payrollRecord.employee,
    });
  }

  const pt = Math.round((payrollRecord.professionalTax || 0) * 100) / 100;
  if (pt > 0 && ptPayableAcc) {
    lines.push({
      accountId: ptPayableAcc._id as any,
      debit: 0,
      credit: pt,
      description: 'Professional Tax Liability',
      employeeId: payrollRecord.employee,
    });
  }

  const tds = Math.round((payrollRecord.tds || 0) * 100) / 100;
  if (tds > 0 && tdsPayableAcc) {
    lines.push({
      accountId: tdsPayableAcc._id as any,
      debit: 0,
      credit: tds,
      description: 'TDS (192B) Salary Liability',
      employeeId: payrollRecord.employee,
    });
  }

  const journal = await postJournalEntry({
    date: new Date(),
    voucherType: 'PAYROLL',
    referenceNumber: `PAY-${payrollRecord.month}-${payrollRecord.year}`,
    sourceType: 'PAYROLL',
    sourceId: payrollRecord._id as any,
    description: `Payroll Accrual: ${(payrollRecord.employee as any)?.name || 'Staff'} (${payrollRecord.attendanceCycle.cycleName})`,
    lines,
    userId,
  });

  return journal;
}

export async function postPayrollDisbursementJournal(
  payrollRecord: IPayrollRecord,
  bankAccountId?: string | mongoose.Types.ObjectId,
  userId?: mongoose.Types.ObjectId | null
) {
  const payrollPayableAcc = await ChartOfAccount.findOne({ code: '2120' });
  if (!payrollPayableAcc) {
    throw new Error('Payroll Payable account (2120) not found.');
  }

  let bankGlAccId: mongoose.Types.ObjectId;
  if (bankAccountId) {
    const bank = await BankAccount.findById(bankAccountId);
    if (!bank) throw new Error('Selected bank account not found.');
    bankGlAccId = bank.glAccount;
  } else {
    const defaultBank = await ChartOfAccount.findOne({ code: '1130' });
    if (!defaultBank) throw new Error('Default Bank account (1130) not found.');
    bankGlAccId = defaultBank._id as any;
  }

  const netPay = Math.round(payrollRecord.netSalary * 100) / 100;

  const lines: CreateJournalLineInput[] = [
    {
      accountId: payrollPayableAcc._id as any,
      debit: netPay,
      credit: 0,
      description: `Disbursement of net salary to ${(payrollRecord.employee as any)?.name || 'Staff'}`,
      employeeId: payrollRecord.employee,
    },
    {
      accountId: bankGlAccId,
      debit: 0,
      credit: netPay,
      description: `Bank transfer payment for salary (${payrollRecord.attendanceCycle.cycleName})`,
      employeeId: payrollRecord.employee,
    },
  ];

  const journal = await postJournalEntry({
    date: new Date(),
    voucherType: 'PAYMENT',
    referenceNumber: `SAL-DISB-${payrollRecord.month}-${payrollRecord.year}`,
    sourceType: 'PAYROLL',
    sourceId: payrollRecord._id as any,
    description: `Salary Payout: ${(payrollRecord.employee as any)?.name || 'Staff'} (${payrollRecord.attendanceCycle.cycleName})`,
    lines,
    userId,
  });

  return journal;
}
