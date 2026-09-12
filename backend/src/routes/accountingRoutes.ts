import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
} from '../controllers/accounting/accountController.js';
import {
  getJournalEntries,
  getJournalEntryById,
  createManualJournal,
  reverseJournal,
} from '../controllers/accounting/journalController.js';
import {
  getGeneralLedgerHandler,
  getCustomerLedgerHandler,
  getVendorLedgerHandler,
} from '../controllers/accounting/ledgerController.js';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
} from '../controllers/accounting/invoiceController.js';
import {
  getReceipts,
  createReceipt,
} from '../controllers/accounting/receiptController.js';
import {
  getBills,
  getBillById,
  createBill,
} from '../controllers/accounting/billController.js';
import {
  getVendorPayments,
  createVendorPayment,
} from '../controllers/accounting/vendorPaymentController.js';
import {
  getExpenses,
  createExpense,
} from '../controllers/accounting/expenseController.js';
import {
  getBankAccounts,
  createBankAccount,
  getBankTransactions,
  createBankTransaction,
  reconcileBankStatement,
} from '../controllers/accounting/bankingController.js';
import {
  getDashboardSummaryHandler,
  getTrialBalanceHandler,
  getProfitAndLossHandler,
  getBalanceSheetHandler,
  getARAgingHandler,
  getAPAgingHandler,
} from '../controllers/accounting/reportController.js';
import {
  getVendors,
  createVendor,
  getTaxRates,
  createTaxRate,
  getFixedAssets,
  createFixedAsset,
  runMonthlyDepreciation,
  getCostCenters,
  createCostCenter,
  getFiscalYears,
  getAccountingPeriods,
  lockAccountingPeriod,
  getAccountingClients,
  getAccountingProjects,
} from '../controllers/accounting/entitiesController.js';

const router = Router();

router.use(authenticateToken);
router.use(requirePermission('ACCOUNTING', 'canView'));

// 1. Dashboard & Reports
router.get('/dashboard/summary/?', getDashboardSummaryHandler);
router.get('/reports/dashboard-summary/?', getDashboardSummaryHandler);
router.get('/dashboard-summary/?', getDashboardSummaryHandler);
router.get('/reports/trial-balance/?', getTrialBalanceHandler);
router.get('/reports/profit-loss/?', getProfitAndLossHandler);
router.get('/reports/profit-and-loss/?', getProfitAndLossHandler);
router.get('/reports/balance-sheet/?', getBalanceSheetHandler);
router.get('/reports/ar-aging/?', getARAgingHandler);
router.get('/reports/ap-aging/?', getAPAgingHandler);

// 2. Chart of Accounts
router.get('/accounts/?', getAccounts);
router.post('/accounts/?', requirePermission('ACCOUNTING', 'canCreate'), createAccount);
router.get('/accounts/:id/?', getAccountById);
router.put('/accounts/:id/?', requirePermission('ACCOUNTING', 'canEdit'), updateAccount);

// 3. Journal Entries
router.get('/journals/?', getJournalEntries);
router.post('/journals/?', requirePermission('ACCOUNTING', 'canCreate'), createManualJournal);
router.get('/journals/:id/?', getJournalEntryById);
router.post('/journals/:id/reverse/?', requirePermission('ACCOUNTING', 'canEdit'), reverseJournal);

// 4. Ledgers
router.get('/ledger/?', getGeneralLedgerHandler);
router.get('/ledger/account/:id/?', getGeneralLedgerHandler);
router.get('/ledger/:id/?', getGeneralLedgerHandler);
router.get('/ledger/customer/?', getCustomerLedgerHandler);
router.get('/ledger/vendor/?', getVendorLedgerHandler);

// 5. Invoices & Receipts (Sales / AR)
router.get('/invoices/?', getInvoices);
router.post('/invoices/?', requirePermission('ACCOUNTING', 'canCreate'), createInvoice);
router.get('/invoices/:id/?', getInvoiceById);
router.get('/receipts/?', getReceipts);
router.post('/receipts/?', requirePermission('ACCOUNTING', 'canCreate'), createReceipt);

// 6. Bills & Vendor Payments (Purchases / AP)
router.get('/bills/?', getBills);
router.post('/bills/?', requirePermission('ACCOUNTING', 'canCreate'), createBill);
router.get('/bills/:id/?', getBillById);
router.get('/vendor-payments/?', getVendorPayments);
router.post('/vendor-payments/?', requirePermission('ACCOUNTING', 'canCreate'), createVendorPayment);

// 7. Expenses
router.get('/expenses/?', getExpenses);
router.post('/expenses/?', requirePermission('ACCOUNTING', 'canCreate'), createExpense);

// 8. Banking & Reconciliation
router.get('/banking/accounts/?', getBankAccounts);
router.post('/banking/accounts/?', requirePermission('ACCOUNTING', 'canCreate'), createBankAccount);
router.get('/banking/transactions/?', getBankTransactions);
router.post('/banking/transactions/?', requirePermission('ACCOUNTING', 'canCreate'), createBankTransaction);
router.post('/banking/reconcile/?', requirePermission('ACCOUNTING', 'canEdit'), reconcileBankStatement);

// 9. ERP Clients & Projects Integration
router.get('/clients/?', getAccountingClients);
router.get('/entities/clients/?', getAccountingClients);
router.get('/projects/?', getAccountingProjects);
router.get('/entities/projects/?', getAccountingProjects);

// 10. Vendors & Taxes (with /entities/ aliases)
router.get('/vendors/?', getVendors);
router.post('/vendors/?', requirePermission('ACCOUNTING', 'canCreate'), createVendor);
router.get('/entities/vendors/?', getVendors);
router.post('/entities/vendors/?', requirePermission('ACCOUNTING', 'canCreate'), createVendor);
router.get('/taxes/?', getTaxRates);
router.post('/taxes/?', requirePermission('ACCOUNTING', 'canCreate'), createTaxRate);
router.get('/entities/tax-rates/?', getTaxRates);
router.post('/entities/tax-rates/?', requirePermission('ACCOUNTING', 'canCreate'), createTaxRate);
router.get('/entities/taxes/?', getTaxRates);
router.post('/entities/taxes/?', requirePermission('ACCOUNTING', 'canCreate'), createTaxRate);

// 10. Fixed Assets & Depreciation
router.get('/assets/?', getFixedAssets);
router.post('/assets/?', requirePermission('ACCOUNTING', 'canCreate'), createFixedAsset);
router.get('/entities/fixed-assets/?', getFixedAssets);
router.post('/entities/fixed-assets/?', requirePermission('ACCOUNTING', 'canCreate'), createFixedAsset);
router.post('/assets/run-depreciation/?', requirePermission('ACCOUNTING', 'canEdit'), runMonthlyDepreciation);

// 11. Cost Centers, Budgets & Periods
router.get('/cost-centers/?', getCostCenters);
router.post('/cost-centers/?', requirePermission('ACCOUNTING', 'canCreate'), createCostCenter);
router.get('/entities/cost-centers/?', getCostCenters);
router.post('/entities/cost-centers/?', requirePermission('ACCOUNTING', 'canCreate'), createCostCenter);
router.get('/fiscal-years/?', getFiscalYears);
router.get('/entities/fiscal-years/?', getFiscalYears);
router.get('/periods/?', getAccountingPeriods);
router.get('/entities/periods/?', getAccountingPeriods);
router.post('/periods/:id/lock/?', requirePermission('ACCOUNTING', 'canEdit'), lockAccountingPeriod);
router.post('/entities/periods/:id/lock/?', requirePermission('ACCOUNTING', 'canEdit'), lockAccountingPeriod);

export default router;
