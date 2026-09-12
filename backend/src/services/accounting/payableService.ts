import mongoose from 'mongoose';
import { Bill, IBill } from '../../models/accounting/Bill.js';
import { VendorPayment, IVendorPayment } from '../../models/accounting/VendorPayment.js';
import { Vendor } from '../../models/accounting/Vendor.js';
import { ChartOfAccount } from '../../models/accounting/ChartOfAccount.js';
import { postJournalEntry, generateDocumentNumber, CreateJournalLineInput } from './accountingEngine.js';

export async function createAndPostBill(data: any, userId?: mongoose.Types.ObjectId | null): Promise<IBill> {
  const apAccount = await ChartOfAccount.findOne({ code: '2110' }); // Accounts Payable
  const inputTaxAccount = await ChartOfAccount.findOne({ code: '2155' }); // GST Input Tax Credit (ITC)

  if (!apAccount) {
    throw new Error('Accounts Payable account (2110) not found in Chart of Accounts.');
  }

  const billNumber = await generateDocumentNumber('BILL');

  // Resolve vendor & party details (Registered Vendor or manual entry)
  let vendorId: mongoose.Types.ObjectId | null = null;
  let vendorName = (data.vendorName || '').trim();
  let isManualVendor = true;

  if (data.vendor && mongoose.Types.ObjectId.isValid(data.vendor)) {
    const foundVendor = await Vendor.findById(data.vendor);
    if (foundVendor) {
      vendorId = foundVendor._id as any;
      vendorName = foundVendor.name;
      isManualVendor = false;
    }
  }

  if (!vendorName) {
    vendorName = 'Supplier / Vendor';
  }

  const vendorReference = (data.vendorReference || data.vendorInvoiceNumber || '').trim();

  let subtotal = 0;
  let taxTotal = 0;
  const processedLines = [];

  for (const l of data.lines) {
    const qty = Number(l.quantity || 1);
    const rate = Number(l.unitRate || 0);
    const lineSubtotal = Math.round(qty * rate * 100) / 100;
    const taxAmt = Math.round(Number(l.taxAmount || 0) * 100) / 100;
    const lineTotal = Math.round((lineSubtotal + taxAmt) * 100) / 100;

    subtotal += lineSubtotal;
    taxTotal += taxAmt;

    processedLines.push({
      description: l.description,
      account: l.account,
      quantity: qty,
      unitRate: rate,
      taxRate: l.taxRate && mongoose.Types.ObjectId.isValid(l.taxRate) ? l.taxRate : null,
      taxAmount: taxAmt,
      totalAmount: lineTotal,
      costCenter: l.costCenter || null,
      project: l.project || null,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;
  const totalAmount = Math.round((subtotal + taxTotal) * 100) / 100;

  const bill = new Bill({
    billNumber,
    vendorInvoiceNumber: data.vendorInvoiceNumber || vendorReference,
    vendor: vendorId,
    vendorName,
    vendorReference,
    vendorGstin: data.vendorGstin || '',
    isManualVendor,
    billDate: data.billDate ? new Date(data.billDate) : new Date(),
    dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 30 * 86400000),
    currency: data.currency || 'INR',
    subtotal,
    taxTotal,
    totalAmount,
    amountPaid: 0,
    balanceDue: totalAmount,
    status: data.status || 'APPROVED',
    attachment: data.attachment || '',
    notes: data.notes || '',
    lines: processedLines,
    createdBy: userId || null,
  });

  await bill.save();

  // Accounting Entry:
  // Dr. Expense / Asset accounts for line subtotals
  // Dr. GST Input Tax Credit (if tax > 0)
  // Cr. Accounts Payable for totalAmount
  const journalLines: CreateJournalLineInput[] = [];

  for (const l of processedLines) {
    journalLines.push({
      accountId: l.account,
      debit: Math.round((l.totalAmount - l.taxAmount) * 100) / 100,
      credit: 0,
      description: l.description,
      costCenterId: l.costCenter,
      projectId: l.project,
      partyType: 'VENDOR',
      partyName: vendorName,
      partyReference: vendorReference || billNumber,
    });
  }

  if (taxTotal > 0 && inputTaxAccount) {
    journalLines.push({
      accountId: inputTaxAccount._id as any,
      debit: taxTotal,
      credit: 0,
      description: `GST Input Tax Credit for ${billNumber} (${vendorName})`,
      partyType: 'VENDOR',
      partyName: vendorName,
      partyReference: vendorReference || billNumber,
    });
  }

  journalLines.push({
    accountId: apAccount._id as any,
    debit: 0,
    credit: totalAmount,
    description: `Bill ${billNumber} - ${vendorName}${vendorReference ? ` (Ref: ${vendorReference})` : ''}`,
    partyType: 'VENDOR',
    partyName: vendorName,
    partyReference: vendorReference || billNumber,
  });

  const journal = await postJournalEntry({
    date: bill.billDate,
    voucherType: 'PURCHASE',
    referenceNumber: vendorReference || billNumber,
    sourceType: 'BILL',
    sourceId: bill._id as any,
    description: `Vendor Bill ${billNumber} - ${vendorName} (${vendorReference || 'Direct'})`,
    lines: journalLines,
    userId,
  });

  bill.journalEntry = journal._id as any;
  await bill.save();

  return bill;
}

export async function createAndPostVendorPayment(data: any, userId?: mongoose.Types.ObjectId | null): Promise<IVendorPayment> {
  const apAccount = await ChartOfAccount.findOne({ code: '2110' });
  if (!apAccount) {
    throw new Error('Accounts Payable account (2110) not found in Chart of Accounts.');
  }

  const paymentNumber = await generateDocumentNumber('PMT');
  const totalAmount = Math.round(Number(data.totalAmount || 0) * 100) / 100;

  // Resolve vendor & party details
  let vendorId: mongoose.Types.ObjectId | null = null;
  let vendorName = (data.vendorName || '').trim();
  let isManualVendor = true;

  if (data.vendor && mongoose.Types.ObjectId.isValid(data.vendor)) {
    const foundVendor = await Vendor.findById(data.vendor);
    if (foundVendor) {
      vendorId = foundVendor._id as any;
      vendorName = foundVendor.name;
      isManualVendor = false;
    }
  }

  if (!vendorName) {
    vendorName = 'Supplier / Vendor';
  }

  const vendorReference = (data.vendorReference || data.referenceNumber || '').trim();

  let allocatedSum = 0;
  const allocations = [];

  if (data.allocations && Array.isArray(data.allocations)) {
    for (const alloc of data.allocations) {
      const bill = await Bill.findById(alloc.bill);
      if (bill) {
        const amt = Math.min(Number(alloc.allocatedAmount || 0), bill.balanceDue);
        if (amt > 0) {
          allocations.push({ bill: bill._id as any, allocatedAmount: amt });
          allocatedSum += amt;

          bill.amountPaid = Math.round((bill.amountPaid + amt) * 100) / 100;
          bill.balanceDue = Math.max(0, Math.round((bill.totalAmount - bill.amountPaid) * 100) / 100);
          if (bill.balanceDue <= 0.01) {
            bill.status = 'PAID';
          } else {
            bill.status = 'PARTIALLY_PAID';
          }
          await bill.save();
        }
      }
    }
  }

  const unallocatedAmount = Math.max(0, Math.round((totalAmount - allocatedSum) * 100) / 100);

  const payment = new VendorPayment({
    paymentNumber,
    vendor: vendorId,
    vendorName,
    vendorReference,
    isManualVendor,
    date: data.date ? new Date(data.date) : new Date(),
    paidFromAccount: data.paidFromAccount, // Bank or Cash GL Account
    paymentMethod: data.paymentMethod || 'BANK_TRANSFER',
    referenceNumber: vendorReference,
    totalAmount,
    allocations,
    unallocatedAmount,
    notes: data.notes || '',
    status: 'POSTED',
    createdBy: userId || null,
  });

  await payment.save();

  // Accounting Entry: Dr. Accounts Payable, Cr. Bank / Cash
  const journalLines: CreateJournalLineInput[] = [
    {
      accountId: apAccount._id as any,
      debit: totalAmount,
      credit: 0,
      description: `Settlement of payables (${paymentNumber} - ${vendorName})`,
      partyType: 'VENDOR',
      partyName: vendorName,
      partyReference: vendorReference || paymentNumber,
    },
    {
      accountId: data.paidFromAccount,
      debit: 0,
      credit: totalAmount,
      description: `Vendor payment ${paymentNumber} (${vendorName}) via ${payment.paymentMethod}`,
      partyType: 'VENDOR',
      partyName: vendorName,
      partyReference: vendorReference || paymentNumber,
    },
  ];

  const journal = await postJournalEntry({
    date: payment.date,
    voucherType: 'PAYMENT',
    referenceNumber: paymentNumber,
    sourceType: 'PAYMENT',
    sourceId: payment._id as any,
    description: `Vendor Payment ${paymentNumber} - ${vendorName} (${vendorReference || 'Direct'})`,
    lines: journalLines,
    userId,
  });

  payment.journalEntry = journal._id as any;
  await payment.save();

  return payment;
}
