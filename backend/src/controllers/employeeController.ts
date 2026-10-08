import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { EmployeeDocument } from '../models/EmployeeDocument.js';
import { DynamicRole } from '../models/DynamicRole.js';
import { EmployeeSalaryStructure } from '../models/EmployeeSalaryStructure.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { resolveUserPermissions } from '../services/permissionResolver.js';
import { getEmployeeForUser } from '../utils/employeeResolver.js';
import { getRoleDataScope } from '../services/scopeResolver.js';


export async function getEmployees(req: Request, res: Response): Promise<void> {
  const { department, status, search } = req.query;

  const filter: any = {};
  const isSuper = req.user?.role === 'SUPER_ADMIN' || Boolean(req.user?.isSuperuser) || (req.user as any)?.dynamicRole?.isSuperadminWildcard;
  const empScope = await getRoleDataScope(req.user, 'EMPLOYEES');

  if (!isSuper && empScope !== 'ALL') {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp) {
      res.json({ count: 0, next: null, previous: null, results: [] });
      return;
    }

    if (empScope === 'DEPARTMENT' && ownEmp.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      filter.$or = [
        { department: deptRegex },
        { _id: ownEmp._id },
      ];
    } else if (empScope === 'TEAM') {
      const deptRegex = ownEmp.department ? new RegExp(`^${ownEmp.department.trim()}$`, 'i') : null;
      filter.$or = [
        { teamLead: ownEmp._id },
        { _id: ownEmp._id },
        ...(deptRegex ? [{ department: deptRegex }] : []),
      ];
    } else {
      // OWN scope: strictly own employee record
      filter._id = ownEmp._id;
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
    avatar: e.avatar || (e.user as any)?.avatar || '',
    user: e.user ? (e.user as any)._id : null,
    bank_name: e.bankName || '',
    bank_account_number: e.bankAccountNumber || '',
    bank_ifsc: e.bankIfsc || '',
    bank_branch: e.bankBranch || '',
    pan_number: e.panNumber || '',
    uan_number: e.uanNumber || '',
    pf_number: e.pfNumber || '',
    esi_number: e.esiNumber || '',
  }));

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function getEmployeeById(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }
  const employee = await Employee.findById(req.params.id).populate('user departmentRef teamLead');

  if (!employee) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }

  // Fetch Salary Structure
  const { EmployeeSalaryStructure } = await import('../models/EmployeeSalaryStructure.js');
  const structure = await EmployeeSalaryStructure.findOne({ employee: employee._id, isActive: true });

  // Fetch Leave Balances using leaveEngine
  const { getEmployeeLeaveBalance } = await import('../services/leaveEngine.js');
  const leaveBal = await getEmployeeLeaveBalance(employee._id as any);

  const isSuper = req.user?.role === 'SUPER_ADMIN' || Boolean(req.user?.isSuperuser) || (req.user as any)?.dynamicRole?.isSuperadminWildcard;
  const isSelf = req.user && employee.user && String((employee.user as any)._id || employee.user) === String(req.user._id);
  const permissions = req.user ? await resolveUserPermissions(req.user) : {};
  const canViewCompensation = isSuper || isSelf || Boolean(permissions.SALARY_SLIPS?.canView || permissions.ACCOUNTING?.canView);

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
    avatar: employee.avatar || (employee.user as any)?.avatar || '',
    team_lead: employee.teamLead ? { id: (employee.teamLead as any)._id, name: (employee.teamLead as any).name, code: (employee.teamLead as any).employeeCode } : null,
    user: employee.user ? { id: (employee.user as any)._id, username: (employee.user as any).username, role: (employee.user as any).role } : null,

    // Banking & Statutory Information
    bank_name: employee.bankName || '',
    bank_account_number: employee.bankAccountNumber || '',
    bank_ifsc: employee.bankIfsc || '',
    bank_branch: employee.bankBranch || '',
    pan_number: employee.panNumber || '',
    uan_number: employee.uanNumber || '',
    pf_number: employee.pfNumber || '',
    esi_number: employee.esiNumber || '',

    salary_structure: (canViewCompensation && structure) ? {
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
      sick: leaveBal.sickLeaveBalance,
      casual: leaveBal.casualLeaveBalance,
      total_paid: leaveBal.totalPaidLeaveBalance,
      carried_forward: leaveBal.carriedForwardBalance,
      availed_this_month: leaveBal.availedThisMonth,
      converted_to_salary: leaveBal.convertedToSalary,
    },
  });
}

