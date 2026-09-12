import mongoose from 'mongoose';
import { Invoice, IInvoice } from '../../models/accounting/Invoice.js';
import { CustomerReceipt, ICustomerReceipt } from '../../models/accounting/CustomerReceipt.js';
import { ChartOfAccount } from '../../models/accounting/ChartOfAccount.js';
import { Client } from '../../models/Client.js';
import { postJournalEntry, generateDocumentNumber, CreateJournalLineInput } from './accountingEngine.js';

export async function createAndPostInvoice(data: any, userId?: mongoose.Types.ObjectId | null): Promise<IInvoice> {
  const arAccount = await ChartOfAccount.findOne({ code: '1140' }); // Accounts Receivable
  const taxAccount = await ChartOfAccount.findOne({ code: '2150' }); // GST Output Tax

  if (!arAccount) {
    throw new Error('Accounts Receivable account (1140) not found in Chart of Accounts.');
  }

  const invoiceNumber = await generateDocumentNumber('INV');

  // Resolve client & party details (ERP Client or manual entry)
  let clientId: mongoose.Types.ObjectId | null = null;
  let clientName = (data.clientName || data.customerName || '').trim();
  let isManualClient = true;

  if (data.client && mongoose.Types.ObjectId.isValid(data.client)) {
    const foundClient = await Client.findById(data.client);
    if (foundClient) {
      clientId = foundClient._id as any;
      clientName = foundClient.name;
      isManualClient = false;
    }
  }

  if (!clientName) {
    clientName = 'Valued Client';
  }

  const clientReference = (data.clientReference || data.clientRef || data.referenceNumber || '').trim();

  let subtotal = 0;
  let taxTotal = 0;
  const processedLines = [];

  for (const l of data.lines) {
    const qty = Number(l.quantity || 1);
    const rate = Number(l.unitRate || 0);
    const disc = Number(l.discount || 0);
    const lineSubtotal = Math.round((qty * rate - disc) * 100) / 100;
    const taxAmt = Math.round(Number(l.taxAmount || 0) * 100) / 100;
    const lineTotal = Math.round((lineSubtotal + taxAmt) * 100) / 100;

    subtotal += lineSubtotal;
    taxTotal += taxAmt;

    processedLines.push({
      description: l.description,
      account: l.account,
      quantity: qty,
      unitRate: rate,
      discount: disc,
      taxRate: l.taxRate && mongoose.Types.ObjectId.isValid(l.taxRate) ? l.taxRate : null,
      taxAmount: taxAmt,
      totalAmount: lineTotal,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;
  const totalAmount = Math.round((subtotal + taxTotal) * 100) / 100;

  const invoice = new Invoice({
    invoiceNumber,
    client: clientId,
    clientName,
    clientReference,
    clientEmail: data.clientEmail || '',
    clientPhone: data.clientPhone || '',
    clientAddress: data.clientAddress || '',
    clientGstin: data.clientGstin || '',
    isManualClient,
    project: data.project && mongoose.Types.ObjectId.isValid(data.project) ? data.project : null,
    invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
    dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 15 * 86400000),
    currency: data.currency || 'INR',
    subtotal,
    discountTotal: 0,
    taxTotal,
    totalAmount,
    amountPaid: 0,
    balanceDue: totalAmount,
    status: data.status || 'SENT',
    paymentTerms: data.paymentTerms || 'Net 15 Days',
    notes: data.notes || '',
    lines: processedLines,
    createdBy: userId || null,
  });

  await invoice.save();

  // Generate Accounting Journal Entry
  const journalLines: CreateJournalLineInput[] = [
    // 1. DEBIT Accounts Receivable for full gross total
    {
      accountId: arAccount._id as any,
      debit: totalAmount,
      credit: 0,
      description: `Invoice ${invoiceNumber} - ${clientName}${clientReference ? ` (Ref: ${clientReference})` : ''}`,
      clientId,
      partyType: 'CLIENT',
      partyName: clientName,
      partyReference: clientReference || invoiceNumber,
      projectId: invoice.project,
    },
  ];

  // 2. CREDIT Revenue account(s) for subtotal
  for (const l of processedLines) {
    journalLines.push({
      accountId: l.account,
      debit: 0,
      credit: Math.round((l.totalAmount - l.taxAmount) * 100) / 100,
      description: l.description,
      clientId,
      partyType: 'CLIENT',
      partyName: clientName,
      partyReference: clientReference || invoiceNumber,
      projectId: invoice.project,
    });
  }

  // 3. CREDIT Tax Payable for tax portion
  if (taxTotal > 0 && taxAccount) {
    journalLines.push({
      accountId: taxAccount._id as any,
      debit: 0,
      credit: taxTotal,
      description: `GST Output Tax for ${invoiceNumber}`,
      clientId,
      partyType: 'CLIENT',
      partyName: clientName,
      partyReference: clientReference || invoiceNumber,
    });
  }

  const journal = await postJournalEntry({
    date: invoice.invoiceDate,
    voucherType: 'SALES',
    referenceNumber: invoiceNumber,
    client: clientId,
    clientName,
    clientReference,
    sourceType: 'INVOICE',
    sourceId: invoice._id as any,
    description: `Sales Invoice ${invoiceNumber} - ${clientName}`,
    lines: journalLines,
    userId,
  });

  invoice.journalEntry = journal._id as any;
  await invoice.save();

  return invoice;
}

export async function createAndPostReceipt(data: any, userId?: mongoose.Types.ObjectId | null): Promise<ICustomerReceipt> {
  const arAccount = await ChartOfAccount.findOne({ code: '1140' });
  if (!arAccount) {
    throw new Error('Accounts Receivable account (1140) not found in Chart of Accounts.');
  }

  const receiptNumber = await generateDocumentNumber('RCP');
  const totalAmount = Math.round(Number(data.totalAmount || 0) * 100) / 100;

  // Resolve client & party details (ERP Client or manual entry)
  let clientId: mongoose.Types.ObjectId | null = null;
  let clientName = (data.clientName || data.customerName || '').trim();
  let isManualClient = true;

  if (data.client && mongoose.Types.ObjectId.isValid(data.client)) {
    const foundClient = await Client.findById(data.client);
    if (foundClient) {
      clientId = foundClient._id as any;
      clientName = foundClient.name;
      isManualClient = false;
    }
  }

  if (!clientName) {
    clientName = 'Valued Client';
  }

  const clientReference = (data.clientReference || data.referenceNumber || '').trim();

  let allocatedSum = 0;
  const allocations = [];

  if (data.allocations && Array.isArray(data.allocations)) {
    for (const alloc of data.allocations) {
      const inv = await Invoice.findById(alloc.invoice);
      if (inv) {
        const amt = Math.min(Number(alloc.allocatedAmount || 0), inv.balanceDue);
        if (amt > 0) {
          allocations.push({ invoice: inv._id as any, allocatedAmount: amt });
          allocatedSum += amt;

          inv.amountPaid = Math.round((inv.amountPaid + amt) * 100) / 100;
          inv.balanceDue = Math.max(0, Math.round((inv.totalAmount - inv.amountPaid) * 100) / 100);
          if (inv.balanceDue <= 0.01) {
            inv.status = 'PAID';
            inv.paidAt = new Date();
          } else {
            inv.status = 'PARTIALLY_PAID';
          }
          await inv.save();
        }
      }
    }
  }

  const unallocatedAmount = Math.max(0, Math.round((totalAmount - allocatedSum) * 100) / 100);

  const receipt = new CustomerReceipt({
    receiptNumber,
    client: clientId,
    clientName,
    clientReference,
    isManualClient,
    date: data.date ? new Date(data.date) : new Date(),
    depositAccount: data.depositAccount, // Bank or Cash
    paymentMethod: data.paymentMethod || 'BANK_TRANSFER',
    referenceNumber: clientReference,
    totalAmount,
    allocations,
    unallocatedAmount,
    notes: data.notes || '',
    status: 'POSTED',
    createdBy: userId || null,
  });

  await receipt.save();

  // Accounting Entry: Dr. Bank / Cash, Cr. Accounts Receivable
  const journalLines: CreateJournalLineInput[] = [
    {
      accountId: data.depositAccount,
      debit: totalAmount,
      credit: 0,
      description: `Customer Receipt ${receiptNumber} (${clientName}) via ${receipt.paymentMethod}`,
      clientId,
      partyType: 'CLIENT',
      partyName: clientName,
      partyReference: clientReference || receiptNumber,
    },
    {
      accountId: arAccount._id as any,
      debit: 0,
      credit: totalAmount,
      description: `Settlement of receivables (${receiptNumber} - ${clientName})`,
      clientId,
      partyType: 'CLIENT',
      partyName: clientName,
      partyReference: clientReference || receiptNumber,
    },
  ];

  const journal = await postJournalEntry({
    date: receipt.date,
    voucherType: 'RECEIPT',
    referenceNumber: receiptNumber,
    client: clientId,
    clientName,
    clientReference,
    sourceType: 'RECEIPT',
    sourceId: receipt._id as any,
    description: `Customer Payment Receipt ${receiptNumber} - ${clientName} (${clientReference || 'Direct'})`,
    lines: journalLines,
    userId,
  });

  receipt.journalEntry = journal._id as any;
  await receipt.save();

  return receipt;
}
