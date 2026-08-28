import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { SalaryHead } from '../models/SalaryHead.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { Employee } from '../models/Employee.js';
import { AuditLog } from '../models/AuditLog.js';

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
      default_amount: h.defaultAmount,
      is_statutory: h.isStatutory,
      display_order: h.displayOrder,
      description: h.description,
    })),
  });
}

export async function createSalaryHead(req: Request, res: Response): Promise<void> {
  const { name, code, type, calculation_type, percentage, percentage_base_head, default_amount, is_statutory, display_order, description } = req.body;

  if (!name || !code || !type) {
    res.status(400).json({ detail: 'Name, code, and type are required.' });
    return;
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
    defaultAmount: default_amount ? Number(default_amount) : 0,
    isStatutory: Boolean(is_statutory),
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

  const { name, type, calculation_type, percentage, percentage_base_head, default_amount, is_statutory, display_order, description } = req.body;

  if (name) head.name = String(name).trim();
  if (type) head.type = type;
  if (calculation_type) head.calculationType = calculation_type;
  if (percentage !== undefined) head.percentage = Number(percentage);
  if (percentage_base_head) head.percentageBaseHead = String(percentage_base_head).toUpperCase();
  if (default_amount !== undefined) head.defaultAmount = Number(default_amount);
  if (is_statutory !== undefined) head.isStatutory = Boolean(is_statutory);
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
  if (!head || !head.isActive) {
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
      details: `Deleted salary head: ${head.name} (${head.code})`,
    });
  } catch (err) {}

  res.json({ detail: 'Salary head deleted successfully.' });
}

// --- Employee Salary Structures ---

export async function getSalaryStructures(req: Request, res: Response): Promise<void> {
  const { department, search } = req.query;

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isAccountantOrHR = ['ADMIN', 'HR', 'ACCOUNTANT'].includes(req.user?.role || '');

  let employeeFilter: any = { status: 'Active' };
  if (department) {
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
      pfEnabled: true,
      pfEmployeePercent: 12,
      pfEmployerPercent: 12,
      pfWageCeiling: 15000,
      esiEnabled: false,
      esiEmployeePercent: 0.75,
      esiEmployerPercent: 3.25,
      esiGrossCeiling: 21000,
      professionalTax: 200,
      tds: 0,
      customHeads: [],
      isActive: true,
    });
    return;
  }

  res.json(structure);
}

export async function saveEmployeeSalaryStructure(req: Request, res: Response): Promise<void> {
  const {
    employee,
    ctc,
    grossSalary,
    basicSalary,
    hra,
    conveyance,
    specialAllowance,
    otherAllowances,
    pfEnabled,
    pfEmployeePercent,
    pfEmployerPercent,
    pfWageCeiling,
    esiEnabled,
    esiEmployeePercent,
    esiEmployerPercent,
    esiGrossCeiling,
    professionalTax,
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

  if (!structure) {
    structure = new EmployeeSalaryStructure({
      employee,
      ctc: Number(ctc || 0),
      grossSalary: Number(grossSalary),
      basicSalary: Number(basicSalary),
      hra: Number(hra || 0),
      conveyance: Number(conveyance || 0),
      specialAllowance: Number(specialAllowance || 0),
      otherAllowances: Number(otherAllowances || 0),
      pfEnabled: pfEnabled !== undefined ? Boolean(pfEnabled) : true,
      pfEmployeePercent: pfEmployeePercent !== undefined ? Number(pfEmployeePercent) : 12,
      pfEmployerPercent: pfEmployerPercent !== undefined ? Number(pfEmployerPercent) : 12,
      pfWageCeiling: pfWageCeiling !== undefined ? Number(pfWageCeiling) : 15000,
      esiEnabled: esiEnabled !== undefined ? Boolean(esiEnabled) : Number(grossSalary) <= 21000,
      esiEmployeePercent: esiEmployeePercent !== undefined ? Number(esiEmployeePercent) : 0.75,
      esiEmployerPercent: esiEmployerPercent !== undefined ? Number(esiEmployerPercent) : 3.25,
      esiGrossCeiling: esiGrossCeiling !== undefined ? Number(esiGrossCeiling) : 21000,
      professionalTax: professionalTax !== undefined ? Number(professionalTax) : 200,
      tds: tds !== undefined ? Number(tds) : 0,
      customHeads: Array.isArray(customHeads) ? customHeads : [],
      notes: notes ? String(notes).trim() : '',
      updatedBy: req.user?._id,
    });
  } else {
    structure.ctc = Number(ctc || structure.ctc || 0);
    structure.grossSalary = Number(grossSalary);
    structure.basicSalary = Number(basicSalary);
    structure.hra = Number(hra || 0);
    structure.conveyance = Number(conveyance || 0);
    structure.specialAllowance = Number(specialAllowance || 0);
    structure.otherAllowances = Number(otherAllowances || 0);
    if (pfEnabled !== undefined) structure.pfEnabled = Boolean(pfEnabled);
    if (pfEmployeePercent !== undefined) structure.pfEmployeePercent = Number(pfEmployeePercent);
    if (pfEmployerPercent !== undefined) structure.pfEmployerPercent = Number(pfEmployerPercent);
    if (pfWageCeiling !== undefined) structure.pfWageCeiling = Number(pfWageCeiling);
    if (esiEnabled !== undefined) structure.esiEnabled = Boolean(esiEnabled);
    if (esiEmployeePercent !== undefined) structure.esiEmployeePercent = Number(esiEmployeePercent);
    if (esiEmployerPercent !== undefined) structure.esiEmployerPercent = Number(esiEmployerPercent);
    if (esiGrossCeiling !== undefined) structure.esiGrossCeiling = Number(esiGrossCeiling);
    if (professionalTax !== undefined) structure.professionalTax = Number(professionalTax);
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
      details: `Updated salary structure for employee ${emp.name} (${emp.employeeCode}) - Gross: ₹${structure.grossSalary}`,
    });
  } catch (err) {}

  res.status(200).json(structure);
}
