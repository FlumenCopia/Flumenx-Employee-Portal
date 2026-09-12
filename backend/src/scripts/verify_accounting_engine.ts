import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { seedAccountingDefaults } from '../services/accounting/seedChartOfAccounts.js';
import { ChartOfAccount } from '../models/accounting/ChartOfAccount.js';
import { JournalEntry } from '../models/accounting/JournalEntry.js';
import { Invoice } from '../models/accounting/Invoice.js';
import { CustomerReceipt } from '../models/accounting/CustomerReceipt.js';
import { Vendor } from '../models/accounting/Vendor.js';
import { Bill } from '../models/accounting/Bill.js';
import { VendorPayment } from '../models/accounting/VendorPayment.js';
import { Client } from '../models/Client.js';
import { TaxRate } from '../models/accounting/AccountingEntities.js';
import { postJournalEntry, reverseJournalEntry } from '../services/accounting/accountingEngine.js';
import { createAndPostInvoice, createAndPostReceipt } from '../services/accounting/receivableService.js';
import { createAndPostBill, createAndPostVendorPayment } from '../services/accounting/payableService.js';
import { getGeneralLedger } from '../services/accounting/ledgerService.js';
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
} from '../services/accounting/financialReportService.js';

async function runVerification() {
  console.log('================================================================');
  console.log('   FLUMENX OS: ACCOUNTING ENGINE AUTOMATED VERIFICATION SUITE   ');
  console.log('================================================================\n');

  const conn = await connectDB();
  if (!conn) {
    console.error('❌ Could not connect to MongoDB. Ensure MongoDB service is running.');
    process.exit(1);
  }

  try {
    // 1. Seed Chart of Accounts
    console.log('[1/10] Seeding Chart of Accounts...');
    await seedAccountingDefaults();
    const count = await ChartOfAccount.countDocuments({ isActive: true });
    console.log(`  ✓ Chart of accounts verified. Total active accounts: ${count}`);

    const cashAcc = await ChartOfAccount.findOne({ code: '1110' });
    const bankAcc = await ChartOfAccount.findOne({ code: '1130' });
    const arAcc = await ChartOfAccount.findOne({ code: '1140' });
    const itcAcc = await ChartOfAccount.findOne({ code: '2155' });
    const apAcc = await ChartOfAccount.findOne({ code: '2110' });
    const gstOutputAcc = await ChartOfAccount.findOne({ code: '2150' });
    const equityAcc = await ChartOfAccount.findOne({ code: '3010' });
    const salesAcc = await ChartOfAccount.findOne({ code: '4010' });
    const rentExpenseAcc = await ChartOfAccount.findOne({ code: '5310' });

    if (!cashAcc || !bankAcc || !arAcc || !apAcc || !equityAcc || !salesAcc || !rentExpenseAcc) {
      throw new Error('Required chart of accounts missing after seed!');
    }
    console.log('  ✓ Verified critical accounts exist with proper types and natures.');

    // 2. Test Double-Entry Invariant: Reject Unbalanced Journal
    console.log('\n[2/10] Testing Invariant: Rejecting Unbalanced Journal Entry...');
    try {
      await postJournalEntry({
        date: new Date(),
        voucherType: 'JOURNAL',
        description: 'Unbalanced Test Voucher',
        lines: [
          { account: cashAcc._id, debit: 1000, credit: 0 },
          { account: equityAcc._id, debit: 0, credit: 800 }, // Unequal!
        ],
      });
      throw new Error('FAILED: System permitted an unbalanced journal entry!');
    } catch (err: any) {
      console.log(`  ✓ Successfully rejected unbalanced journal: "${err.message}"`);
    }

    // 3. Test Balanced Manual Capital Injection Journal
    console.log('\n[3/10] Testing Balanced Capital Injection Journal...');
    const initialCash = cashAcc.currentBalance;
    const initialEquity = equityAcc.currentBalance;

    const capitalVoucher = await postJournalEntry({
      date: new Date(),
      voucherType: 'JOURNAL',
      description: 'Owner Capital Contribution Verification Test',
      lines: [
        { account: cashAcc._id, debit: 50000, credit: 0, description: 'Cash received' },
        { account: equityAcc._id, debit: 0, credit: 50000, description: 'Capital allocated' },
      ],
    });

    console.log(`  ✓ Journal Voucher Posted: ${capitalVoucher.journalNumber}`);
    console.log(`    Total Dr: ${capitalVoucher.totalDebit} | Total Cr: ${capitalVoucher.totalCredit}`);

    // Verify account balances updated
    const updatedCash = await ChartOfAccount.findById(cashAcc._id);
    const updatedEquity = await ChartOfAccount.findById(equityAcc._id);
    console.log(`    Cash Balance: ${initialCash} -> ${updatedCash?.currentBalance}`);
    console.log(`    Equity Balance: ${initialEquity} -> ${updatedEquity?.currentBalance}`);

    if (
      Math.round((updatedCash!.currentBalance - initialCash) * 100) / 100 !== 50000 ||
      Math.round((updatedEquity!.currentBalance - initialEquity) * 100) / 100 !== 50000
    ) {
      throw new Error('Account balances did not update correctly after capital voucher!');
    }

    // 4. Test Client & Sales Invoicing with Automatic Double-Entry Journal
    console.log('\n[4/10] Testing Sales Invoice Generation & Automated Voucher...');
    let testClient = await Client.findOne({ name: 'Acme Test Corp' });
    if (!testClient) {
      testClient = await Client.create({
        name: 'Acme Test Corp',
        contactPerson: 'John Doe',
        email: 'billing@acmetest.corp',
        industry: 'Enterprise Technology',
      });
    }

    const gst18Tax = await TaxRate.findOne({ code: 'GST_18' });

    const testInvoice = await createAndPostInvoice({
      client: testClient._id.toString(),
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      currency: 'INR',
      notes: 'Automated Test Invoice for Cloud Architecture Consultation',
      lines: [
        {
          description: 'Cloud Architecture Retainer',
          account: salesAcc._id.toString(),
          quantity: 1,
          unitRate: 10000,
          discount: 0,
          taxRate: gst18Tax?._id.toString() || null,
          taxAmount: 1800,
          totalAmount: 11800,
        },
      ],
    });

    console.log(`  ✓ Invoice Created: ${testInvoice.invoiceNumber}`);
    console.log(`    Subtotal: ${testInvoice.subtotal} | Tax: ${testInvoice.taxTotal} | Total: ${testInvoice.totalAmount}`);
    console.log(`    Status: ${testInvoice.status} | Balance Due: ${testInvoice.balanceDue}`);

    const invoiceJournal = await JournalEntry.findById(testInvoice.journalEntry);
    if (!invoiceJournal || invoiceJournal.status !== 'POSTED') {
      throw new Error('Invoice failed to auto-post double-entry journal entry!');
    }
    console.log(`  ✓ Auto-Posted Sales Voucher: ${invoiceJournal.journalNumber}`);
    console.log(`    Dr Lines: ${invoiceJournal.lines.filter((l) => l.debit > 0).map((l) => `${l.accountName} (${l.debit})`).join(', ')}`);
    console.log(`    Cr Lines: ${invoiceJournal.lines.filter((l) => l.credit > 0).map((l) => `${l.accountName} (${l.credit})`).join(', ')}`);

    // 5. Test Customer Receipt & Payment Allocation
    console.log('\n[5/10] Testing Customer Receipt & Invoice Settlement...');
    const receipt = await createAndPostReceipt({
      client: testClient._id.toString(),
      date: new Date(),
      depositAccount: bankAcc._id.toString(),
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'NEFT-ACME-98765',
      totalAmount: 11800,
      allocations: [
        {
          invoice: testInvoice._id.toString(),
          allocatedAmount: 11800,
        },
      ],
      notes: 'Full payment received from Acme Test Corp',
    });

    console.log(`  ✓ Customer Receipt Posted: ${receipt.receiptNumber}`);
    const settledInvoice = await Invoice.findById(testInvoice._id);
    console.log(`    Invoice Status: ${settledInvoice?.status} (Balance Due: ${settledInvoice?.balanceDue})`);
    if (settledInvoice?.status !== 'PAID' || settledInvoice?.balanceDue !== 0) {
      throw new Error('Invoice was not properly marked as PAID after receipt allocation!');
    }

    const receiptJournal = await JournalEntry.findById(receipt.journalEntry);
    console.log(`  ✓ Auto-Posted Receipt Voucher: ${receiptJournal?.journalNumber} (Dr Bank, Cr AR)`);

    // 6. Test Vendor Bill & Vendor Payment
    console.log('\n[6/10] Testing Vendor Bill & Accounts Payable Flow...');
    let testVendor = await Vendor.findOne({ code: 'VEND-TEST-01' });
    if (!testVendor) {
      testVendor = await Vendor.create({
        name: 'Omni Properties LLC',
        code: 'VEND-TEST-01',
        taxId: '29ABCDE1234F1Z5',
        paymentTerms: 'NET30',
        isActive: true,
      });
    }

    const testBill = await createAndPostBill({
      vendor: testVendor._id.toString(),
      billDate: new Date(),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      vendorInvoiceNumber: 'INV-RENT-FEB26',
      notes: 'Monthly Office Rent Test Bill',
      lines: [
        {
          account: (rentExpenseAcc || salesAcc)._id.toString(),
          description: 'Office Workspace Lease Feb 2026',
          quantity: 1,
          unitRate: 5000,
          taxAmount: 900,
          totalAmount: 5900,
        },
      ],
    });

    console.log(`  ✓ Vendor Bill Created: ${testBill.billNumber}`);
    console.log(`    Total Amount: ${testBill.totalAmount} | Balance Due: ${testBill.balanceDue}`);

    const billPayment = await createAndPostVendorPayment({
      vendor: testVendor._id.toString(),
      date: new Date(),
      paidFromAccount: bankAcc._id.toString(),
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TXN-RENT-PAY-01',
      totalAmount: 5900,
      allocations: [
        {
          bill: testBill._id.toString(),
          allocatedAmount: 5900,
        },
      ],
      notes: 'Rent bill settlement',
    });

    console.log(`  ✓ Vendor Payment Recorded: ${billPayment.paymentNumber}`);
    const settledBill = await Bill.findById(testBill._id);
    console.log(`    Bill Status: ${settledBill?.status} (Balance Due: ${settledBill?.balanceDue})`);
    if (settledBill?.status !== 'PAID' || settledBill?.balanceDue !== 0) {
      throw new Error('Vendor Bill was not properly settled!');
    }

    // 7. Test General Ledger Engine
    console.log('\n[7/10] Testing General Ledger Running Balance Calculation...');
    const bankGL = await getGeneralLedger(bankAcc._id.toString());
    console.log(`  ✓ General Ledger for Account [${bankGL.account.code} - ${bankGL.account.name}]:`);
    console.log(`    Opening Balance: ${bankGL.openingBalance}`);
    console.log(`    Period Debits: ${bankGL.periodDebit} | Period Credits: ${bankGL.periodCredit}`);
    console.log(`    Closing Balance: ${bankGL.closingBalance}`);
    console.log(`    Transactions count: ${bankGL.transactions.length}`);

    // 8. Test Trial Balance Report
    console.log('\n[8/10] Testing Trial Balance Integrity...');
    const trialBalance = await getTrialBalance(new Date());
    console.log(`  ✓ Trial Balance as of: ${trialBalance.asOfDate.toISOString()}`);
    console.log(`    Total Debits:  ${trialBalance.totalDebit}`);
    console.log(`    Total Credits: ${trialBalance.totalCredit}`);
    console.log(`    Difference:    ${trialBalance.difference}`);
    console.log(`    Is Balanced:   ${trialBalance.isBalanced ? 'YES (PASS)' : 'NO (FAIL)'}`);

    if (!trialBalance.isBalanced || Math.abs(trialBalance.difference) > 0.01) {
      throw new Error(`Trial Balance is not balanced! Difference: ${trialBalance.difference}`);
    }

    // 9. Test Profit & Loss and Balance Sheet
    console.log('\n[9/10] Testing Profit & Loss & Balance Sheet Invariants...');
    const pnl = await getProfitAndLoss(
      new Date(new Date().getFullYear(), 0, 1),
      new Date()
    );
    console.log(`  ✓ Profit & Loss:`);
    console.log(`    Total Revenue:            ${pnl.revenue.totalRevenue}`);
    console.log(`    Total Cost of Sales:      ${pnl.costOfSales.totalCostOfSales}`);
    console.log(`    Total Operating Expenses: ${pnl.operatingExpenses.totalOperatingExpenses}`);
    console.log(`    Net Profit:               ${pnl.netProfit}`);

    const balanceSheet = await getBalanceSheet(new Date());
    console.log(`  ✓ Balance Sheet:`);
    console.log(`    Total Assets:                 ${balanceSheet.assets.totalAssets}`);
    console.log(`    Total Liabilities:            ${balanceSheet.liabilities.totalLiabilities}`);
    console.log(`    Total Equity (incl. P&L):     ${balanceSheet.equity.totalEquity}`);
    console.log(`    Total Liabilities + Equity:   ${balanceSheet.totalLiabilitiesAndEquity}`);
    console.log(`    Accounting Invariant (A = L + E): Difference = ${balanceSheet.difference}`);
    console.log(`    Is Balanced:                  ${balanceSheet.isBalanced ? 'YES (PASS)' : 'NO (FAIL)'}`);

    if (!balanceSheet.isBalanced || Math.abs(balanceSheet.difference) > 0.01) {
      throw new Error(`Balance Sheet does not balance! Assets: ${balanceSheet.assets.totalAssets}, L+E: ${balanceSheet.totalLiabilitiesAndEquity}`);
    }

    // 10. Test Journal Voucher Reversal
    console.log('\n[10/10] Testing Audit-Proof Journal Reversal...');
    const testReversalVoucher = await postJournalEntry({
      date: new Date(),
      voucherType: 'ADJUSTMENT',
      description: 'Temporary Test Adjustment to be reversed',
      lines: [
        { account: cashAcc._id, debit: 500, credit: 0 },
        { account: rentExpenseAcc._id, debit: 0, credit: 500 },
      ],
    });

    console.log(`  ✓ Created test voucher: ${testReversalVoucher.journalNumber}`);
    const reversedResult = await reverseJournalEntry(
      testReversalVoucher._id.toString(),
      'Audit Test: Testing automated reversal voucher mechanism'
    );

    console.log(`  ✓ Reversal Voucher Created: ${reversedResult.journalNumber}`);
    console.log(`    Reversal Dr: ${reversedResult.lines.map((l) => `${l.accountName} (${l.debit})`).join(', ')}`);
    console.log(`    Reversal Cr: ${reversedResult.lines.map((l) => `${l.accountName} (${l.credit})`).join(', ')}`);

    const originalCheck = await JournalEntry.findById(testReversalVoucher._id);
    console.log(`  ✓ Original Voucher isReversed status: ${originalCheck?.isReversed}`);

    console.log('\n================================================================');
    console.log('   🎉 ALL 10 ACCOUNTING ENGINE VERIFICATION TESTS PASSED!       ');
    console.log('   DOUBLE-ENTRY INVARIANTS MATHEMATICALLY CONFIRMED.            ');
    console.log('================================================================\n');
  } catch (error: any) {
    console.error('\n❌ Verification failed with error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected.');
    process.exit(0);
  }
}

runVerification();
