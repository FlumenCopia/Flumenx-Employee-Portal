import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { SalarySlip } from '../models/SalarySlip.js';
import { Employee } from '../models/Employee.js';
import { generatePdfSalarySlip } from '../services/pdfGenerator.js';

export async function getSalarySlips(req: Request, res: Response): Promise<void> {
  const { employee_id, year, month } = req.query;

  const filter: any = {};
  if (employee_id) filter.employee = employee_id;
  if (year) filter.year = parseInt(year as string, 10);
  if (month) filter.month = parseInt(month as string, 10);

  // If user is a regular EMPLOYEE (not SuperAdmin/Admin/HR/Accountant), restrict filter to their own Employee record
  if (req.user && ['EMPLOYEE', 'TEAM_LEAD', 'BDE', 'OPERATIONS'].includes(req.user.role) && !req.user.isSuperuser) {
    const ownEmployee = await Employee.findOne({ user: req.user._id });
    if (!ownEmployee) {
      res.json({ count: 0, next: null, previous: null, results: [] });
      return;
    }
    filter.employee = ownEmployee._id;
  }

  const slips = await SalarySlip.find(filter).populate('employee').sort({ year: -1, month: -1 });

  const formatted = slips.map((s) => {
    const emp = s.employee as any;
    return {
      id: s._id,
      employee: emp ? emp._id : null,
      employee_name: emp ? emp.name : 'Employee',
      employee_code: emp ? emp.employeeCode : 'N/A',
      month: s.month,
      year: s.year,
      gross_salary: s.grossSalary ? s.grossSalary.toString() : '0.00',
      net_salary: s.netSalary ? s.netSalary.toString() : '0.00',
      basic_salary: s.basicSalary || 0,
      hra: s.hra || 0,
      conveyance: s.conveyance || 0,
      allowances: s.allowances || 0,
      pf: s.pf || 0,
      tax: s.tax || 0,
      deductions: s.deductions || 0,
      uploaded_at: s.uploadedAt ? s.uploadedAt.toISOString() : new Date().toISOString(),
      file: s.file,
    };
  });

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function createSalarySlip(req: Request, res: Response): Promise<void> {
  const { employee_id, month, year, gross_salary, net_salary } = req.body;

  if (!employee_id || !month || !year) {
    res.status(400).json({ detail: 'Employee ID, month, and year are required.' });
    return;
  }

  const existing = await SalarySlip.findOne({
    employee: employee_id,
    month: parseInt(month, 10),
    year: parseInt(year, 10),
  });

  if (existing) {
    res.status(400).json({ detail: 'Salary slip already exists for this employee, month, and year.' });
    return;
  }

  const fileUrl = req.file ? `/media/salary_slips/${req.file.filename}` : '';

  const slip = new SalarySlip({
    employee: employee_id,
    month: parseInt(month, 10),
    year: parseInt(year, 10),
    file: fileUrl,
    grossSalary: gross_salary ? parseFloat(gross_salary) : 0,
    netSalary: net_salary ? parseFloat(net_salary) : 0,
  });

  await slip.save();
  res.status(201).json(slip);
}

export async function generateSalarySlip(req: Request, res: Response): Promise<void> {
  const {
    employee_id,
    month,
    year,
    basic_salary,
    hra,
    conveyance,
    allowances,
    pf,
    tax,
    deductions,
  } = req.body;

  if (!employee_id || !month || !year) {
    res.status(400).json({ detail: 'Employee ID, month, and year are required.' });
    return;
  }

  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const emp = await Employee.findById(employee_id);
  if (!emp) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }

  const basic = basic_salary ? parseFloat(basic_salary) : 0;
  const houseRent = hra ? parseFloat(hra) : 0;
  const conv = conveyance ? parseFloat(conveyance) : 0;
  const allow = allowances ? parseFloat(allowances) : 0;
  const pfVal = pf ? parseFloat(pf) : 0;
  const taxVal = tax ? parseFloat(tax) : 0;
  const dedVal = deductions ? parseFloat(deductions) : 0;

  const grossSalary = basic + houseRent + conv + allow;
  const netSalary = grossSalary - (pfVal + taxVal + dedVal);

  const fileName = `SalarySlip_${emp.employeeCode || emp._id}_${m}_${y}.pdf`;
  const relativePath = `/media/salary_slips/${fileName}`;
  const absolutePath = path.join(process.cwd(), 'media', 'salary_slips', fileName);

  await generatePdfSalarySlip(
    {
      employeeName: emp.name,
      employeeCode: emp.employeeCode || 'N/A',
      designation: emp.designation || 'Staff Member',
      department: emp.department || 'General',
      joiningDate: emp.joiningDate ? emp.joiningDate.toISOString().slice(0, 10) : '',
      month: m,
      year: y,
      basicSalary: basic,
      hra: houseRent,
      conveyance: conv,
      allowances: allow,
      pf: pfVal,
      tax: taxVal,
      deductions: dedVal,
      grossSalary,
      netSalary,
    },
    absolutePath
  );

  let slip = await SalarySlip.findOne({ employee: employee_id, month: m, year: y });

  if (slip) {
    slip.file = relativePath;
    slip.grossSalary = grossSalary;
    slip.netSalary = netSalary;
    slip.basicSalary = basic;
    slip.hra = houseRent;
    slip.conveyance = conv;
    slip.allowances = allow;
    slip.pf = pfVal;
    slip.tax = taxVal;
    slip.deductions = dedVal;
    slip.uploadedAt = new Date();
    await slip.save();
  } else {
    slip = new SalarySlip({
      employee: employee_id,
      month: m,
      year: y,
      file: relativePath,
      grossSalary,
      netSalary,
      basicSalary: basic,
      hra: houseRent,
      conveyance: conv,
      allowances: allow,
      pf: pfVal,
      tax: taxVal,
      deductions: dedVal,
      uploadedAt: new Date(),
    });
    await slip.save();
  }

  res.status(201).json(slip);
}

