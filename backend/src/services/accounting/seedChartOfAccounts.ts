import { ChartOfAccount, AccountType, AccountSubtype, BalanceNature } from '../../models/accounting/ChartOfAccount.js';
import { TaxRate } from '../../models/accounting/AccountingEntities.js';
import { BankAccount } from '../../models/accounting/Banking.js';
import { FiscalYear, AccountingPeriod } from '../../models/accounting/AccountingEntities.js';

interface SeedAccountDef {
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  nature: BalanceNature;
  isSystemAccount: boolean;
  description: string;
}

export const DEFAULT_CHART_OF_ACCOUNTS: SeedAccountDef[] = [
  // 1000 ASSETS
  { code: '1110', name: 'Cash in Hand', type: 'ASSET', subtype: 'CASH', nature: 'DEBIT', isSystemAccount: true, description: 'Physical company cash in safe' },
  { code: '1120', name: 'Petty Cash', type: 'ASSET', subtype: 'CASH', nature: 'DEBIT', isSystemAccount: true, description: 'Day-to-day office minor expenses cash' },
  { code: '1130', name: 'HDFC Bank - Main Operating Account', type: 'ASSET', subtype: 'BANK', nature: 'DEBIT', isSystemAccount: true, description: 'Primary company bank account' },
  { code: '1140', name: 'Accounts Receivable (Trade Debtors)', type: 'ASSET', subtype: 'ACCOUNTS_RECEIVABLE', nature: 'DEBIT', isSystemAccount: true, description: 'Total outstanding client invoices' },
  { code: '1150', name: 'Prepaid Expenses', type: 'ASSET', subtype: 'PREPAID_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Prepaid annual software and insurance' },
  { code: '1160', name: 'Employee Advances', type: 'ASSET', subtype: 'CURRENT_ASSET', nature: 'DEBIT', isSystemAccount: false, description: 'Temporary advances given to personnel' },
  { code: '1210', name: 'Computer Hardware & Laptops', type: 'ASSET', subtype: 'FIXED_ASSET', nature: 'DEBIT', isSystemAccount: false, description: 'Agency laptops, workstations, monitors' },
  { code: '1215', name: 'Accumulated Depreciation - Computers', type: 'ASSET', subtype: 'ACCUMULATED_DEPRECIATION', nature: 'CREDIT', isSystemAccount: true, description: 'Contra asset for computer wear and tear' },
  { code: '1220', name: 'Office Furniture & Fixtures', type: 'ASSET', subtype: 'FIXED_ASSET', nature: 'DEBIT', isSystemAccount: false, description: 'Desks, ergonomic chairs, studio fixtures' },
  { code: '1225', name: 'Accumulated Depreciation - Furniture', type: 'ASSET', subtype: 'ACCUMULATED_DEPRECIATION', nature: 'CREDIT', isSystemAccount: true, description: 'Contra asset for office furniture' },
  { code: '1230', name: 'Office Rental Security Deposit', type: 'ASSET', subtype: 'NON_CURRENT_ASSET', nature: 'DEBIT', isSystemAccount: false, description: 'Refundable commercial lease deposit' },

  // 2000 LIABILITIES
  { code: '2110', name: 'Accounts Payable (Trade Creditors)', type: 'LIABILITY', subtype: 'ACCOUNTS_PAYABLE', nature: 'CREDIT', isSystemAccount: true, description: 'Outstanding unpaid vendor bills' },
  { code: '2120', name: 'Payroll Payable (Net Salaries)', type: 'LIABILITY', subtype: 'PAYROLL_PAYABLE', nature: 'CREDIT', isSystemAccount: true, description: 'Approved employee salaries awaiting payout' },
  { code: '2130', name: 'Provident Fund (PF) Payable', type: 'LIABILITY', subtype: 'TAX_PAYABLE', nature: 'CREDIT', isSystemAccount: true, description: 'Statutory employee and employer PF dues' },
  { code: '2135', name: 'ESI Payable', type: 'LIABILITY', subtype: 'TAX_PAYABLE', nature: 'CREDIT', isSystemAccount: true, description: 'Statutory ESI dues' },
  { code: '2140', name: 'Professional Tax (PT) Payable', type: 'LIABILITY', subtype: 'TAX_PAYABLE', nature: 'CREDIT', isSystemAccount: true, description: 'State professional tax deductions' },
  { code: '2145', name: 'TDS Payable', type: 'LIABILITY', subtype: 'TAX_PAYABLE', nature: 'CREDIT', isSystemAccount: true, description: 'Withheld income tax on salaries and vendors' },
  { code: '2150', name: 'GST Output Tax Payable (18%)', type: 'LIABILITY', subtype: 'TAX_PAYABLE', nature: 'CREDIT', isSystemAccount: true, description: 'GST collected from client invoices' },
  { code: '2155', name: 'GST Input Tax Credit (ITC)', type: 'ASSET', subtype: 'CURRENT_ASSET', nature: 'DEBIT', isSystemAccount: true, description: 'GST paid on vendor purchases eligible for offset' },
  { code: '2160', name: 'Accrued Operational Expenses', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', nature: 'CREDIT', isSystemAccount: false, description: 'Incurred but unbilled operational costs' },
  { code: '2210', name: 'Bank Term Loans & Lines of Credit', type: 'LIABILITY', subtype: 'LOAN', nature: 'CREDIT', isSystemAccount: false, description: 'Long-term corporate credit facilities' },

  // 3000 EQUITY
  { code: '3010', name: "Owner's / Paid-up Capital", type: 'EQUITY', subtype: 'CAPITAL', nature: 'CREDIT', isSystemAccount: true, description: 'Initial equity investment into agency' },
  { code: '3020', name: 'Retained Earnings', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', nature: 'CREDIT', isSystemAccount: true, description: 'Accumulated historic operating profits' },
  { code: '3030', name: 'Current Year Earnings / P&L', type: 'EQUITY', subtype: 'EQUITY', nature: 'CREDIT', isSystemAccount: true, description: 'Real-time net earnings from current fiscal year' },

  // 4000 REVENUE
  { code: '4010', name: 'Web Development Services Revenue', type: 'REVENUE', subtype: 'SERVICE_REVENUE', nature: 'CREDIT', isSystemAccount: true, description: 'Income from web apps and custom development' },
  { code: '4020', name: 'Video Editing & Production Revenue', type: 'REVENUE', subtype: 'SERVICE_REVENUE', nature: 'CREDIT', isSystemAccount: true, description: 'Income from video editing, reels, and animations' },
  { code: '4030', name: 'Digital Marketing & Retainer Revenue', type: 'REVENUE', subtype: 'SERVICE_REVENUE', nature: 'CREDIT', isSystemAccount: true, description: 'Monthly agency retainers and ad management' },
  { code: '4040', name: 'UI/UX & Graphic Design Revenue', type: 'REVENUE', subtype: 'SERVICE_REVENUE', nature: 'CREDIT', isSystemAccount: true, description: 'Income from branding and UI/UX design contracts' },
  { code: '4090', name: 'Other Operating Income / Interest', type: 'REVENUE', subtype: 'OTHER_INCOME', nature: 'CREDIT', isSystemAccount: false, description: 'Bank interest and miscellaneous earnings' },

  // 5000 EXPENSES
  { code: '5110', name: 'Freelancer & Subcontractor Fees', type: 'EXPENSE', subtype: 'DIRECT_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'External contractors and specialized gig talent' },
  { code: '5120', name: 'Third-Party Production & Media Assets', type: 'EXPENSE', subtype: 'DIRECT_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Stock footage, sound licenses, 3D assets' },
  { code: '5210', name: 'Salaries & Wages', type: 'EXPENSE', subtype: 'EMPLOYEE_EXPENSE', nature: 'DEBIT', isSystemAccount: true, description: 'Employee gross base salaries and allowances' },
  { code: '5220', name: 'Employer PF Contribution', type: 'EXPENSE', subtype: 'EMPLOYEE_EXPENSE', nature: 'DEBIT', isSystemAccount: true, description: 'Company statutory PF match' },
  { code: '5225', name: 'Employer ESI Contribution', type: 'EXPENSE', subtype: 'EMPLOYEE_EXPENSE', nature: 'DEBIT', isSystemAccount: true, description: 'Company statutory ESI match' },
  { code: '5230', name: 'Employee Welfare & Team Refreshments', type: 'EXPENSE', subtype: 'EMPLOYEE_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Pantry snacks, team lunches, celebrations' },
  { code: '5240', name: 'Performance Bonuses & Incentives', type: 'EXPENSE', subtype: 'EMPLOYEE_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Quarterly KPI bonuses' },
  { code: '5310', name: 'Office Commercial Rent', type: 'EXPENSE', subtype: 'OFFICE_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Monthly studio and office rental' },
  { code: '5320', name: 'Electricity & Water Utilities', type: 'EXPENSE', subtype: 'OFFICE_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Studio power and utility bills' },
  { code: '5330', name: 'Internet & Telecommunications', type: 'EXPENSE', subtype: 'OFFICE_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'High-speed fiber and studio connectivity' },
  { code: '5410', name: 'Cloud Infrastructure & Web Hosting', type: 'EXPENSE', subtype: 'TECH_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'AWS, Hostinger, Vercel, MongoDB Atlas' },
  { code: '5420', name: 'SaaS Software Subscriptions', type: 'EXPENSE', subtype: 'TECH_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Figma, Adobe CC, GitHub, Slack' },
  { code: '5510', name: 'Digital Advertising & Paid Campaigns', type: 'EXPENSE', subtype: 'SALES_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Meta, Google Ads, LinkedIn marketing' },
  { code: '5520', name: 'Client Entertainment & Travel', type: 'EXPENSE', subtype: 'SALES_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Client meeting dining, travel reimbursements' },
  { code: '5610', name: 'Depreciation Expense', type: 'EXPENSE', subtype: 'DEPRECIATION_EXPENSE', nature: 'DEBIT', isSystemAccount: true, description: 'Monthly fixed asset write-off' },
  { code: '5620', name: 'Bank Charges & Payment Processing Fees', type: 'EXPENSE', subtype: 'FINANCE_EXPENSE', nature: 'DEBIT', isSystemAccount: false, description: 'Wire fees, gateway commissions' },
];

export async function seedAccountingDefaults(): Promise<void> {
  try {
    // 1. Seed Chart of Accounts
    for (const accDef of DEFAULT_CHART_OF_ACCOUNTS) {
      const existing = await ChartOfAccount.findOne({ code: accDef.code });
      if (!existing) {
        await ChartOfAccount.create({
          ...accDef,
          currentBalance: 0,
          totalDebit: 0,
          totalCredit: 0,
          isActive: true,
        });
      }
    }

    // 2. Seed Default Tax Rates
    const gstAcc = await ChartOfAccount.findOne({ code: '2150' });
    const tdsAcc = await ChartOfAccount.findOne({ code: '2145' });

    if (gstAcc) {
      const defaultTaxes = [
        { name: 'GST 18% (Services Standard)', code: 'GST_18', ratePercentage: 18, taxType: 'OUTPUT_TAX', glAccount: gstAcc._id },
        { name: 'GST 12%', code: 'GST_12', ratePercentage: 12, taxType: 'OUTPUT_TAX', glAccount: gstAcc._id },
        { name: 'GST 5%', code: 'GST_5', ratePercentage: 5, taxType: 'OUTPUT_TAX', glAccount: gstAcc._id },
        { name: 'Tax Exempt / Zero Rate (0%)', code: 'EXEMPT_0', ratePercentage: 0, taxType: 'EXEMPT', glAccount: gstAcc._id },
      ];

      for (const tax of defaultTaxes) {
        const existingTax = await TaxRate.findOne({ code: tax.code });
        if (!existingTax) {
          await TaxRate.create(tax);
        }
      }
    }

    if (tdsAcc) {
      const tdsTaxes = [
        { name: 'TDS 194J - Professional / Technical Fees (10%)', code: 'TDS_194J', ratePercentage: 10, taxType: 'TDS_PAYABLE', glAccount: tdsAcc._id },
        { name: 'TDS 194C - Contractor (2%)', code: 'TDS_194C', ratePercentage: 2, taxType: 'TDS_PAYABLE', glAccount: tdsAcc._id },
      ];
      for (const t of tdsTaxes) {
        const existingTds = await TaxRate.findOne({ code: t.code });
        if (!existingTds) {
          await TaxRate.create(t);
        }
      }
    }

    // 3. Seed Default Bank Account
    const bankGlAcc = await ChartOfAccount.findOne({ code: '1130' });
    if (bankGlAcc) {
      const existingBank = await BankAccount.findOne({ glAccount: bankGlAcc._id });
      if (!existingBank) {
        await BankAccount.create({
          accountName: 'HDFC Bank Corporate Current Account',
          bankName: 'HDFC Bank Ltd.',
          accountNumber: '50200088192831',
          ifscSwift: 'HDFC0001234',
          branchName: 'Connaught Place, New Delhi',
          accountType: 'CURRENT',
          currency: 'INR',
          glAccount: bankGlAcc._id,
          openingBalance: 0,
          currentBalance: 0,
          isActive: true,
        });
      }
    }

    // 4. Seed Active Fiscal Year (FY 2026-27)
    const currentYear = new Date().getFullYear();
    const fyName = `FY ${currentYear}-${String(currentYear + 1).slice(-2)}`;
    let fy = await FiscalYear.findOne({ name: fyName });
    if (!fy) {
      fy = await FiscalYear.create({
        name: fyName,
        startDate: new Date(`${currentYear}-04-01T00:00:00.000Z`),
        endDate: new Date(`${currentYear + 1}-03-31T23:59:59.999Z`),
        isClosed: false,
        isActive: true,
      });
    }

    console.log(`[Accounting Seed] Successfully verified and initialized Chart of Accounts, Tax Rates, and Fiscal Year.`);
  } catch (err) {
    console.error('[Accounting Seed Error]', err);
  }
}
