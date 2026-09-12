import { Request, Response } from 'express';
import { Vendor } from '../../models/accounting/Vendor.js';
import { TaxRate, FixedAsset, CostCenter, Budget, FiscalYear, AccountingPeriod } from '../../models/accounting/AccountingEntities.js';
import { Client } from '../../models/Client.js';
import { Project } from '../../models/Project.js';
import { postJournalEntry } from '../../services/accounting/accountingEngine.js';

// ==========================================
// VENDORS CONTROLLER
// ==========================================
export async function getVendors(req: Request, res: Response): Promise<void> {
  const vendors = await Vendor.find().sort({ name: 1 });
  res.json({ count: vendors.length, results: vendors });
}

export async function createVendor(req: Request, res: Response): Promise<void> {
  const { name, code, taxId, email, phone, contactPerson, address, bankDetails, paymentTerms, defaultExpenseAccount } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ detail: 'Vendor name is required.' });
    return;
  }

  const vendorCode = (code && code.trim()) ? code.trim() : `VEND-${Date.now().toString().slice(-4)}`;

  const vendor = new Vendor({
    name: name.trim(),
    code: vendorCode,
    taxId: taxId || '',
    email: email || '',
    phone: phone || '',
    contactPerson: contactPerson || '',
    address: address || '',
    bankDetails: bankDetails || {},
    paymentTerms: paymentTerms || 'Net 30 Days',
    defaultExpenseAccount: defaultExpenseAccount || null,
    isActive: true,
  });

  await vendor.save();
  res.status(201).json(vendor);
}

// ==========================================
// TAX RATES CONTROLLER
// ==========================================
export async function getTaxRates(req: Request, res: Response): Promise<void> {
  const taxes = await TaxRate.find().sort({ ratePercentage: 1 }).populate('glAccount', 'code name');
  res.json({ count: taxes.length, results: taxes });
}

export async function createTaxRate(req: Request, res: Response): Promise<void> {
  const { name, code, ratePercentage, taxType, glAccount, description } = req.body;
  if (!name || !code || ratePercentage === undefined || !glAccount) {
    res.status(400).json({ detail: 'Name, code, ratePercentage, and glAccount are required.' });
    return;
  }

  const tax = new TaxRate({
    name: name.trim(),
    code: code.trim(),
    ratePercentage: Number(ratePercentage),
    taxType: taxType || 'OUTPUT_TAX',
    glAccount,
    description: description || '',
    isActive: true,
  });

  await tax.save();
  res.status(201).json(tax);
}

// ==========================================
// FIXED ASSETS CONTROLLER
// ==========================================
export async function getFixedAssets(req: Request, res: Response): Promise<void> {
  const assets = await FixedAsset.find().sort({ purchaseDate: -1 })
    .populate('assetAccount', 'code name')
    .populate('accumulatedDepreciationAccount', 'code name')
    .populate('depreciationExpenseAccount', 'code name')
    .populate('assignedEmployee', 'name employeeCode');

  res.json({ count: assets.length, results: assets });
}

export async function createFixedAsset(req: Request, res: Response): Promise<void> {
  const {
    assetCode,
    name,
    category,
    purchaseDate,
    purchaseCost,
    residualValue,
    usefulLifeMonths,
    depreciationMethod,
    assetAccount,
    accumulatedDepreciationAccount,
    depreciationExpenseAccount,
    assignedEmployee,
    location,
    serialNumber,
    notes,
  } = req.body;

  if (!assetCode || !name || !category || purchaseCost === undefined || !usefulLifeMonths || !assetAccount) {
    res.status(400).json({ detail: 'Asset code, name, category, purchase cost, useful life, and asset account are required.' });
    return;
  }

  const cost = Number(purchaseCost);
  const asset = new FixedAsset({
    assetCode: assetCode.trim(),
    name: name.trim(),
    category: category.trim(),
    purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
    purchaseCost: cost,
    residualValue: Number(residualValue || 0),
    usefulLifeMonths: Number(usefulLifeMonths),
    depreciationMethod: depreciationMethod || 'STRAIGHT_LINE',
    assetAccount,
    accumulatedDepreciationAccount,
    depreciationExpenseAccount,
    currentBookValue: cost,
    accumulatedDepreciation: 0,
    status: 'ACTIVE',
    assignedEmployee: assignedEmployee || null,
    location: location || 'Head Office',
    serialNumber: serialNumber || '',
    notes: notes || '',
  });

  await asset.save();
  res.status(201).json(asset);
}