export async function downloadSalarySlip(req: Request, res: Response): Promise<void> {
  const slip = await SalarySlip.findById(req.params.id).populate('employee');
  if (!slip) {
    res.status(404).json({ detail: 'Salary slip not found.' });
    return;
  }

  // IDOR Protection: Non-admin/HR/Accountant users can only download their own salary slip
  if (req.user && ['EMPLOYEE', 'TEAM_LEAD', 'BDE', 'OPERATIONS'].includes(req.user.role) && !req.user.isSuperuser) {
    const ownEmployee = await Employee.findOne({ user: req.user._id });
    const slipEmpId = slip.employee && typeof slip.employee === 'object' && '_id' in slip.employee
      ? (slip.employee as any)._id.toString()
      : String(slip.employee || '');
    if (!ownEmployee || ownEmployee._id.toString() !== slipEmpId) {
      res.status(403).json({ detail: 'You are not authorized to download this salary slip.' });
      return;
    }
  }

  if (slip.file) {
    const relativePath = slip.file.replace(/^\/media\//, '');
    const absolutePath = path.join(process.cwd(), 'media', relativePath);
    if (fs.existsSync(absolutePath)) {
      res.download(absolutePath);
      return;
    }
  }

  const emp = slip.employee as any;
  const empName = emp ? emp.name : 'Employee';
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[slip.month - 1] || 'Month';

  const content = `FLUMENX EMPLOYEE PORTAL - SALARY SLIP
=========================================
Employee: ${empName}
Pay Period: ${monthName} ${slip.year}
Gross Salary: Rs. ${slip.grossSalary}
Net Salary: Rs. ${slip.netSalary}
Uploaded At: ${slip.uploadedAt ? slip.uploadedAt.toISOString().slice(0, 10) : ''}
=========================================
`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename=SalarySlip_${empName.replace(/\s+/g, '_')}_${monthName}_${slip.year}.txt`);
  res.send(content);
}

export async function deleteSalarySlip(req: Request, res: Response): Promise<void> {
  await SalarySlip.findByIdAndDelete(req.params.id);
  res.status(204).send();
}