export async function createEmployee(req: Request, res: Response): Promise<void> {
  try {
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
      password,
      portal_role,
      bank_name,
      bankName,
      bank_account_number,
      bankAccountNumber,
      bank_ifsc,
      bankIfsc,
      bank_branch,
      bankBranch,
      pan_number,
      panNumber,
      uan_number,
      uanNumber,
      pf_number,
      pfNumber,
      esi_number,
      esiNumber,
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

    const cleanEmail = email.trim().toLowerCase();

    const existingCode = await Employee.findOne({ employeeCode: code });
    if (existingCode) {
      res.status(400).json({ detail: 'Employee code already exists.' });
      return;
    }

    const existingEmail = await Employee.findOne({ email: cleanEmail });
    if (existingEmail) {
      res.status(400).json({ detail: 'An employee with this email already exists.' });
      return;
    }

    const deptObj = await Department.findOne({ name: department });

    const empStatus = employment_status || 'Probation';
    const joinDateObj = new Date(joining_date);
    const pStart = probation_start_date ? new Date(probation_start_date) : joinDateObj;
    const pEnd = probation_end_date ? new Date(probation_end_date) : new Date(joinDateObj.getTime() + 90 * 24 * 3600 * 1000);

    // 1. Resolve or Create User Account
    let linkedUserId: any = user_id || null;
    const roleToAssign = (portal_role || 'EMPLOYEE').toUpperCase();
    const dynRole = await DynamicRole.findOne({ code: roleToAssign });

    if (!linkedUserId) {
      let userDoc = await User.findOne({ email: cleanEmail });
      if (userDoc) {
        linkedUserId = userDoc._id;
        userDoc.isActive = (status || 'Active') === 'Active';
        if (password) {
          await userDoc.setPassword(password);
        }
        if (portal_role) {
          userDoc.role = roleToAssign as any;
          if (dynRole) userDoc.dynamicRole = dynRole._id as any;
        }
        await userDoc.save();
      } else {
        const nameParts = (name || '').trim().split(' ');
        const firstName = nameParts[0] || 'Employee';
        const lastName = nameParts.slice(1).join(' ') || '';
        const baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
        let finalUsername = baseUsername;
        let counter = 1;
        while (await User.findOne({ username: finalUsername })) {
          finalUsername = `${baseUsername}_${counter++}`;
        }

        const newUser = new User({
          username: finalUsername,
          email: cleanEmail,
          firstName,
          lastName,
          role: roleToAssign as any,
          dynamicRole: dynRole ? dynRole._id : null,
          isActive: (status || 'Active') === 'Active',
          isStaff: roleToAssign === 'SUPER_ADMIN' || Boolean(dynRole?.isSuperadminWildcard) || Boolean(dynRole?.permissions?.some((p: any) => p.canCreate || p.canEdit)),
        });
        await newUser.setPassword(password || 'password123');
        await newUser.save();
        linkedUserId = newUser._id;
      }
    }

    const employee = new Employee({
      employeeCode: code,
      name: name.trim(),
      email: cleanEmail,
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
      user: linkedUserId,
      bankName: (bankName || bank_name || '').trim(),
      bankAccountNumber: (bankAccountNumber || bank_account_number || '').trim(),
      bankIfsc: (bankIfsc || bank_ifsc || '').trim(),
      bankBranch: (bankBranch || bank_branch || '').trim(),
      panNumber: (panNumber || pan_number || '').trim(),
      uanNumber: (uanNumber || uan_number || '').trim(),
      pfNumber: (pfNumber || pf_number || '').trim(),
      esiNumber: (esiNumber || esi_number || '').trim(),
    });

    await employee.save();

    // 2. Initialize default EmployeeSalaryStructure if not existing
    const existingStructure = await EmployeeSalaryStructure.findOne({ employee: employee._id });
    if (!existingStructure) {
      const defaultSalary = new EmployeeSalaryStructure({
        employee: employee._id,
        effectiveDate: joinDateObj,
        grossSalary: 25000,
        basicSalary: 12500,
        hra: 6250,
        conveyance: 2000,
        specialAllowance: 4250,
        pfEnabled: true,
        pfEmployeePercent: 12,
        pfEmployerPercent: 12,
        pfWageCeiling: 15000,
        esiEnabled: false,
        professionalTax: 200,
        tds: 0,
        isActive: true,
      });
      await defaultSalary.save().catch((e: any) => console.error('[createEmployee] Failed to seed salary structure:', e));
    }

    // 3. Initialize LeaveLedger opening balances (Sick: 1, Casual: 1) if not existing
    const existingLedger = await LeaveLedger.findOne({ employee: employee._id });
    if (!existingLedger) {
      const now = new Date();
      await Promise.all([
        new LeaveLedger({
          employee: employee._id,
          leaveType: 'Sick',
          transactionType: 'OpeningBalance',
          quantity: 1,
          balanceAfter: 1,
          earnedMonth: now.getMonth() + 1,
          earnedYear: now.getFullYear(),
          notes: 'Initial monthly sick leave balance',
        }).save(),
        new LeaveLedger({
          employee: employee._id,
          leaveType: 'Casual',
          transactionType: 'OpeningBalance',
          quantity: 1,
          balanceAfter: 1,
          earnedMonth: now.getMonth() + 1,
          earnedYear: now.getFullYear(),
          notes: 'Initial monthly casual leave balance',
        }).save(),
      ]).catch((e: any) => console.error('[createEmployee] Failed to seed leave ledger:', e));
    }

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
  } catch (error: any) {
    res.status(400).json({ detail: error?.message || 'Failed to create employee.' });
  }
}