export async function runMonthlyDepreciation(req: Request, res: Response): Promise<void> {
  const { month, year } = req.body;
  const assets = await FixedAsset.find({ status: 'ACTIVE', currentBookValue: { $gt: 0 } });

  let postedCount = 0;
  let totalDepreciationAmount = 0;

  for (const asset of assets) {
    // Straight-line monthly depreciation: (Cost - Residual) / UsefulLifeMonths
    const depreciableBase = Math.max(0, asset.purchaseCost - (asset.residualValue || 0));
    const monthlyDepr = Math.round((depreciableBase / asset.usefulLifeMonths) * 100) / 100;

    const actualDepr = Math.min(monthlyDepr, asset.currentBookValue);
    if (actualDepr > 0) {
      await postJournalEntry({
        date: new Date(),
        voucherType: 'DEPRECIATION',
        referenceNumber: `DEP-${asset.assetCode}-${month}-${year}`,
        sourceType: 'DEPRECIATION',
        sourceId: asset._id as any,
        description: `Depreciation write-off for ${asset.name} (${asset.assetCode}) - ${month}/${year}`,
        lines: [
          {
            accountId: asset.depreciationExpenseAccount,
            debit: actualDepr,
            credit: 0,
            description: `Depreciation Expense - ${asset.name}`,
          },
          {
            accountId: asset.accumulatedDepreciationAccount,
            debit: 0,
            credit: actualDepr,
            description: `Accumulated Depreciation - ${asset.name}`,
          },
        ],
        userId: req.user?._id,
      });

      asset.accumulatedDepreciation = Math.round((asset.accumulatedDepreciation + actualDepr) * 100) / 100;
      asset.currentBookValue = Math.max(0, Math.round((asset.currentBookValue - actualDepr) * 100) / 100);
      asset.lastDepreciationDate = new Date();
      await asset.save();

      postedCount++;
      totalDepreciationAmount += actualDepr;
    }
  }

  res.json({
    message: `Processed depreciation for ${postedCount} active fixed assets.`,
    totalDepreciationAmount: Math.round(totalDepreciationAmount * 100) / 100,
  });
}

// ==========================================
// COST CENTERS & BUDGETS
// ==========================================
export async function getCostCenters(req: Request, res: Response): Promise<void> {
  const centers = await CostCenter.find({ isActive: true }).sort({ name: 1 });
  res.json({ count: centers.length, results: centers });
}

export async function createCostCenter(req: Request, res: Response): Promise<void> {
  const { code, name, category, description } = req.body;
  if (!code || !name) {
    res.status(400).json({ detail: 'Code and name are required.' });
    return;
  }

  const cc = new CostCenter({
    code: code.trim(),
    name: name.trim(),
    category: category || 'GENERAL',
    description: description || '',
    isActive: true,
  });

  await cc.save();
  res.status(201).json(cc);
}

// ==========================================
// FISCAL YEAR & ACCOUNTING PERIODS
// ==========================================
export async function getFiscalYears(req: Request, res: Response): Promise<void> {
  const years = await FiscalYear.find().sort({ startDate: -1 });
  res.json({ count: years.length, results: years });
}

export async function getAccountingPeriods(req: Request, res: Response): Promise<void> {
  const periods = await AccountingPeriod.find().sort({ year: -1, month: -1 }).populate('fiscalYear', 'name');
  res.json({ count: periods.length, results: periods });
}

export async function lockAccountingPeriod(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { checklist } = req.body;

  const period = await AccountingPeriod.findById(id);
  if (!period) {
    res.status(404).json({ detail: 'Accounting period not found.' });
    return;
  }

  if (checklist) {
    period.closingChecklist = { ...period.closingChecklist, ...checklist };
  }

  period.status = 'LOCKED';
  period.lockedAt = new Date();
  period.lockedBy = req.user?._id;
  await period.save();

  res.json({
    message: `Accounting period ${period.month}/${period.year} successfully locked.`,
    period,
  });
}

// ==========================================
// ERP CLIENTS & PROJECTS INTEGRATION
// ==========================================
export async function getAccountingClients(req: Request, res: Response): Promise<void> {
  const clients = await Client.find({ isActive: { $ne: false } })
    .select('name industry contactPerson website address retainerMonthlyFee servicesProvided isActive')
    .sort({ name: 1 });
  res.json({ count: clients.length, results: clients });
}

export async function getAccountingProjects(req: Request, res: Response): Promise<void> {
  const { client } = req.query;
  const filter: any = { status: { $ne: 'Archived' } };
  if (client) filter.client = client;
  const projects = await Project.find(filter).select('name client code status budgetHours').sort({ name: 1 });
  res.json({ count: projects.length, results: projects });
}
