import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { SalaryHead } from '../models/SalaryHead.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { Employee } from '../models/Employee.js';
import { AuditLog } from '../models/AuditLog.js';
import { validateFormulaSyntax } from '../utils/formulaEvaluator.js';

// --- Salary Heads Management ---

export async function getSalaryHeads(req: Request, res: Response): Promise<void> {
  const heads = await SalaryHead.find({ isActive: true }).sort({ type: 1, displayOrder: 1 });
  res.json({
    count: heads.length,
    results: heads.map((h) => ({
      id: h._id,
      name: h.name,
      code: h.code,
      type: h.type,
      calculation_type: h.calculationType,
      percentage: h.percentage,
      percentage_base_head: h.percentageBaseHead,
      formula: h.formula || '',
      default_amount: h.defaultAmount,
      is_statutory: h.isStatutory,
      taxable: h.taxable,
      pf_eligible: h.pfEligible,
      esi_eligible: h.esiEligible,
      included_in_gross: h.includedInGross,
      included_in_net: h.includedInNet,
      display_order: h.displayOrder,
      description: h.description,
    })),
  });
}

export async function createSalaryHead(req: Request, res: Response): Promise<void> {
  const {
    name,
    code,
    type,
    calculation_type,
    percentage,
    percentage_base_head,
    formula,
    default_amount,
    is_statutory,
    taxable,
    pf_eligible,
    esi_eligible,
    included_in_gross,
    included_in_net,
    display_order,
    description,
  } = req.body;

  if (!name || !code || !type) {
    res.status(400).json({ detail: 'Name, code, and type are required.' });
    return;
  }

  if (formula) {
    const fCheck = validateFormulaSyntax(String(formula));
    if (!fCheck.valid) {
      res.status(400).json({ detail: `Invalid formula syntax: ${fCheck.error}` });
      return;
    }
  }

  const cleanCode = String(code).trim().toUpperCase();
  const existing = await SalaryHead.findOne({ code: cleanCode, isActive: true });
  if (existing) {
    res.status(400).json({ detail: `Salary head with code ${cleanCode} already exists.` });
    return;
  }

  const head = new SalaryHead({
    name: String(name).trim(),
    code: cleanCode,
    type,
    calculationType: calculation_type || 'Fixed',
    percentage: percentage ? Number(percentage) : 0,
    percentageBaseHead: percentage_base_head ? String(percentage_base_head).toUpperCase() : 'BASIC',
    formula: formula ? String(formula).trim() : '',
    defaultAmount: default_amount ? Number(default_amount) : 0,
    isStatutory: Boolean(is_statutory),
    taxable: taxable !== undefined ? Boolean(taxable) : true,
    pfEligible: Boolean(pf_eligible),
    esiEligible: Boolean(esi_eligible),
    includedInGross: included_in_gross !== undefined ? Boolean(included_in_gross) : true,
    includedInNet: included_in_net !== undefined ? Boolean(included_in_net) : true,
    displayOrder: display_order ? Number(display_order) : 0,
    description: description ? String(description).trim() : '',
  });

  await head.save();

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'CREATE_SALARY_HEAD',
      module: 'PAYROLL',
      details: `Created salary head: ${head.name} (${head.code})`,
    });
  } catch (err) {}

  res.status(201).json(head);
}

