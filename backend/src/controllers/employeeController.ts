import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { EmployeeDocument } from '../models/EmployeeDocument.js';


export async function getEmployees(req: Request, res: Response): Promise<void> {
  const { department, status, search } = req.query;

  const filter: any = {};
  if (department && department !== 'All') filter.department = department;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search as string, $options: 'i' } },
      { employeeCode: { $regex: search as string, $options: 'i' } },
      { email: { $regex: search as string, $options: 'i' } },
    ];
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
    location: employee.location,
    avatar: employee.avatar,
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

  const employee = new Employee({
    employeeCode: code,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    department,
    departmentRef: deptObj ? deptObj._id : null,
    designation: designation.trim(),
    joiningDate: new Date(joining_date),
    status: status || 'Active',
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
  });
}

export async function deleteEmployee(req: Request, res: Response): Promise<void> {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }
  res.status(204).send();
}

// ------------------------------------------------------------------
// Employee Document Management Handlers
// ------------------------------------------------------------------

export async function getEmployeeDocuments(req: Request, res: Response): Promise<void> {
  const employeeId = req.params.id;

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