export async function updateEmployee(req: Request, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ detail: 'Employee not found.' });
      return;
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      res.status(404).json({ detail: 'Employee not found.' });
      return;
    }

    const {
      employee_code,
      employeeCode,
      portal_role,
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
      bank_name,
      bankName,
      bank_account_number,
      bankAccountNumber,
      bank_ifsc,
      bankIfsc,
      bank_branch,
      bankBranch,
      pan_number,
      panNumber,
      uan_number,
      uanNumber,
      pf_number,
      pfNumber,
      esi_number,
      esiNumber,
    } = req.body || {};

    const rawCode = employee_code !== undefined ? employee_code : employeeCode;
    if (rawCode !== undefined && rawCode !== null) {
      const code = String(rawCode).trim();
      if (!code) {
        res.status(400).json({ detail: 'Employee code cannot be empty.', employee_code: 'Employee code cannot be empty.' });
        return;
      }
      if (code !== employee.employeeCode) {
        const existingCode = await Employee.findOne({ employeeCode: code, _id: { $ne: employee._id } });
        if (existingCode) {
          res.status(400).json({ detail: 'Employee code already exists.', employee_code: 'Employee code already exists.' });
          return;
        }
        employee.employeeCode = code;
      }
    }

    if (name) employee.name = name.trim();
    if (email) {
      const newEmail = email.trim().toLowerCase();
      if (newEmail !== employee.email) {
        const existingEmail = await Employee.findOne({ email: newEmail, _id: { $ne: employee._id } });
        if (existingEmail) {
          res.status(400).json({ detail: 'Email already exists.', email: 'Email already exists.' });
          return;
        }
        employee.email = newEmail;
        if (employee.user) {
          await User.findByIdAndUpdate(employee.user, { email: newEmail });
        }
      }
    }
    if (phone) employee.phone = phone.trim();
    if (department) {
      employee.department = department;
      const deptObj = await Department.findOne({ name: department });
      if (deptObj) employee.departmentRef = deptObj._id as any;
    }
    if (designation) employee.designation = designation.trim();
    if (joining_date) employee.joiningDate = new Date(joining_date);
    if (status) {
      employee.status = status;
      const isActive = status === 'Active';
      if (employee.user) {
        await User.findByIdAndUpdate(employee.user, { isActive });
      } else if (employee.email) {
        await User.findOneAndUpdate({ email: employee.email }, { isActive });
      }
    }

    if (portal_role) {
      const dynRole = await DynamicRole.findOne({ code: portal_role.toUpperCase() });
      if (employee.user) {
        await User.findByIdAndUpdate(employee.user, {
          role: portal_role.toUpperCase(),
          ...(dynRole ? { dynamicRole: dynRole._id } : {}),
        });
      } else if (employee.email) {
        const u = await User.findOneAndUpdate(
          { email: employee.email },
          {
            role: portal_role.toUpperCase(),
            ...(dynRole ? { dynamicRole: dynRole._id } : {}),
          }
        );
        if (u) employee.user = u._id;
      }
    }

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

    if (bankName !== undefined || bank_name !== undefined) employee.bankName = String(bankName ?? bank_name ?? '').trim();
    if (bankAccountNumber !== undefined || bank_account_number !== undefined) employee.bankAccountNumber = String(bankAccountNumber ?? bank_account_number ?? '').trim();
    if (bankIfsc !== undefined || bank_ifsc !== undefined) employee.bankIfsc = String(bankIfsc ?? bank_ifsc ?? '').trim();
    if (bankBranch !== undefined || bank_branch !== undefined) employee.bankBranch = String(bankBranch ?? bank_branch ?? '').trim();
    if (panNumber !== undefined || pan_number !== undefined) employee.panNumber = String(panNumber ?? pan_number ?? '').trim();
    if (uanNumber !== undefined || uan_number !== undefined) employee.uanNumber = String(uanNumber ?? uan_number ?? '').trim();
    if (pfNumber !== undefined || pf_number !== undefined) employee.pfNumber = String(pfNumber ?? pf_number ?? '').trim();
    if (esiNumber !== undefined || esi_number !== undefined) employee.esiNumber = String(esiNumber ?? esi_number ?? '').trim();

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
      location: employee.location || '',
      avatar: employee.avatar || '',
      bank_name: employee.bankName || '',
      bank_account_number: employee.bankAccountNumber || '',
      bank_ifsc: employee.bankIfsc || '',
      bank_branch: employee.bankBranch || '',
      pan_number: employee.panNumber || '',
      uan_number: employee.uanNumber || '',
      pf_number: employee.pfNumber || '',
      esi_number: employee.esiNumber || '',
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      const msg = `${field === 'employeeCode' ? 'Employee code' : field} already exists.`;
      res.status(400).json({ detail: msg, [field === 'employeeCode' ? 'employee_code' : field]: msg });
      return;
    }
    res.status(400).json({ detail: error?.message || 'Failed to update employee.' });
  }
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

    // IDOR Protection: Scoped users can only view their own employee documents
    const isSuper = req.user?.role === 'SUPER_ADMIN' || Boolean(req.user?.isSuperuser) || (req.user as any)?.dynamicRole?.isSuperadminWildcard;
    const empScope = await getRoleDataScope(req.user, 'EMPLOYEES');
    if (req.user && !isSuper && empScope !== 'ALL') {
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

import { optimizeImageFile } from '../utils/imageOptimizer.js';

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

  // Optimize image files with sharp (max 1600x1600, quality 82)
  await optimizeImageFile(req.file.path, { maxWidth: 1600, maxHeight: 1600, quality: 82 });

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

