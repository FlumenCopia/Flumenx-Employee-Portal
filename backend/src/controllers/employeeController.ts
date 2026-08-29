import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { EmployeeDocument } from '../models/EmployeeDocument.js';


export async function getEmployees(req: Request, res: Response): Promise<void> {
  const { department, status, search } = req.query;

  const filter: any = {};
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR', 'ACCOUNTANT', 'BDE'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  if (!isSuper && !isManagement) {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp) {
      res.json({ count: 0, next: null, previous: null, results: [] });
      return;
    }

    if (isTeamLead && ownEmp.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      filter.$or = [
        { department: deptRegex },
        { _id: ownEmp._id },
      ];
    } else if (ownEmp.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      filter.$or = [
        { department: deptRegex },
        { _id: ownEmp._id },
      ];
    }
  }

  if (department && department !== 'All') {
    filter.department = department;
  }
  if (status) filter.status = status;
  if (search) {
    const searchFilter = [
      { name: { $regex: search as string, $options: 'i' } },
      { employeeCode: { $regex: search as string, $options: 'i' } },
      { email: { $regex: search as string, $options: 'i' } },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchFilter }];
      delete filter.$or;
    } else {
      filter.$or = searchFilter;
    }
  }

  const employees = await Employee.find(filter)
    .populate('user departmentRef teamLead')
    .sort({ name: 1 });

  const formatted = employees.map((e) => ({
    id: e._id,
    employee_code: e.employeeCode,
    name: e.name,
    email: e.email,
    phone: e.phone,
    department: e.department,
    designation: e.designation,
    joining_date: e.joiningDate ? e.joiningDate.toISOString().split('T')[0] : '',
    status: e.status,
    employment_status: e.employmentStatus || 'Probation',
    probation_start_date: e.probationStartDate ? e.probationStartDate.toISOString().split('T')[0] : null,
    probation_end_date: e.probationEndDate ? e.probationEndDate.toISOString().split('T')[0] : null,
    confirmation_date: e.confirmationDate ? e.confirmationDate.toISOString().split('T')[0] : null,
    location: e.location,
    avatar: e.avatar,
    user: e.user ? (e.user as any)._id : null,
  }));

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function getEmployeeById(req: Request, res: Response): Promise<void> {
  const employee = await Employee.findById(req.params.id).populate('user departmentRef teamLead');

  if (!employee) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }

  // Fetch Salary Structure
  const { EmployeeSalaryStructure } = await import('../models/EmployeeSalaryStructure.js');
  const structure = await EmployeeSalaryStructure.findOne({ employee: employee._id, isActive: true });

  // Fetch Leave Balances
  const { LeaveLedger } = await import('../models/LeaveLedger.js');
  const ledgers = await LeaveLedger.find({ employee: employee._id });
  let sickBalance = 0;
  let casualBalance = 0;
  for (const l of ledgers) {
    const qty = l.quantity || 0;
    const mult = ['OpeningBalance', 'MonthlyAccrual', 'Reversal', 'Credit'].includes(l.transactionType) ? 1 : -1;
    if (l.leaveType === 'Sick') sickBalance += qty * mult;
    if (l.leaveType === 'Casual') casualBalance += qty * mult;
  }

  res.json({
    id: employee._id,
    employee_code: employee.employeeCode,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    designation: employee.designation,
    joining_date: employee.joiningDate ? employee.joiningDate.toISOString().split('T')[0] : '',
    status: employee.status,
    employment_status: employee.employmentStatus || 'Permanent',
    probation_start_date: employee.probationStartDate ? employee.probationStartDate.toISOString().split('T')[0] : null,
    probation_end_date: employee.probationEndDate ? employee.probationEndDate.toISOString().split('T')[0] : null,
    confirmation_date: employee.confirmationDate ? employee.confirmationDate.toISOString().split('T')[0] : null,
    exit_date: employee.exitDate ? employee.exitDate.toISOString().split('T')[0] : null,
    location: employee.location || 'HQ Office',
    avatar: employee.avatar || '',
    team_lead: employee.teamLead ? { id: (employee.teamLead as any)._id, name: (employee.teamLead as any).name, code: (employee.teamLead as any).employeeCode } : null,
    user: employee.user ? { id: (employee.user as any)._id, username: (employee.user as any).username, role: (employee.user as any).role } : null,
    salary_structure: structure ? {
      id: structure._id,
      gross_salary: structure.grossSalary,
      basic_salary: structure.basicSalary,
      hra: structure.hra,
      conveyance: structure.conveyance,
      special_allowance: structure.specialAllowance,
      other_allowances: structure.otherAllowances,
      pf_applicable: structure.pfApplicable !== undefined ? structure.pfApplicable : structure.pfEnabled,
      voluntary_pf: Boolean(structure.voluntaryPfAboveCeiling),
      esi_applicable: structure.esiApplicable !== undefined ? structure.esiApplicable : structure.esiEnabled,
      professional_tax_applicable: structure.professionalTaxApplicable !== undefined ? structure.professionalTaxApplicable : true,
      professional_tax: structure.professionalTax || 200,
      tds_applicable: Boolean(structure.tdsApplicable),
      tds: structure.tds || 0,
      salary_history: structure.salaryHistory || [],
    } : null,
    leave_balances: {
      sick: Math.max(0, sickBalance),
      casual: Math.max(0, casualBalance),
    },
  });
}