export async function updateSalaryHead(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid salary head ID.' });
    return;
  }

  const head = await SalaryHead.findById(id);
  if (!head || !head.isActive) {
    res.status(404).json({ detail: 'Salary head not found.' });
    return;
  }

  const {
    name,
    type,
    calculation_type,
    percentage,
    percentage_base_head,
    formula,
    default_amount,
    is_statutory,
    taxable,
    pf_eligible,
    esi_eligible,
    included_in_gross,
    included_in_net,
    display_order,
    description,
  } = req.body;

  if (formula !== undefined) {
    const fCheck = validateFormulaSyntax(String(formula));
    if (!fCheck.valid) {
      res.status(400).json({ detail: `Invalid formula syntax: ${fCheck.error}` });
      return;
    }
    head.formula = String(formula).trim();
  }

  if (name) head.name = String(name).trim();
  if (type) head.type = type;
  if (calculation_type) head.calculationType = calculation_type;
  if (percentage !== undefined) head.percentage = Number(percentage);
  if (percentage_base_head) head.percentageBaseHead = String(percentage_base_head).toUpperCase();
  if (default_amount !== undefined) head.defaultAmount = Number(default_amount);
  if (is_statutory !== undefined) head.isStatutory = Boolean(is_statutory);
  if (taxable !== undefined) head.taxable = Boolean(taxable);
  if (pf_eligible !== undefined) head.pfEligible = Boolean(pf_eligible);
  if (esi_eligible !== undefined) head.esiEligible = Boolean(esi_eligible);
  if (included_in_gross !== undefined) head.includedInGross = Boolean(included_in_gross);
  if (included_in_net !== undefined) head.includedInNet = Boolean(included_in_net);
  if (display_order !== undefined) head.displayOrder = Number(display_order);
  if (description !== undefined) head.description = String(description).trim();

  await head.save();

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'UPDATE_SALARY_HEAD',
      module: 'PAYROLL',
      details: `Updated salary head: ${head.name} (${head.code})`,
    });
  } catch (err) {}

  res.json(head);
}

export async function deleteSalaryHead(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid salary head ID.' });
    return;
  }

  const head = await SalaryHead.findById(id);
  if (!head) {
    res.status(404).json({ detail: 'Salary head not found.' });
    return;
  }

  head.isActive = false;
  await head.save();

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'DELETE_SALARY_HEAD',
      module: 'PAYROLL',
      details: `Deleted (soft-deactivated) salary head: ${head.name} (${head.code})`,
    });
  } catch (err) {}

  res.json({ message: 'Salary head deleted successfully.' });
}

// --- Employee Salary Structures ---

export async function getSalaryStructures(req: Request, res: Response): Promise<void> {
  const { department, search } = req.query;

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isAccountantOrHR = ['ADMIN', 'HR', 'ACCOUNTANT'].includes(req.user?.role || '');

  const employeeFilter: any = { isActive: true };
  if (department && isAccountantOrHR) {
    employeeFilter.department = department;
  }
  if (search) {
    employeeFilter.$or = [
      { name: new RegExp(String(search), 'i') },
      { employeeCode: new RegExp(String(search), 'i') },
    ];
  }

  // If normal employee, only return their own structure
  if (!isSuper && !isAccountantOrHR) {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp) {
      res.json({ count: 0, results: [] });
      return;
    }
    employeeFilter._id = ownEmp._id;
  }

  const employees = await Employee.find(employeeFilter).select('_id name employeeCode department designation');
  const empIds = employees.map((e) => e._id);

  const structures = await EmployeeSalaryStructure.find({ employee: { $in: empIds }, isActive: true })
    .populate('employee', 'name employeeCode department designation')
    .sort({ createdAt: -1 });

  res.json({
    count: structures.length,
    results: structures,
  });
}