export async function createEmployee(req: Request, res: Response): Promise<void> {
  const body = req.body || {};
  const {
    employee_code,
    name,
    email,
    phone,
    department,
    designation,
    joining_date,
    status,
    employment_status,
    probation_start_date,
    probation_end_date,
    confirmation_date,
    avatar,
    location,
    team_lead,
    user_id,
  } = body;

  let code = employee_code ? String(employee_code).trim() : '';
  if (!code) {
    const totalCount = await Employee.countDocuments();
    let num = totalCount + 1;
    code = `FX-${String(num).padStart(3, '0')}`;
    while (await Employee.findOne({ employeeCode: code })) {
      num += 1;
      code = `FX-${String(num).padStart(3, '0')}`;
    }
  }

  if (!name || !email || !phone || !department || !designation || !joining_date) {
    res.status(400).json({ detail: 'Required employee fields are missing.' });
    return;
  }

  const existingCode = await Employee.findOne({ employeeCode: code });
  if (existingCode) {
    res.status(400).json({ detail: 'Employee code already exists.' });
    return;
  }

  const deptObj = await Department.findOne({ name: department });

  const empStatus = employment_status || 'Probation';
  const joinDateObj = new Date(joining_date);
  const pStart = probation_start_date ? new Date(probation_start_date) : joinDateObj;
  const pEnd = probation_end_date ? new Date(probation_end_date) : new Date(joinDateObj.getTime() + 90 * 24 * 3600 * 1000);

  const employee = new Employee({
    employeeCode: code,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    department,
    departmentRef: deptObj ? deptObj._id : null,
    designation: designation.trim(),
    joiningDate: joinDateObj,
    status: status || 'Active',
    employmentStatus: empStatus,
    probationStartDate: pStart,
    probationEndDate: empStatus === 'Probation' ? pEnd : null,
    confirmationDate: empStatus === 'Permanent' ? (confirmation_date ? new Date(confirmation_date) : new Date()) : null,
    avatar: avatar || '',
    location: location || '',
    teamLead: team_lead || null,
    user: user_id || null,
  });

  await employee.save();
  res.status(201).json({
    id: employee._id,
    employee_code: employee.employeeCode,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    designation: employee.designation,
    joining_date: employee.joiningDate.toISOString().split('T')[0],
    status: employee.status,
    employment_status: employee.employmentStatus,
    probation_end_date: employee.probationEndDate ? employee.probationEndDate.toISOString().split('T')[0] : null,
    confirmation_date: employee.confirmationDate ? employee.confirmationDate.toISOString().split('T')[0] : null,
  });
}

export async function updateEmployee(req: Request, res: Response): Promise<void> {
  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }

  const {
    name,
    email,
    phone,
    department,
    designation,
    joining_date,
    status,
    employment_status,
    probation_start_date,
    probation_end_date,
    confirmation_date,
    avatar,
    location,
    team_lead,
  } = req.body;

  if (name) employee.name = name.trim();
  if (email) employee.email = email.trim().toLowerCase();
  if (phone) employee.phone = phone.trim();
  if (department) {
    employee.department = department;
    const deptObj = await Department.findOne({ name: department });
    if (deptObj) employee.departmentRef = deptObj._id as any;
  }
  if (designation) employee.designation = designation.trim();
  if (joining_date) employee.joiningDate = new Date(joining_date);
  if (status) employee.status = status;

  if (employment_status) {
    employee.employmentStatus = employment_status;
    if (employment_status === 'Permanent' && !employee.confirmationDate) {
      employee.confirmationDate = confirmation_date ? new Date(confirmation_date) : new Date();
    }
  }
  if (probation_start_date !== undefined) {
    employee.probationStartDate = probation_start_date ? new Date(probation_start_date) : null;
  }
  if (probation_end_date !== undefined) {
    employee.probationEndDate = probation_end_date ? new Date(probation_end_date) : null;
  }
  if (confirmation_date !== undefined) {
    employee.confirmationDate = confirmation_date ? new Date(confirmation_date) : null;
  }

  if (avatar !== undefined) employee.avatar = avatar;
  if (location !== undefined) employee.location = location;
  if (team_lead !== undefined) employee.teamLead = team_lead || null;

  await employee.save();
  res.json({
    id: employee._id,
    employee_code: employee.employeeCode,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    designation: employee.designation,
    joining_date: employee.joiningDate ? employee.joiningDate.toISOString().split('T')[0] : '',
    status: employee.status,
    employment_status: employee.employmentStatus,
    probation_start_date: employee.probationStartDate ? employee.probationStartDate.toISOString().split('T')[0] : null,
    probation_end_date: employee.probationEndDate ? employee.probationEndDate.toISOString().split('T')[0] : null,
    confirmation_date: employee.confirmationDate ? employee.confirmationDate.toISOString().split('T')[0] : null,
  });
}

export async function deleteEmployee(req: Request, res: Response): Promise<void> {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }

  // Deactivate linked User account to prevent ghost logins and orphaned credentials
  if (employee.user) {
    await User.findByIdAndUpdate(employee.user, { isActive: false });
  } else if (employee.email) {
    await User.findOneAndUpdate({ email: employee.email }, { isActive: false });
  }

  res.status(204).send();
}

// ------------------------------------------------------------------
// Employee Document Management Handlers
// ------------------------------------------------------------------

export async function getEmployeeDocuments(req: Request, res: Response): Promise<void> {
  try {
    const employeeId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(400).json({ detail: 'Invalid employee ID format.' });
      return;
    }

    // IDOR Protection: Non-HR/Admin users can only view their own employee documents
    if (req.user && ['EMPLOYEE', 'TEAM_LEAD', 'BDE', 'OPERATIONS'].includes(req.user.role) && !req.user.isSuperuser) {
      const ownEmployee = await Employee.findOne({ user: req.user._id });
      if (!ownEmployee || ownEmployee._id.toString() !== String(employeeId)) {
        res.status(403).json({ detail: 'You are not authorized to view documents for another employee.' });
        return;
      }
    }

    const docs = await EmployeeDocument.find({ employee: employeeId }).sort({ createdAt: -1 });

    const formatted = docs.map((d) => ({
      id: d._id,
      employee_id: d.employee,
      title: d.title,
      document_type: d.documentType,
      file_name: d.fileName,
      file_url: d.fileUrl,
      file_type: d.fileType,
      file_size: d.fileSize,
      created_at: d.createdAt.toISOString(),
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function uploadEmployeeDocument(req: Request, res: Response): Promise<void> {
  const employeeId = req.params.id;
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ detail: 'No document file uploaded.' });
    return;
  }

  const { title, document_type, documentType } = req.body;
  const docTitle = title ? title.trim() : req.file.originalname;
  const typeVal = document_type || documentType || 'Other';

  const fileUrl = `/media/employee_documents/${req.file.filename}`;

  const doc = new EmployeeDocument({
    employee: employee._id,
    title: docTitle,
    documentType: typeVal,
    fileName: req.file.originalname,
    fileUrl,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    uploadedBy: req.user ? req.user._id : null,
  });

  await doc.save();

  res.status(201).json({
    id: doc._id,
    employee_id: doc.employee,
    title: doc.title,
    document_type: doc.documentType,
    file_name: doc.fileName,
    file_url: doc.fileUrl,
    file_type: doc.fileType,
    file_size: doc.fileSize,
    created_at: doc.createdAt.toISOString(),
  });
}

export async function deleteEmployeeDocument(req: Request, res: Response): Promise<void> {
  const { docId } = req.params;
  const doc = await EmployeeDocument.findById(docId);
  if (!doc) {
    res.status(404).json({ detail: 'Document not found.' });
    return;
  }

  // Attempt to delete file from disk
  try {
    const filename = path.basename(doc.fileUrl);
    const diskPath = path.join(process.cwd(), 'media', 'employee_documents', filename);
    if (fs.existsSync(diskPath)) {
      fs.unlinkSync(diskPath);
    }
  } catch (err) {
    console.error('Failed to unlink document file:', err);
  }

  await doc.deleteOne();
  res.status(204).send();
}