export async function getEmployeeSalaryStructure(req: Request, res: Response): Promise<void> {
  const { employeeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    res.status(400).json({ detail: 'Invalid employee ID format.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isAccountantOrHR = ['ADMIN', 'HR', 'ACCOUNTANT'].includes(req.user?.role || '');

  if (!isSuper && !isAccountantOrHR) {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp || ownEmp._id.toString() !== employeeId) {
      res.status(403).json({ detail: 'You do not have permission to view this employee salary structure.' });
      return;
    }
  }

  let structure = await EmployeeSalaryStructure.findOne({ employee: employeeId, isActive: true })
    .populate('employee', 'name employeeCode department designation');

  if (!structure) {
    const emp = await Employee.findById(employeeId);
    if (!emp) {
      res.status(404).json({ detail: 'Employee not found.' });
      return;
    }

    // Return blank default template
    res.json({
      employee: emp,
      grossSalary: 0,
      basicSalary: 0,
      hra: 0,
      conveyance: 0,
      specialAllowance: 0,
      otherAllowances: 0,
      pfApplicable: true,
      pfEnabled: true,
      voluntaryPfAboveCeiling: false,
      pfEmployeePercent: 12,
      pfEmployerPercent: 12,
      pfWageCeiling: 15000,
      esiApplicable: false,
      esiEnabled: false,
      esiEmployeePercent: 0.75,
      esiEmployerPercent: 3.25,
      esiGrossCeiling: 21000,
      professionalTaxApplicable: true,
      professionalTax: 200,
      tdsApplicable: false,
      tds: 0,
      customHeads: [],
      salaryHistory: [],
      isActive: true,
    });
    return;
  }

  res.json(structure);
}

export async function saveEmployeeSalaryStructure(req: Request, res: Response): Promise<void> {
  const {
    employee,
    effectiveFrom,
    ctc,
    grossSalary,
    basicSalary,
    hra,
    conveyance,
    specialAllowance,
    otherAllowances,
    pfApplicable,
    pfEnabled,
    voluntaryPfAboveCeiling,
    pfEmployeePercent,
    pfEmployerPercent,
    pfWageCeiling,
    esiApplicable,
    esiEnabled,
    esiEmployeePercent,
    esiEmployerPercent,
    esiGrossCeiling,
    professionalTaxApplicable,
    professionalTax,
    tdsApplicable,
    tds,
    customHeads,
    notes,
  } = req.body;

  if (!employee || !mongoose.Types.ObjectId.isValid(employee)) {
    res.status(400).json({ detail: 'Valid Employee ID is required.' });
    return;
  }

  if (grossSalary === undefined || basicSalary === undefined || Number(grossSalary) < 0 || Number(basicSalary) < 0) {
    res.status(400).json({ detail: 'Gross salary and basic salary must be valid non-negative numbers.' });
    return;
  }

  const emp = await Employee.findById(employee);
  if (!emp) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }

  let structure = await EmployeeSalaryStructure.findOne({ employee, isActive: true });

  const finalPfApplicable = pfApplicable !== undefined ? Boolean(pfApplicable) : (pfEnabled !== undefined ? Boolean(pfEnabled) : true);
  const finalEsiApplicable = esiApplicable !== undefined ? Boolean(esiApplicable) : (esiEnabled !== undefined ? Boolean(esiEnabled) : Number(grossSalary) <= 21000);
  const finalPtApplicable = professionalTaxApplicable !== undefined ? Boolean(professionalTaxApplicable) : true;
  const finalTdsApplicable = tdsApplicable !== undefined ? Boolean(tdsApplicable) : false;

  const newEffectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();

  const historySnapshot = {
    effectiveFrom: newEffectiveDate,
    effectiveUntil: null,
    grossSalary: Number(grossSalary),
    basicSalary: Number(basicSalary),
    hra: Number(hra || 0),
    conveyance: Number(conveyance || 0),
    specialAllowance: Number(specialAllowance || 0),
    otherAllowances: Number(otherAllowances || 0),
    pfApplicable: finalPfApplicable,
    voluntaryPfAboveCeiling: Boolean(voluntaryPfAboveCeiling),
    esiApplicable: finalEsiApplicable,
    professionalTaxApplicable: finalPtApplicable,
    tdsApplicable: finalTdsApplicable,
    customHeads: Array.isArray(customHeads) ? customHeads : [],
    updatedBy: req.user?._id,
    createdAt: new Date(),
    notes: notes ? String(notes).trim() : '',
  };

  if (!structure) {
    structure = new EmployeeSalaryStructure({
      employee,
      effectiveFrom: newEffectiveDate,
      ctc: Number(ctc || 0),
      grossSalary: Number(grossSalary),
      basicSalary: Number(basicSalary),
      hra: Number(hra || 0),
      conveyance: Number(conveyance || 0),
      specialAllowance: Number(specialAllowance || 0),
      otherAllowances: Number(otherAllowances || 0),
      pfApplicable: finalPfApplicable,
      pfEnabled: finalPfApplicable,
      voluntaryPfAboveCeiling: Boolean(voluntaryPfAboveCeiling),
      pfEmployeePercent: pfEmployeePercent !== undefined ? Number(pfEmployeePercent) : 12,
      pfEmployerPercent: pfEmployerPercent !== undefined ? Number(pfEmployerPercent) : 12,
      pfWageCeiling: pfWageCeiling !== undefined ? Number(pfWageCeiling) : 15000,
      esiApplicable: finalEsiApplicable,
      esiEnabled: finalEsiApplicable,
      esiEmployeePercent: esiEmployeePercent !== undefined ? Number(esiEmployeePercent) : 0.75,
      esiEmployerPercent: esiEmployerPercent !== undefined ? Number(esiEmployerPercent) : 3.25,
      esiGrossCeiling: esiGrossCeiling !== undefined ? Number(esiGrossCeiling) : 21000,
      professionalTaxApplicable: finalPtApplicable,
      professionalTax: professionalTax !== undefined ? Number(professionalTax) : 200,
      tdsApplicable: finalTdsApplicable,
      tds: tds !== undefined ? Number(tds) : 0,
      customHeads: Array.isArray(customHeads) ? customHeads : [],
      salaryHistory: [historySnapshot],
      notes: notes ? String(notes).trim() : '',
      updatedBy: req.user?._id,
    });
  } else {
    // Append previous version to history if gross or basic changed
    if (structure.grossSalary !== Number(grossSalary) || structure.basicSalary !== Number(basicSalary)) {
      structure.salaryHistory.push({
        effectiveFrom: structure.effectiveFrom || (structure as any).createdAt || new Date(),
        effectiveUntil: new Date(),
        grossSalary: structure.grossSalary,
        basicSalary: structure.basicSalary,
        hra: structure.hra,
        conveyance: structure.conveyance,
        specialAllowance: structure.specialAllowance,
        otherAllowances: structure.otherAllowances,
        pfApplicable: structure.pfApplicable,
        voluntaryPfAboveCeiling: structure.voluntaryPfAboveCeiling,
        esiApplicable: structure.esiApplicable,
        professionalTaxApplicable: structure.professionalTaxApplicable,
        tdsApplicable: structure.tdsApplicable,
        customHeads: structure.customHeads as any,
        updatedBy: structure.updatedBy,
        createdAt: (structure as any).updatedAt || new Date(),
        notes: structure.notes || '',
      });
    }

    structure.effectiveFrom = newEffectiveDate;
    structure.ctc = Number(ctc || structure.ctc || 0);
    structure.grossSalary = Number(grossSalary);
    structure.basicSalary = Number(basicSalary);
    structure.hra = Number(hra || 0);
    structure.conveyance = Number(conveyance || 0);
    structure.specialAllowance = Number(specialAllowance || 0);
    structure.otherAllowances = Number(otherAllowances || 0);
    structure.pfApplicable = finalPfApplicable;
    structure.pfEnabled = finalPfApplicable;
    structure.voluntaryPfAboveCeiling = Boolean(voluntaryPfAboveCeiling);
    if (pfEmployeePercent !== undefined) structure.pfEmployeePercent = Number(pfEmployeePercent);
    if (pfEmployerPercent !== undefined) structure.pfEmployerPercent = Number(pfEmployerPercent);
    if (pfWageCeiling !== undefined) structure.pfWageCeiling = Number(pfWageCeiling);
    structure.esiApplicable = finalEsiApplicable;
    structure.esiEnabled = finalEsiApplicable;
    if (esiEmployeePercent !== undefined) structure.esiEmployeePercent = Number(esiEmployeePercent);
    if (esiEmployerPercent !== undefined) structure.esiEmployerPercent = Number(esiEmployerPercent);
    if (esiGrossCeiling !== undefined) structure.esiGrossCeiling = Number(esiGrossCeiling);
    structure.professionalTaxApplicable = finalPtApplicable;
    if (professionalTax !== undefined) structure.professionalTax = Number(professionalTax);
    structure.tdsApplicable = finalTdsApplicable;
    if (tds !== undefined) structure.tds = Number(tds);
    if (Array.isArray(customHeads)) structure.customHeads = customHeads;
    if (notes !== undefined) structure.notes = String(notes).trim();
    structure.updatedBy = req.user?._id;
  }

  await structure.save();

  try {
    await AuditLog.create({
      user: req.user?._id,
      action: 'UPDATE_SALARY_STRUCTURE',
      module: 'PAYROLL',
      details: `Updated salary structure for employee ${emp.name} (${emp.employeeCode}) - Gross: ₹${structure.grossSalary}, Basic: ₹${structure.basicSalary}, PF: ${finalPfApplicable}, ESI: ${finalEsiApplicable}`,
    });
  } catch (err) {}

  res.status(200).json(structure);
}
