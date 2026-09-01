import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { Client } from '../models/Client.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { ClientWorkShareLink } from '../models/ClientWorkShareLink.js';
import { syncQuantityState, syncFromDeliverables, syncParentTaskProgression, calculateClientKPIHealth } from '../services/workSyncEngine.js';
import { createShareLink, generateShareToken, getValidShareLink } from '../services/shareLinkService.js';

// --- Client Endpoints ---
export function formatClient(c: any) {
  return {
    id: c._id,
    name: c.name,
    industry: c.industry || 'General',
    is_active: c.isActive ?? true,
    isActive: c.isActive ?? true,
    notes: c.notes || '',
    contact_person: c.contactPerson || { name: '', email: '', phone: '', designation: '' },
    contactPerson: c.contactPerson || { name: '', email: '', phone: '', designation: '' },
    website: c.website || '',
    address: c.address || '',
    contract_start_date: c.contractStartDate ? new Date(c.contractStartDate).toISOString().split('T')[0] : null,
    contract_end_date: c.contractEndDate ? new Date(c.contractEndDate).toISOString().split('T')[0] : null,
    contractStartDate: c.contractStartDate ? new Date(c.contractStartDate).toISOString().split('T')[0] : null,
    contractEndDate: c.contractEndDate ? new Date(c.contractEndDate).toISOString().split('T')[0] : null,
    retainer_monthly_fee: c.retainerMonthlyFee || 0,
    retainerMonthlyFee: c.retainerMonthlyFee || 0,
    documents: (c.documents || []).map((d: any) => ({
      id: d._id,
      name: d.name,
      url: d.url,
      document_type: d.documentType || 'Other',
      documentType: d.documentType || 'Other',
      uploaded_at: d.uploadedAt ? new Date(d.uploadedAt).toISOString() : '',
    })),
    proposals: (c.proposals || []).map((p: any) => ({
      id: p._id,
      title: p.title,
      url: p.url || '',
      value: p.value || 0,
      status: p.status || 'Draft',
      uploaded_at: p.uploadedAt ? new Date(p.uploadedAt).toISOString() : '',
    })),
    brand_assets: (c.brandAssets || []).map((b: any) => ({
      id: b._id,
      name: b.name,
      url: b.url,
      asset_type: b.assetType || 'Logo',
      assetType: b.assetType || 'Logo',
      notes: b.notes || '',
    })),
    brandAssets: (c.brandAssets || []).map((b: any) => ({
      id: b._id,
      name: b.name,
      url: b.url,
      assetType: b.assetType || 'Logo',
      notes: b.notes || '',
    })),
    services_provided: c.servicesProvided || [],
    servicesProvided: c.servicesProvided || [],
    created_at: c.createdAt ? new Date(c.createdAt).toISOString() : '',
    updated_at: c.updatedAt ? new Date(c.updatedAt).toISOString() : '',
  };
}

export async function getClients(req: Request, res: Response): Promise<void> {
  const clients = await Client.find().sort({ name: 1 });
  const formatted = clients.map((c) => formatClient(c));
  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function getClientById(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  const client = await Client.findById(req.params.id);
  if (!client) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  res.json(formatClient(client));
}

export async function createClient(req: Request, res: Response): Promise<void> {
  const {
    name,
    industry,
    is_active,
    isActive,
    notes,
    contact_person,
    contactPerson,
    website,
    address,
    contract_start_date,
    contract_end_date,
    retainer_monthly_fee,
    proposals,
    brand_assets,
    brandAssets,
    services_provided,
    servicesProvided,
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ detail: 'Client name is required.' });
    return;
  }

  const cp = contact_person || contactPerson || {};
  const client = new Client({
    name: name.trim(),
    industry: (industry || '').trim() || 'General',
    isActive: is_active !== undefined ? Boolean(is_active) : isActive !== undefined ? Boolean(isActive) : true,
    notes: (notes || '').trim(),
    contactPerson: {
      name: (cp.name || '').trim(),
      email: (cp.email || '').trim(),
      phone: (cp.phone || '').trim(),
      designation: (cp.designation || '').trim(),
    },
    website: (website || '').trim(),
    address: (address || '').trim(),
    contractStartDate: contract_start_date ? new Date(contract_start_date) : null,
    contractEndDate: contract_end_date ? new Date(contract_end_date) : null,
    retainerMonthlyFee: retainer_monthly_fee ? Number(retainer_monthly_fee) : 0,
    proposals: Array.isArray(proposals) ? proposals : [],
    brandAssets: Array.isArray(brand_assets || brandAssets) ? (brand_assets || brandAssets) : [],
    servicesProvided: Array.isArray(services_provided || servicesProvided) ? (services_provided || servicesProvided) : [],
    documents: [],
  });

  await client.save();
  res.status(201).json(formatClient(client));
}

export async function updateClient(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  const client = await Client.findById(req.params.id);
  if (!client) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  if (req.body.name) client.name = req.body.name.trim();
  if (req.body.industry !== undefined) client.industry = String(req.body.industry).trim();
  if (req.body.is_active !== undefined) client.isActive = Boolean(req.body.is_active);
  if (req.body.isActive !== undefined) client.isActive = Boolean(req.body.isActive);
  if (req.body.notes !== undefined) client.notes = String(req.body.notes).trim();
  if (req.body.website !== undefined) client.website = String(req.body.website).trim();
  if (req.body.address !== undefined) client.address = String(req.body.address).trim();
  if (req.body.contract_start_date !== undefined) client.contractStartDate = req.body.contract_start_date ? new Date(req.body.contract_start_date) : null;
  if (req.body.contract_end_date !== undefined) client.contractEndDate = req.body.contract_end_date ? new Date(req.body.contract_end_date) : null;
  if (req.body.retainer_monthly_fee !== undefined) client.retainerMonthlyFee = Number(req.body.retainer_monthly_fee) || 0;

  const cp = req.body.contact_person || req.body.contactPerson;
  if (cp) {
    client.contactPerson = {
      name: cp.name !== undefined ? String(cp.name).trim() : client.contactPerson?.name || '',
      email: cp.email !== undefined ? String(cp.email).trim() : client.contactPerson?.email || '',
      phone: cp.phone !== undefined ? String(cp.phone).trim() : client.contactPerson?.phone || '',
      designation: cp.designation !== undefined ? String(cp.designation).trim() : client.contactPerson?.designation || '',
    };
  }

  if (Array.isArray(req.body.proposals)) client.proposals = req.body.proposals;
  if (Array.isArray(req.body.brand_assets || req.body.brandAssets)) {
    client.brandAssets = req.body.brand_assets || req.body.brandAssets;
  }
  if (Array.isArray(req.body.documents)) client.documents = req.body.documents;
  if (Array.isArray(req.body.services_provided || req.body.servicesProvided)) {
    client.servicesProvided = req.body.services_provided || req.body.servicesProvided;
  }

  await client.save();
  res.json(formatClient(client));
}

export async function uploadClientDocument(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  const client = await Client.findById(id);
  if (!client) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ detail: 'No file uploaded.' });
    return;
  }

  const { document_type, name, proposal_value, proposal_status, asset_type, notes } = req.body;
  const fileUrl = `/media/employee_documents/${req.file.filename}`;
  const docName = name || req.file.originalname;

  if (document_type === 'Proposal') {
    client.proposals.push({
      title: docName,
      url: fileUrl,
      value: proposal_value ? Number(proposal_value) : 0,
      status: (proposal_status || 'Sent') as any,
      uploadedAt: new Date(),
    });
  } else if (document_type === 'BrandAsset' || asset_type) {
    client.brandAssets.push({
      name: docName,
      url: fileUrl,
      assetType: (asset_type || 'Logo') as any,
      notes: notes || '',
    });
  } else {
    client.documents.push({
      name: docName,
      url: fileUrl,
      documentType: (document_type || 'Other') as any,
      uploadedAt: new Date(),
    });
  }

  await client.save();
  res.status(201).json(formatClient(client));
}

export async function deleteClientDocument(req: Request, res: Response): Promise<void> {
  const { id, docId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  const client = await Client.findById(id);
  if (!client) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }

  client.documents = (client.documents || []).filter((d: any) => String(d._id) !== docId && String(d.id) !== docId);
  client.proposals = (client.proposals || []).filter((p: any) => String(p._id) !== docId && String(p.id) !== docId);
  client.brandAssets = (client.brandAssets || []).filter((b: any) => String(b._id) !== docId && String(b.id) !== docId);

  await client.save();
  res.json(formatClient(client));
}

export async function uploadTaskAttachment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404).json({ detail: 'Task not found.' });
    return;
  }
  const task = await WorkAssignment.findById(id);
  if (!task) {
    res.status(404).json({ detail: 'Task not found.' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ detail: 'No file uploaded.' });
    return;
  }

  const fileUrl = `/media/employee_documents/${req.file.filename}`;
  const attachment = {
    name: req.body.name || req.file.originalname,
    url: fileUrl,
    fileType: req.file.mimetype || '',
    fileSize: req.file.size || 0,
    uploadedAt: new Date(),
    uploadedBy: req.user ? (req.user._id as any) : null,
    uploadedByName: req.user
      ? `${(req.user as any).firstName || ''} ${(req.user as any).lastName || ''}`.trim() || (req.user as any).username
      : 'User',
  };

  task.attachments.push(attachment as any);
  await task.save();

  const populated = await WorkAssignment.findById(task._id).populate('employee client project assignedBy reviewer');
  res.status(201).json(populated || task);
}

export async function deleteClient(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Client not found.' });
    return;
  }
  await Client.findByIdAndDelete(req.params.id);
  res.status(204).send();
}

export async function resolveEmployeeDoc(raw: any): Promise<mongoose.Types.ObjectId | null> {
  if (!raw) return null;
  const val = typeof raw === 'object' ? (raw._id || raw.id || raw.employee || raw.employee_id || raw.value) : raw;
  if (!val) return null;

  const strVal = String(val).trim();
  if (!strVal || strVal === 'null' || strVal === 'undefined' || strVal === 'Unassigned' || strVal === '0') return null;

  // 1. Try direct Employee ObjectId
  if (mongoose.Types.ObjectId.isValid(strVal)) {
    const directEmp = await Employee.findById(strVal);
    if (directEmp) return directEmp._id as mongoose.Types.ObjectId;

    // 2. Try User ObjectId -> find linked Employee
    const empByUser = await Employee.findOne({ user: strVal });
    if (empByUser) return empByUser._id as mongoose.Types.ObjectId;
  }

  // 3. Try legacyId number
  const num = Number(strVal);
  if (!isNaN(num) && num > 0) {
    const empByLegacy = await Employee.findOne({ legacyId: num });
    if (empByLegacy) return empByLegacy._id as mongoose.Types.ObjectId;
  }

  // 4. Try matching by employeeCode, email, or exact name
  const empByCode = await Employee.findOne({
    $or: [
      { employeeCode: strVal },
      { email: strVal.toLowerCase() },
      { name: new RegExp(`^${strVal}$`, 'i') },
    ],
  });
  if (empByCode) return empByCode._id as mongoose.Types.ObjectId;

  // 5. Try finding User by email/username and getting their Employee
  const userDoc = await User.findOne({
    $or: [{ email: strVal.toLowerCase() }, { username: strVal }],
  });
  if (userDoc) {
    let empByFoundUser = await Employee.findOne({ user: userDoc._id });
    if (!empByFoundUser) {
      const fullName = `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || userDoc.username || userDoc.email;
      empByFoundUser = await Employee.create({
        user: userDoc._id,
        name: fullName,
        email: userDoc.email,
        phone: '',
        department: userDoc.role === 'HR' ? 'HR' : userDoc.role === 'ACCOUNTANT' ? 'Accounts' : userDoc.role === 'BDE' ? 'Sales' : 'Operations',
        designation: userDoc.role,
        joiningDate: new Date(),
        status: 'Active',
        employmentStatus: 'Permanent',
        employeeCode: `EMP${String(Date.now()).slice(-4)}`,
        avatar: '',
        location: 'Main Office',
        trackingStatus: 'OFFLINE',
      });
    }
    return empByFoundUser._id as mongoose.Types.ObjectId;
  }

  return null;
}

export function formatWorkAssignmentDoc(a: any) {
  const emp = a.employee as any;
  const clientObj = a.client as any;
  const projectObj = a.project as any;
  const reviewerObj = a.reviewer as any;
  const parentObj = a.parentTask as any;
  const progressPct = a.assignedQuantity ? Math.round(((a.completedQuantity || 0) / a.assignedQuantity) * 100) : 0;

  let employeeName = 'Unassigned';
  let employeeId = null;

  if (emp) {
    if (typeof emp === 'object' && emp.name) {
      employeeName = emp.name;
      employeeId = emp._id;
    } else if (typeof emp === 'object' && (emp.username || emp.firstName)) {
      employeeName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.username;
      employeeId = emp._id;
    } else {
      employeeId = emp;
    }
  }

  return {
    id: a._id,
    title: a.title,
    description: a.description,
    priority: a.priority,
    status: a.status,
    assigned_date: a.assignedDate ? (a.assignedDate instanceof Date ? a.assignedDate.toISOString().split('T')[0] : String(a.assignedDate).split('T')[0]) : '',
    due_date: a.dueDate ? (a.dueDate instanceof Date ? a.dueDate.toISOString().split('T')[0] : String(a.dueDate).split('T')[0]) : '',
    completed_at: a.completedAt ? (a.completedAt instanceof Date ? a.completedAt.toISOString() : String(a.completedAt)) : null,
    assigned_quantity: a.assignedQuantity,
    completed_quantity: a.completedQuantity,
    progress_percentage: progressPct,
    progress: Math.min(100, Math.max(0, a.progress || progressPct)),
    unit: a.unit,
    department_category: a.departmentCategory || 'General',
    estimated_hours: a.estimatedHours || 0,
    actual_hours: a.actualHours || 0,
    overrun_hours: a.overrunHours || 0,
    is_overrun: Boolean(a.isOverrun),
    department_data: a.departmentData || {},
    employee: employeeId,
    employee_name: employeeName,
    client: clientObj ? (clientObj._id || clientObj) : null,
    client_name: clientObj ? (clientObj.name || 'General') : 'General',
    project: projectObj ? (projectObj._id || projectObj) : null,
    project_name: projectObj ? (projectObj.name || '') : '',
    parent_task: parentObj ? (parentObj._id || parentObj) : null,
    parent_task_title: parentObj ? (parentObj.title || '') : '',
    is_master_client_task: Boolean(a.isMasterClientTask),
    reviewer: reviewerObj ? (reviewerObj._id || reviewerObj) : null,
    reviewer_name: reviewerObj ? `${reviewerObj.firstName || ''} ${reviewerObj.lastName || ''}`.trim() || reviewerObj.username : a.reviewerName || '',
    review_status: a.reviewStatus,
    review_note: a.reviewNote,
    total_time_spent_seconds: a.totalTimeSpentSeconds || 0,
    active_timer: a.activeTimer && a.activeTimer.startedAt ? {
      started_at: (a.activeTimer.startedAt instanceof Date ? a.activeTimer.startedAt.toISOString() : String(a.activeTimer.startedAt)),
      started_by: a.activeTimer.startedBy,
    } : null,
    time_logs: a.timeLogs || [],
    time_adjustments: (a.timeAdjustments || []).map((ta: any) => ({
      id: ta._id,
      adjusted_at: ta.adjustedAt ? (ta.adjustedAt instanceof Date ? ta.adjustedAt.toISOString() : String(ta.adjustedAt)) : '',
      adjusted_by: ta.adjustedBy,
      adjusted_by_name: ta.adjustedByName || '',
      previous_seconds: ta.previousSeconds,
      new_seconds: ta.newSeconds,
      reason: ta.reason,
    })),
    deliverables: (a.deliverables || []).map((d: any) => ({
      id: d._id || d.id,
      name: d.name || d.title,
      title: d.title || d.name,
      brief: d.brief,
      work_type: d.workType || d.type || 'General',
      contracted: d.contracted || 1,
      delivered: d.delivered || (d.status === 'Completed' || d.status === 'Published' ? 1 : 0),
      due_date: d.dueDate ? (d.dueDate instanceof Date ? d.dueDate.toISOString().split('T')[0] : String(d.dueDate).split('T')[0]) : '',
      status: d.status,
      client: d.client,
    })),
    attachments: (a.attachments || []).map((att: any) => ({
      id: att._id || att.id,
      name: att.name,
      url: att.url,
      file_type: att.fileType || '',
      file_size: att.fileSize || 0,
      uploaded_at: att.uploadedAt ? (att.uploadedAt instanceof Date ? att.uploadedAt.toISOString() : String(att.uploadedAt)) : '',
      uploaded_by: att.uploadedBy,
      uploaded_by_name: att.uploadedByName || '',
    })),
  };
}

export async function resolveTeamLeadForEmployee(empId: mongoose.Types.ObjectId | string | null | undefined): Promise<{ userId: mongoose.Types.ObjectId | null; name: string } | null> {
  if (!empId) return null;
  const resolvedId = await resolveEmployeeDoc(empId);
  if (!resolvedId) return null;

  const emp = await Employee.findById(resolvedId).populate('teamLead user');
  if (!emp) return null;

  // 1. Direct teamLead populated on employee
  if (emp.teamLead) {
    const leadEmp = emp.teamLead as any;
    if (leadEmp.user) {
      const u = await User.findById(leadEmp.user);
      if (u) {
        return {
          userId: u._id as mongoose.Types.ObjectId,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || leadEmp.name || u.username,
        };
      }
    }
  }

  // 2. Department Team Lead lookup
  if (emp.department) {
    const deptRegex = new RegExp(`^${emp.department.trim()}$`, 'i');
    const leadEmp = await Employee.findOne({ department: deptRegex, _id: { $ne: emp._id } }).populate('user');
    if (leadEmp && leadEmp.user) {
      const u = await User.findOne({ _id: leadEmp.user, role: 'TEAM_LEAD' });
      if (u) {
        return {
          userId: u._id as mongoose.Types.ObjectId,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || leadEmp.name || u.username,
        };
      }
    }

    const teamLeadUser = await User.findOne({ role: 'TEAM_LEAD' });
    if (teamLeadUser) {
      return {
        userId: teamLeadUser._id as mongoose.Types.ObjectId,
        name: `${teamLeadUser.firstName || ''} ${teamLeadUser.lastName || ''}`.trim() || teamLeadUser.username,
      };
    }
  }

  return null;
}

// --- WorkAssignment Endpoints ---
export async function getWorkAssignments(req: Request, res: Response): Promise<void> {
  const { employee_id, client_id, status, priority, assigned_to_me, review_queue } = req.query;

  const filter: any = {};
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  if (review_queue === 'true') {
    // Dedicated Review Center queue
    filter.$or = [
      { reviewStatus: { $in: ['PENDING_REVIEW', 'CORRECTION_NEEDED'] } },
      { status: { $in: ['In Review', 'Changes Requested'] } },
    ];
    if (!isSuper && !isManagement) {
      const ownEmployee = req.user ? (await Employee.findOne({ user: req.user._id }) || await Employee.findById(req.user._id)) : null;
      if (isTeamLead && ownEmployee?.department) {
        const deptRegex = new RegExp(`^${ownEmployee.department.trim()}$`, 'i');
        const teamEmployees = await Employee.find({ department: deptRegex }).select('_id user');
        const teamEmpIds = [ownEmployee._id, ...teamEmployees.map((e) => e._id)];
        const teamUserIds = teamEmployees.map((e) => e.user).filter(Boolean);

        filter.$and = [
          {
            $or: [
              { reviewer: req.user?._id },
              { reviewer: ownEmployee._id },
              { employee: { $in: [...teamEmpIds, ...teamUserIds] } },
            ],
          },
        ];
      } else if (ownEmployee) {
        filter.$and = [
          {
            $or: [
              { reviewer: req.user?._id },
              { reviewer: ownEmployee._id },
            ],
          },
        ];
      }
    }
  } else if (!isSuper && !isManagement) {
    // Regular employees and BDEs can ONLY view their own assigned tasks
    const ownEmployee = req.user ? (await Employee.findOne({ user: req.user._id }) || await Employee.findById(req.user._id)) : null;
    if (!ownEmployee) {
      res.json({ count: 0, next: null, previous: null, results: [] });
      return;
    }

    const isMasterTaskQuery = req.query.is_master_client_task === 'true';

    if (!isMasterTaskQuery) {
      if (isTeamLead) {
        // Team lead sees their own tasks + tasks assigned to team members in their department
        const deptRegex = ownEmployee.department ? new RegExp(`^${ownEmployee.department.trim()}$`, 'i') : null;
        const teamEmployees = deptRegex ? await Employee.find({ department: deptRegex }).select('_id user') : [];
        const teamEmpIds = [ownEmployee._id, ...teamEmployees.map((e) => e._id)];
        const teamUserIds = teamEmployees.map((e) => e.user).filter(Boolean);

        if (assigned_to_me === 'true' || employee_id === 'me') {
          filter.$or = [{ employee: ownEmployee._id }, { employee: req.user?._id }];
        } else if (employee_id) {
          const targetEmpId = await resolveEmployeeDoc(employee_id);
          if (targetEmpId && teamEmpIds.some((id) => id.toString() === targetEmpId.toString())) {
            filter.$or = [{ employee: targetEmpId }];
          } else {
            // Cross-department access blocked
            res.json({ count: 0, next: null, previous: null, results: [] });
            return;
          }
        } else {
          filter.$or = [
            { employee: { $in: [...teamEmpIds, ...teamUserIds] } },
            { assignedBy: req.user?._id },
            { reviewer: ownEmployee._id },
            { reviewer: req.user?._id },
          ];
        }
      } else {
        // Standard EMPLOYEE or BDE strictly sees only own tasks
        filter.$or = [
          { employee: ownEmployee._id },
          ...(req.user?._id ? [{ employee: req.user._id }] : []),
        ];
      }
    }
  } else {
    // SuperAdmin / Admin / HR / Operations
    if (assigned_to_me === 'true' || employee_id === 'me') {
      const ownEmp = req.user ? (await Employee.findOne({ user: req.user._id }) || await Employee.findById(req.user._id)) : null;
      if (ownEmp) {
        filter.$or = [{ employee: ownEmp._id }, { employee: req.user?._id }];
      }
    } else if (employee_id) {
      const targetEmpId = await resolveEmployeeDoc(employee_id);
      if (targetEmpId) filter.employee = targetEmpId;
    }
  }

  if (client_id && mongoose.Types.ObjectId.isValid(client_id as string)) {
    filter.client = client_id;
  }
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const { is_master_client_task, project_id, project, department_category } = req.query;
  if (is_master_client_task === 'true') {
    filter.isMasterClientTask = true;
  } else if (is_master_client_task === 'false') {
    filter.isMasterClientTask = { $ne: true };
  } else if (is_master_client_task === 'all') {
    // No filter on isMasterClientTask
  } else if (!review_queue) {
    filter.isMasterClientTask = { $ne: true };
  }

  const projId = project_id || project;
  if (projId && mongoose.Types.ObjectId.isValid(projId as string)) {
    filter.project = projId;
  }
  if (department_category) {
    filter.departmentCategory = department_category;
  }

  const assignments = await WorkAssignment.find(filter)
    .populate('employee client project assignedBy reviewer reviewedBy parentTask')
    .sort({ dueDate: 1 });

  const formatted = assignments.map((a) => formatWorkAssignmentDoc(a));

  res.json({
    count: formatted.length,
    next: null,
    previous: null,
    results: formatted,
  });
}

export async function startTaskTimer(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;

  // Strictly enforce that only the assigned employee can start the timer
  if (!isSuper) {
    if (!ownEmp || !assignment.employee || String(assignment.employee) !== String(ownEmp._id)) {
      res.status(403).json({ detail: 'Permission denied. You can only start the timer for tasks assigned to you.' });
      return;
    }
  }

  if (assignment.activeTimer && assignment.activeTimer.startedAt) {
    res.status(400).json({ detail: 'Timer is already running for this task.' });
    return;
  }

  const now = new Date();
  assignment.activeTimer = {
    startedAt: now,
    startedBy: req.user ? req.user._id : null,
  };

  if (assignment.status === 'Assigned' || assignment.status === 'Pending' || assignment.status === 'Backlog') {
    assignment.status = 'In Progress';
  }

  await assignment.save();

  // Create corresponding TimeEntry so timer engine & work board remain 100% synced
  try {
    const { TimeEntry } = await import('../models/TimeEntry.js');
    if (ownEmp) {
      // Auto-pause any running timer for this employee
      await TimeEntry.updateMany({ employee: ownEmp._id, status: 'RUNNING' }, { status: 'PAUSED' });
      await TimeEntry.create({
        employee: ownEmp._id,
        user: req.user?._id || null,
        client: assignment.client || null,
        project: assignment.project || null,
        task: assignment._id,
        startTime: now,
        status: 'RUNNING',
        isBillable: true,
        entryDate: now.toISOString().split('T')[0],
      });
    }
  } catch (err) {
    // Ignore non-critical TimeEntry creation error
  }

  res.json(assignment);
}

export async function stopTaskTimer(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  if (!assignment.activeTimer || !assignment.activeTimer.startedAt) {
    // Check if TimeEntry model has an active entry for this task
    const { TimeEntry } = await import('../models/TimeEntry.js');
    const timeEntry = await TimeEntry.findOne({ task: assignment._id, status: { $in: ['RUNNING', 'PAUSED'] } });
    if (timeEntry) {
      const now = new Date();
      timeEntry.endTime = now;
      timeEntry.status = 'STOPPED';
      const grossSec = Math.max(1, Math.round((now.getTime() - new Date(timeEntry.startTime).getTime()) / 1000));
      timeEntry.durationSeconds = grossSec;
      await timeEntry.save();
      assignment.totalTimeSpentSeconds = (assignment.totalTimeSpentSeconds || 0) + grossSec;
      assignment.activeTimer = null;
      await assignment.save();
      res.json(assignment);
      return;
    }
    // Clean up assignment activeTimer state and return success so UI unlocks cleanly
    assignment.activeTimer = null;
    await assignment.save();
    res.json(assignment);
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;

  // Enforce that only the assigned employee or the user who started it can stop it
  if (!isSuper) {
    const isAssignee = ownEmp && assignment.employee && String(assignment.employee) === String(ownEmp._id);
    const isStarter = assignment.activeTimer.startedBy && req.user && String(assignment.activeTimer.startedBy) === String(req.user._id);
    if (!isAssignee && !isStarter) {
      res.status(403).json({ detail: 'Permission denied. You can only stop timers for your own tasks.' });
      return;
    }
  }

  const startedAt = new Date(assignment.activeTimer.startedAt);
  const now = new Date();
  const durationSeconds = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 1000));

  assignment.timeLogs.push({
    startTime: startedAt,
    endTime: now,
    durationSeconds,
    loggedBy: req.user ? req.user._id : null,
  });

  assignment.totalTimeSpentSeconds = (assignment.totalTimeSpentSeconds || 0) + durationSeconds;
  assignment.activeTimer = null;

  await assignment.save();
  res.json(assignment);
}

export async function getWorkAssignmentsSummary(req: Request, res: Response): Promise<void> {
  const { employee, client, priority, is_master_client_task } = req.query;

  const filter: any = {};
  if (employee) filter.employee = employee;
  if (client) filter.client = client;
  if (priority) filter.priority = priority;

  if (is_master_client_task === 'true') {
    filter.isMasterClientTask = true;
  } else if (is_master_client_task === 'all') {
    // No filter
  } else {
    filter.isMasterClientTask = { $ne: true };
  }

  const assignments = await WorkAssignment.find(filter);

  let total = assignments.length;
  let pending = 0;
  let in_progress = 0;
  let blocked = 0;
  let completed = 0;
  let overdue = 0;
  let review_pending = 0;
  let review_ok = 0;
  let review_correction = 0;

  const todayStr = new Date().toISOString().slice(0, 10);

  for (const a of assignments) {
    if (a.status === 'Pending' || a.status === 'Assigned' || a.status === 'Backlog') pending++;
    else if (a.status === 'In Progress' || a.status === 'Ongoing') in_progress++;
    else if (a.status === 'Blocked') blocked++;
    else if (a.status === 'Completed' || a.status === 'Approved' || a.status === 'Published') completed++;

    const dueDateStr = a.dueDate ? (a.dueDate instanceof Date ? a.dueDate.toISOString().slice(0, 10) : String(a.dueDate)) : '';
    if (dueDateStr && dueDateStr < todayStr && !['Completed', 'Approved', 'Published'].includes(a.status)) {
      overdue++;
    }

    if (a.reviewStatus === 'PENDING_REVIEW') review_pending++;
    else if (a.reviewStatus === 'OK') review_ok++;
    else if (a.reviewStatus === 'CORRECTION_NEEDED') review_correction++;
  }

  res.json({
    total,
    pending,
    in_progress,
    blocked,
    completed,
    overdue,
    review_pending,
    review_ok,
    review_correction,
    overall_progress: total ? Math.round((completed / total) * 100) : 0,
  });
}

async function findWorkAssignmentByIdOrLegacy(id: string): Promise<any> {
  if (mongoose.Types.ObjectId.isValid(id)) {
    const doc = await WorkAssignment.findById(id);
    if (doc) return doc;
  }
  const num = Number(id);
  if (!isNaN(num)) {
    const doc = await WorkAssignment.findOne({ legacyId: num });
    if (doc) return doc;
  }
  return null;
}

export async function getWorkAssignmentById(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }
  await assignment.populate('employee client assignedBy reviewer reviewedBy parentTask');
  res.json(formatWorkAssignmentDoc(assignment));
}

export async function createWorkAssignment(req: Request, res: Response): Promise<void> {
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagementOrLead = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR', 'TEAM_LEAD'].includes(req.user?.role || '');

  if (!isSuper && !isManagementOrLead) {
    res.status(403).json({ detail: 'Permission denied. Only HR, Team Leads, and Management can create work assignments.' });
    return;
  }

  const {
    employee,
    employee_id,
    employeeId,
    assigned_to,
    assignedTo,
    client,
    clients,
    client_ids,
    project,
    project_id,
    parent_task,
    parentTask,
    is_master_client_task,
    department_category,
    departmentCategory,
    estimated_hours,
    estimatedHours,
    department_data,
    departmentData,
    title,
    description,
    priority,
    assigned_date,
    due_date,
    status,
    assigned_quantity,
    unit,
    reviewer,
  } = req.body;

  const rawEmp = employee ?? employee_id ?? employeeId ?? assigned_to ?? assignedTo;
  const resolvedEmpId = await resolveEmployeeDoc(rawEmp);

  if (!isSuper && req.user?.role === 'TEAM_LEAD' && resolvedEmpId && req.user) {
    const ownEmp = await Employee.findOne({ user: req.user._id });
    if (ownEmp && ownEmp.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      const targetEmp = await Employee.findById(resolvedEmpId);
      if (targetEmp && targetEmp.department && !deptRegex.test(targetEmp.department) && String(targetEmp._id) !== String(ownEmp._id)) {
        res.status(403).json({ detail: 'Permission denied. Team Leads can only assign tasks to members in their own department.' });
        return;
      }
    }
  }

  if (!title || !String(title).trim()) {
    res.status(400).json({ detail: 'Task title is required.' });
    return;
  }

  // Derive reviewer automatically if not passed
  let effectiveReviewer = reviewer && mongoose.Types.ObjectId.isValid(reviewer) ? reviewer : null;
  let effectiveReviewerName = '';
  if (!effectiveReviewer && resolvedEmpId) {
    const autoLead = await resolveTeamLeadForEmployee(resolvedEmpId);
    if (autoLead) {
      effectiveReviewer = autoLead.userId;
      effectiveReviewerName = autoLead.name;
    }
  }

  const parentId = parent_task || parentTask;
  const targetProjectId = project || project_id;
  const targetDepartmentCat = department_category || departmentCategory || 'General';
  const targetEstHours = Number(estimated_hours || estimatedHours || 0);
  const targetDeptData = department_data || departmentData || {};

  const rawDeliverables = Array.isArray(req.body.deliverables) ? req.body.deliverables : [];
  const sanitizedDeliverables = rawDeliverables.map((d: any) => {
    const rawStatus = String(d.status || 'Assigned');
    const capStatus = rawStatus === 'assigned' ? 'Assigned' : rawStatus === 'completed' ? 'Completed' : rawStatus === 'in_progress' ? 'In Progress' : rawStatus;
    return {
      id: d.id || String(Math.random()),
      title: (d.title || d.name || 'Deliverable').trim(),
      name: (d.name || d.title || 'Deliverable').trim(),
      type: d.type || d.work_type || '',
      workType: d.workType || d.work_type || 'General',
      contracted: Number(d.contracted || d.assigned_quantity || 1),
      delivered: Number(d.delivered || d.completed_quantity || 0),
      dueDate: d.dueDate || d.due_date ? new Date(d.dueDate || d.due_date) : new Date(Date.now() + 7 * 86400000),
      status: capStatus,
    };
  });

  const rawClientList = Array.isArray(clients) && clients.length > 0 
    ? clients 
    : Array.isArray(client_ids) && client_ids.length > 0 
    ? client_ids 
    : [client].filter(Boolean);

  const targetClientIds = rawClientList.filter((cid: any) => cid && mongoose.Types.ObjectId.isValid(String(cid)));

  if (targetClientIds.length > 1) {
    // Multi-Client Task Creation: Create separate independent task per client
    const createdTasks = [];
    for (const cId of targetClientIds) {
      const assignment = new WorkAssignment({
        employee: resolvedEmpId,
        client: cId,
        project: targetProjectId && mongoose.Types.ObjectId.isValid(targetProjectId) ? targetProjectId : null,
        parentTask: parentId && mongoose.Types.ObjectId.isValid(parentId) ? parentId : null,
        isMasterClientTask: Boolean(is_master_client_task),
        departmentCategory: targetDepartmentCat,
        estimatedHours: targetEstHours,
        departmentData: targetDeptData,
        title: title.trim(),
        description: description || '',
        priority: priority || 'Normal',
        assignedDate: assigned_date ? new Date(assigned_date) : new Date(),
        dueDate: due_date ? new Date(due_date) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
        status: status || 'Assigned',
        assignedQuantity: assigned_quantity || 1,
        unit: unit || 'tasks',
        deliverables: sanitizedDeliverables,
        assignedBy: req.user ? req.user._id : null,
        reviewer: effectiveReviewer,
        reviewerName: effectiveReviewerName,
      });

      syncQuantityState(assignment);
      await assignment.save();

      if (assignment.parentTask) {
        await syncParentTaskProgression(assignment);
      }
      await assignment.populate('employee client project assignedBy reviewer reviewedBy parentTask');
      createdTasks.push(formatWorkAssignmentDoc(assignment));
    }
    res.status(201).json(createdTasks);
    return;
  }

  const singleClient = targetClientIds.length === 1 ? targetClientIds[0] : (client && mongoose.Types.ObjectId.isValid(client) ? client : null);

  const assignment = new WorkAssignment({
    employee: resolvedEmpId,
    client: singleClient,
    project: targetProjectId && mongoose.Types.ObjectId.isValid(targetProjectId) ? targetProjectId : null,
    parentTask: parentId && mongoose.Types.ObjectId.isValid(parentId) ? parentId : null,
    isMasterClientTask: Boolean(is_master_client_task),
    departmentCategory: targetDepartmentCat,
    estimatedHours: targetEstHours,
    departmentData: targetDeptData,
    title: title.trim(),
    description: description || '',
    priority: priority || 'Normal',
    assignedDate: assigned_date ? new Date(assigned_date) : new Date(),
    dueDate: due_date ? new Date(due_date) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
    status: status || 'Assigned',
    assignedQuantity: assigned_quantity || 1,
    unit: unit || 'tasks',
    deliverables: sanitizedDeliverables,
    assignedBy: req.user ? req.user._id : null,
    reviewer: effectiveReviewer,
    reviewerName: effectiveReviewerName,
  });

  syncQuantityState(assignment);
  await assignment.save();

  if (assignment.parentTask) {
    await syncParentTaskProgression(assignment);
  }

  await assignment.populate('employee client project assignedBy reviewer reviewedBy parentTask');
  res.status(201).json(formatWorkAssignmentDoc(assignment));
}

export async function bulkCreateWorkAssignments(req: Request, res: Response): Promise<void> {
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagementOrLead = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR', 'TEAM_LEAD'].includes(req.user?.role || '');

  if (!isSuper && !isManagementOrLead) {
    res.status(403).json({ detail: 'Permission denied. Only HR, Team Leads, and Management can create work assignments.' });
    return;
  }

  const { employee, employee_id, employeeId, assigned_to, assignedTo, reviewer, priority, tasks } = req.body;

  const tasksList = Array.isArray(tasks) ? tasks : Array.isArray(req.body) ? req.body : [req.body];

  if (!tasksList || tasksList.length === 0) {
    res.status(400).json({ detail: 'Tasks list is required.' });
    return;
  }

  const rootEmp = employee ?? employee_id ?? employeeId ?? assigned_to ?? assignedTo;
  const resolvedRootEmpId = await resolveEmployeeDoc(rootEmp);

  const createdDocs = [];

  for (const t of tasksList) {
    const rawEmp = t.employee ?? t.employee_id ?? t.employeeId ?? t.assigned_to ?? t.assignedTo ?? rootEmp;
    const empId = await resolveEmployeeDoc(rawEmp) || resolvedRootEmpId;
    let revId = t.reviewer || reviewer;
    let revName = '';

    if (!revId && empId) {
      const autoLead = await resolveTeamLeadForEmployee(empId);
      if (autoLead) {
        revId = autoLead.userId;
        revName = autoLead.name;
      }
    }

    const rawClient = t.client || req.body.client || req.body.client_id;
    const clientVal = rawClient && mongoose.Types.ObjectId.isValid(rawClient) ? rawClient : null;
    const rawParent = t.parent_task || t.parentTask || req.body.parent_task || req.body.parentTask;
    const parentVal = rawParent && mongoose.Types.ObjectId.isValid(rawParent) ? rawParent : null;
    const isMasterTask = Boolean(t.is_master_client_task ?? req.body.is_master_client_task);

    const rawDeliverables = Array.isArray(t.deliverables) ? t.deliverables : Array.isArray(req.body.deliverables) ? req.body.deliverables : [];
    const sanitizedDeliverables = rawDeliverables.map((d: any) => {
      const rawStatus = String(d.status || 'Assigned');
      const capStatus = rawStatus === 'assigned' ? 'Assigned' : rawStatus === 'completed' ? 'Completed' : rawStatus === 'in_progress' ? 'In Progress' : rawStatus;
      return {
        id: d.id || String(Math.random()),
        title: (d.title || d.name || 'Deliverable').trim(),
        name: (d.name || d.title || 'Deliverable').trim(),
        type: d.type || d.work_type || '',
        workType: d.workType || d.work_type || 'General',
        contracted: Number(d.contracted || d.assigned_quantity || 1),
        delivered: Number(d.delivered || d.completed_quantity || 0),
        dueDate: d.dueDate || d.due_date ? new Date(d.dueDate || d.due_date) : new Date(Date.now() + 7 * 86400000),
        status: capStatus,
      };
    });

    const assignment = new WorkAssignment({
      employee: empId,
      client: clientVal,
      parentTask: parentVal,
      isMasterClientTask: isMasterTask,
      title: (t.title || 'Task').trim(),
      description: t.description || req.body.description || '',
      priority: t.priority || priority || 'Normal',
      assignedDate: t.assigned_date ? new Date(t.assigned_date) : new Date(),
      dueDate: t.due_date ? new Date(t.due_date) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
      status: t.status || 'Assigned',
      assignedQuantity: t.assigned_quantity || req.body.assigned_quantity || 1,
      unit: t.unit || req.body.unit || 'tasks',
      deliverables: sanitizedDeliverables,
      assignedBy: req.user ? req.user._id : null,
      reviewer: revId && mongoose.Types.ObjectId.isValid(revId) ? revId : null,
      reviewerName: revName,
    });

    syncQuantityState(assignment);
    await assignment.save();

    if (assignment.parentTask) {
      await syncParentTaskProgression(assignment);
    }

    await assignment.populate('employee client project assignedBy reviewer reviewedBy parentTask');
    createdDocs.push(formatWorkAssignmentDoc(assignment));
  }

  res.status(201).json(createdDocs);
}

export async function updateWorkAssignment(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  if (!isSuper && !isManagement) {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp) {
      res.status(403).json({ detail: 'No employee profile found.' });
      return;
    }

    const isAssignee = assignment.employee && String(assignment.employee) === String(ownEmp._id);
    const isReviewer = (assignment.reviewer && String(assignment.reviewer) === String(ownEmp._id)) ||
                       (assignment.reviewer && req.user && String(assignment.reviewer) === String(req.user._id));

    if (isTeamLead) {
      // Check if task belongs to own employee or someone in team lead's department or is reviewer
      const taskEmp = assignment.employee ? await Employee.findById(assignment.employee) : null;
      if (!isReviewer && taskEmp && taskEmp.department !== ownEmp.department && String(assignment.employee) !== String(ownEmp._id)) {
        res.status(403).json({ detail: 'Permission denied. You can only manage tasks within your department or assigned for review.' });
        return;
      }
    } else {
      // Standard employee can update tasks assigned to them OR assigned to them as reviewer
      if (!isAssignee && !isReviewer) {
        res.status(403).json({ detail: 'Permission denied. You can only update tasks assigned to you or assigned to you for review.' });
        return;
      }
    }
  }

  const fields = req.body;
  if (isSuper || isManagement || isTeamLead) {
    if (fields.title) assignment.title = fields.title.trim();
    if (fields.description !== undefined) assignment.description = fields.description;
    if (fields.priority) assignment.priority = fields.priority;
    if (fields.assigned_date) assignment.assignedDate = new Date(fields.assigned_date);
    if (fields.due_date) assignment.dueDate = new Date(fields.due_date);
    if (fields.assigned_quantity) assignment.assignedQuantity = fields.assigned_quantity;
    if (fields.unit) assignment.unit = fields.unit;
    if (fields.parent_task !== undefined || fields.parentTask !== undefined) {
      const parentVal = fields.parent_task || fields.parentTask;
      assignment.parentTask = parentVal && mongoose.Types.ObjectId.isValid(parentVal) ? parentVal : null;
    }
    if (fields.is_master_client_task !== undefined) {
      assignment.isMasterClientTask = Boolean(fields.is_master_client_task);
    }
    if (fields.employee !== undefined || fields.employee_id !== undefined || fields.assigned_to !== undefined || fields.assignedTo !== undefined) {
      const empVal = fields.employee ?? fields.employee_id ?? fields.assigned_to ?? fields.assignedTo;
      assignment.employee = await resolveEmployeeDoc(empVal);
    }
    if (fields.client !== undefined || fields.client_id !== undefined) {
      const clientVal = fields.client || fields.client_id;
      assignment.client = clientVal && mongoose.Types.ObjectId.isValid(clientVal) ? clientVal : null;
    }
    if (fields.project !== undefined || fields.project_id !== undefined) {
      const projVal = fields.project || fields.project_id;
      assignment.project = projVal && mongoose.Types.ObjectId.isValid(projVal) ? projVal : null;
    }
    if (fields.department_category || fields.departmentCategory) {
      assignment.departmentCategory = fields.department_category || fields.departmentCategory;
    }
    if (fields.estimated_hours !== undefined || fields.estimatedHours !== undefined) {
      const est = Number(fields.estimated_hours ?? fields.estimatedHours ?? 0);
      assignment.estimatedHours = est;
      if (est > 0 && (assignment.actualHours || 0) > est) {
        assignment.isOverrun = true;
        assignment.overrunHours = Number(((assignment.actualHours || 0) - est).toFixed(2));
      } else {
        assignment.isOverrun = false;
        assignment.overrunHours = 0;
      }
    }
    if (fields.department_data || fields.departmentData) {
      assignment.departmentData = {
        ...(assignment.departmentData || {}),
        ...(fields.department_data || fields.departmentData || {}),
      };
    }
  }

  const ownEmp = await Employee.findOne({ user: req.user?._id });
  const isReviewer = (assignment.reviewer && ownEmp && String(assignment.reviewer) === String(ownEmp._id)) ||
                     (assignment.reviewer && req.user && String(assignment.reviewer) === String(req.user._id));
  const hasAssignedReviewer = Boolean(assignment.reviewer);

  if (fields.status) {
    const isTargetingFinalState = ['Completed', 'Approved', 'Published'].includes(fields.status);

    if (isTargetingFinalState) {
      // Guard: If task has a designated reviewer, ONLY the designated reviewer or Super Admin can give final status confirmation!
      if (hasAssignedReviewer && !isReviewer && !isSuper) {
        assignment.status = 'PENDING_REVIEW';
        assignment.reviewStatus = 'PENDING_REVIEW';
        if (fields.review_note) assignment.reviewNote = fields.review_note;
      } else {
        assignment.status = fields.status;
        assignment.reviewStatus = 'OK';
        if (assignment.assignedQuantity && assignment.assignedQuantity > 0) {
          assignment.completedQuantity = assignment.assignedQuantity;
          assignment.progress = 100;
        }
        if (!assignment.completedAt) {
          assignment.completedAt = new Date();
        }
      }
    } else {
      assignment.status = fields.status;
    }
  }
  if (fields.completed_quantity !== undefined) assignment.completedQuantity = Math.max(0, fields.completed_quantity);
  if (fields.deliverables && Array.isArray(fields.deliverables)) {
    assignment.deliverables = fields.deliverables;
  }
  if (fields.review_status) {
    assignment.reviewStatus = fields.review_status;
    if (fields.review_status === 'OK' && (isReviewer || isSuper)) {
      assignment.status = 'Completed';
      assignment.progress = 100;
      if (!assignment.completedAt) assignment.completedAt = new Date();
    } else if (fields.review_status === 'CORRECTION_NEEDED') {
      assignment.status = 'In Progress';
    }
  }
  if (fields.review_note !== undefined) assignment.reviewNote = fields.review_note;
  if (fields.reviewer !== undefined) assignment.reviewer = mongoose.Types.ObjectId.isValid(fields.reviewer) ? fields.reviewer : null;

  if (assignment.deliverables && assignment.deliverables.length > 0) {
    syncFromDeliverables(assignment);
  } else {
    const hasManualQuantity = fields.completed_quantity !== undefined || (assignment.completedQuantity > 0 && !['Completed', 'Published', 'Approved'].includes(fields.status || ''));
    if (hasManualQuantity && assignment.assignedQuantity && assignment.assignedQuantity > 0) {
      assignment.progress = Math.min(100, Math.round((assignment.completedQuantity / assignment.assignedQuantity) * 100));
      if (assignment.completedQuantity >= assignment.assignedQuantity && assignment.status !== 'Completed') {
        assignment.status = 'Completed';
      }
    } else {
      syncQuantityState(assignment);
    }
  }

  await assignment.save();

  if (assignment.parentTask) {
    await syncParentTaskProgression(assignment);
  }

  await assignment.populate('employee client project assignedBy reviewer reviewedBy parentTask');
  res.json(formatWorkAssignmentDoc(assignment));
}

export async function reviewWorkAssignment(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR', 'TEAM_LEAD'].includes(req.user?.role || '');
  const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;

  const isReviewer = (assignment.reviewer && ownEmp && String(assignment.reviewer) === String(ownEmp._id)) ||
                     (assignment.reviewer && req.user && String(assignment.reviewer) === String(req.user._id));

  if (!isSuper && !isManagement && !isReviewer) {
    res.status(403).json({ detail: 'Permission denied. You are not authorized as reviewer for this task.' });
    return;
  }

  const { review_status, review_note, reviewStatus, reviewNote } = req.body;
  const statusToSet = review_status || reviewStatus;
  const noteToSet = review_note !== undefined ? review_note : reviewNote;

  if (!statusToSet || !['OK', 'CORRECTION_NEEDED', 'PENDING_REVIEW'].includes(statusToSet)) {
    res.status(400).json({ detail: 'Invalid review status. Must be OK, CORRECTION_NEEDED, or PENDING_REVIEW.' });
    return;
  }

  assignment.reviewStatus = statusToSet as any;
  if (noteToSet !== undefined) assignment.reviewNote = String(noteToSet).trim();
  assignment.reviewedBy = req.user ? req.user._id : null;
  assignment.reviewedAt = new Date();

  if (statusToSet === 'OK') {
    assignment.status = 'Approved';
    if (assignment.assignedQuantity && assignment.assignedQuantity > 0) {
      assignment.completedQuantity = assignment.assignedQuantity;
      assignment.progress = 100;
    }
    assignment.completedAt = new Date();
  } else if (statusToSet === 'CORRECTION_NEEDED') {
    assignment.status = 'In Progress';
    assignment.completedAt = null;
  }

  await assignment.save();

  if (assignment.parentTask) {
    await syncParentTaskProgression(assignment);
  }

  res.json(assignment);
}

export async function getClientKPIHealthHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ detail: 'Invalid Client ID.' });
    return;
  }
  const health = await calculateClientKPIHealth(id);
  res.json(health);
}

export async function deleteWorkAssignment(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }
  await WorkAssignment.findByIdAndDelete(assignment._id);
  res.status(204).send();
}

// --- Work Deliverables ---
export async function getWorkDeliverables(req: Request, res: Response): Promise<void> {
  const { assignment_id } = req.query;
  if (assignment_id && mongoose.Types.ObjectId.isValid(assignment_id as string)) {
    const assignment = await WorkAssignment.findById(assignment_id).populate('deliverables.client');
    res.json(assignment ? assignment.deliverables : []);
    return;
  }

  const assignments = await WorkAssignment.find({}, 'deliverables');
  const allDeliverables = assignments.flatMap((a) => a.deliverables);
  res.json(allDeliverables);
}

export async function createWorkDeliverable(req: Request, res: Response): Promise<void> {
  const { assignment_id, assignment: rawAssignment, client_id, client: rawClient, title, brief, work_type, due_date, status } = req.body;
  const targetId = assignment_id || rawAssignment;
  const validId = targetId && typeof targetId === 'object' && '_id' in targetId ? targetId._id : targetId;

  if (!validId || !mongoose.Types.ObjectId.isValid(String(validId))) {
    res.status(404).json({ detail: 'Parent work assignment not found.' });
    return;
  }

  const assignment = await WorkAssignment.findById(validId);
  if (!assignment) {
    res.status(404).json({ detail: 'Parent work assignment not found.' });
    return;
  }

  const deliverable = {
    client: client_id || assignment.client,
    title: title.trim(),
    brief: brief || '',
    workType: work_type || 'General',
    dueDate: new Date(due_date),
    status: status || 'Assigned',
    completedAt: ['Completed', 'Approved', 'Published'].includes(status) ? new Date() : null,
  };

  assignment.deliverables.push(deliverable as any);
  syncFromDeliverables(assignment);
  await assignment.save();

  res.status(201).json(assignment.deliverables[assignment.deliverables.length - 1]);
}

export async function adjustTaskTime(req: Request, res: Response): Promise<void> {
  const assignment = await findWorkAssignmentByIdOrLegacy(req.params.id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagementOrLead = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR', 'TEAM_LEAD'].includes(req.user?.role || '');
  const ownEmp = req.user ? await Employee.findOne({ user: req.user._id }) : null;
  const isAssignee = assignment.employee && ownEmp && String(assignment.employee) === String(ownEmp._id);

  if (!isSuper && !isManagementOrLead && !isAssignee) {
    res.status(403).json({ detail: 'Permission denied. Only managers, team leads, or the task assignee can adjust tracked time.' });
    return;
  }

  const { new_seconds, delta_seconds, new_hours, reason } = req.body;
  if (!reason || !String(reason).trim()) {
    res.status(400).json({ detail: 'A valid reason for the time adjustment is required.' });
    return;
  }

  const previousSeconds = assignment.totalTimeSpentSeconds || 0;
  let targetSeconds = previousSeconds;

  if (new_seconds !== undefined) {
    targetSeconds = Math.max(0, Number(new_seconds));
  } else if (new_hours !== undefined) {
    targetSeconds = Math.max(0, Math.round(Number(new_hours) * 3600));
  } else if (delta_seconds !== undefined) {
    targetSeconds = Math.max(0, previousSeconds + Number(delta_seconds));
  }

  const userFullName = req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username : 'User';

  assignment.totalTimeSpentSeconds = targetSeconds;
  assignment.actualHours = Number((targetSeconds / 3600).toFixed(2));
  if (assignment.estimatedHours > 0 && assignment.actualHours > assignment.estimatedHours) {
    assignment.isOverrun = true;
    assignment.overrunHours = Number((assignment.actualHours - assignment.estimatedHours).toFixed(2));
  } else {
    assignment.isOverrun = false;
    assignment.overrunHours = 0;
  }

  if (!assignment.timeAdjustments) {
    assignment.timeAdjustments = [];
  }

  assignment.timeAdjustments.push({
    adjustedAt: new Date(),
    adjustedBy: req.user ? req.user._id : null,
    adjustedByName: userFullName,
    previousSeconds,
    newSeconds: targetSeconds,
    reason: String(reason).trim(),
  });

  await assignment.save();
  res.json(assignment);
}

// --- Work Options & Share Links ---
export async function getWorkEmployeeOptions(req: Request, res: Response): Promise<void> {
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isManagement = ['ADMIN', 'OPERATIONS', 'OPERATIONS_HEAD', 'HR'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  const empFilter: any = { status: { $ne: 'Inactive' } };

  if (!isSuper && !isManagement && isTeamLead && req.user) {
    const ownEmp = await Employee.findOne({ user: req.user._id });
    if (ownEmp && ownEmp.department) {
      const deptRegex = new RegExp(`^${ownEmp.department.trim()}$`, 'i');
      empFilter.$or = [
        { department: deptRegex },
        { _id: ownEmp._id },
      ];
    }
  }

  const employees = await Employee.find(empFilter, '_id name employeeCode department teamLead user').populate('teamLead user').sort({ name: 1 });
  const userFilter: any = { isActive: true };
  if (isTeamLead && !isSuper && !isManagement) {
    userFilter.role = { $in: ['TEAM_LEAD', 'EMPLOYEE'] };
  }
  const users = await User.find(userFilter, '_id email firstName lastName username role').sort({ firstName: 1 });

  const map = new Map<string, {
    id: any;
    name: string;
    display_name: string;
    employee_code: string;
    department: string;
    avatar?: string;
    team_lead_id?: string | null;
    team_lead_name?: string | null;
    team_lead_user_id?: string | null;
  }>();

  for (const e of employees) {
    let leadId: string | null = null;
    let leadName: string | null = null;
    let leadUserId: string | null = null;

    if (e.teamLead) {
      const leadObj = e.teamLead as any;
      leadId = leadObj._id ? leadObj._id.toString() : null;
      leadName = leadObj.name || null;
      if (leadObj.user) {
        leadUserId = leadObj.user._id ? leadObj.user._id.toString() : leadObj.user.toString();
      }
    }

    if (!leadUserId && e.department) {
      const deptRegex = new RegExp(`^${e.department.trim()}$`, 'i');
      const deptLead = employees.find((emp) => emp.department && deptRegex.test(emp.department) && (emp as any).user && (emp as any).user.role === 'TEAM_LEAD');
      if (deptLead) {
        leadId = deptLead._id.toString();
        leadName = deptLead.name;
        leadUserId = (deptLead.user as any)?._id?.toString() || null;
      }
    }

    const avatarUrl = e.avatar || ((e.user as any)?.avatar) || '';

    map.set(e._id.toString(), {
      id: e._id,
      name: e.name,
      display_name: e.name || e.employeeCode || 'Employee',
      employee_code: e.employeeCode || '',
      department: e.department || 'General',
      avatar: avatarUrl,
      team_lead_id: leadId,
      team_lead_name: leadName,
      team_lead_user_id: leadUserId,
    });
  }

  for (const u of users) {
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.email;
    const existing = Array.from(map.values()).find((emp) => emp.name === fullName);
    if (!existing) {
      let empDoc = await Employee.findOne({ user: u._id });
      if (!empDoc) {
        empDoc = await Employee.create({
          user: u._id,
          name: fullName,
          email: u.email,
          phone: '',
          department: u.role === 'HR' ? 'HR' : u.role === 'ACCOUNTANT' ? 'Accounts' : u.role === 'BDE' ? 'Sales' : 'Operations',
          designation: u.role,
          joiningDate: new Date(),
          status: 'Active',
          employmentStatus: 'Permanent',
          employeeCode: `EMP${String(Date.now()).slice(-4)}`,
          avatar: u.avatar || '',
          location: 'Main Office',
          trackingStatus: 'OFFLINE',
        });
      }

      const avatarUrl = empDoc.avatar || u.avatar || '';

      map.set(empDoc._id.toString(), {
        id: empDoc._id,
        name: fullName,
        display_name: fullName,
        employee_code: empDoc.employeeCode || 'EMP',
        department: empDoc.department || 'Operations',
        avatar: avatarUrl,
        team_lead_id: null,
        team_lead_name: null,
        team_lead_user_id: null,
      });
    }
  }

  res.json(Array.from(map.values()));
}

export async function getWorkReviewerOptions(req: Request, res: Response): Promise<void> {
  const reviewers = await User.find({ isActive: true }, '_id username firstName lastName role').sort({ username: 1 });
  const formatted = reviewers.map((u) => ({
    id: u._id,
    username: u.username,
    name: `${u.firstName} ${u.lastName}`.trim() || u.username,
    display_name: `${u.firstName} ${u.lastName}`.trim() || u.username,
    role: u.role,
  }));
  res.json(formatted);
}

function formatShareLinkDoc(link: any) {
  const doc = link.toObject ? link.toObject() : link;
  const isExpired = doc.expiresAt ? new Date(doc.expiresAt).getTime() < Date.now() : false;
  const isRevoked = Boolean(doc.isRevoked);
  const isValid = !isRevoked && !isExpired;

  return {
    ...doc,
    id: doc._id ? doc._id.toString() : doc.id,
    assignment_title: link.assignment?.title || doc.assignment_title || '',
    client_name: link.client?.name || doc.client_name || '',
    is_revoked: isRevoked,
    is_valid: isValid,
  };
}

export async function getShareLinks(req: Request, res: Response): Promise<void> {
  const filter: any = {};
  if (req.query.client_id) {
    filter.client = req.query.client_id;
  }
  const links = await ClientWorkShareLink.find(filter).populate('client assignment createdBy').sort({ createdAt: -1 });
  const formatted = links.map(formatShareLinkDoc);
  res.json(formatted);
}

export async function createShareLinkHandler(req: Request, res: Response): Promise<void> {
  const { client_id, assignment_id, public_update, expires_in_days, days_valid } = req.body;
  if (!client_id) {
    res.status(400).json({ detail: 'Client ID is required.' });
    return;
  }

  const days = Number(expires_in_days || days_valid || 30);

  const link = await createShareLink({
    clientId: client_id,
    assignmentId: assignment_id,
    publicUpdate: public_update,
    createdById: req.user ? req.user._id.toString() : null,
    expiresInDays: days,
  });

  const populatedLink = await ClientWorkShareLink.findById(link._id).populate('client assignment createdBy');
  res.status(201).json(formatShareLinkDoc(populatedLink || link));
}

export async function revokeShareLink(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Share link not found.' });
    return;
  }
  const link = await ClientWorkShareLink.findById(req.params.id);
  if (!link) {
    res.status(404).json({ detail: 'Share link not found.' });
    return;
  }
  link.isRevoked = true;
  await link.save();
  const populatedLink = await ClientWorkShareLink.findById(link._id).populate('client assignment createdBy');
  res.json(formatShareLinkDoc(populatedLink || link));
}

export async function regenerateShareLink(req: Request, res: Response): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: 'Share link not found.' });
    return;
  }
  const link = await ClientWorkShareLink.findById(req.params.id);
  if (!link) {
    res.status(404).json({ detail: 'Share link not found.' });
    return;
  }
  link.token = generateShareToken();
  link.isRevoked = false;
  await link.save();
  const populatedLink = await ClientWorkShareLink.findById(link._id).populate('client assignment createdBy');
  res.json(formatShareLinkDoc(populatedLink || link));
}

export async function getPublicWorkProgress(req: Request, res: Response): Promise<void> {
  const link = await getValidShareLink(req.params.token);
  if (!link) {
    res.status(404).json({ detail: 'Share link expired or invalid.' });
    return;
  }

  const clientId = (link.client as any)?._id || link.client;
  const clientObj = await Client.findById(clientId);

  let allClientTasks: any[] = [];
  if (link.assignment) {
    const single = await WorkAssignment.findById(link.assignment).populate('employee client deliverables.client attachments');
    if (single) allClientTasks = [single];
  } else {
    allClientTasks = await WorkAssignment.find({ client: clientId })
      .populate('employee client deliverables.client attachments')
      .sort({ dueDate: 1 });
  }

  const formatTask = (a: any) => {
    const progressPct = a.assignedQuantity ? Math.round(((a.completedQuantity || 0) / a.assignedQuantity) * 100) : 0;
    const emp = a.employee as any;
    return {
      id: a._id,
      title: a.title,
      description: a.description,
      status: a.status,
      priority: a.priority,
      assigned_date: a.assignedDate ? new Date(a.assignedDate).toISOString().split('T')[0] : '',
      due_date: a.dueDate ? new Date(a.dueDate).toISOString().split('T')[0] : '',
      assigned_quantity: a.assignedQuantity || 1,
      completed_quantity: a.completedQuantity || 0,
      progress: Math.min(100, Math.max(0, a.progress || progressPct)),
      unit: a.unit || 'tasks',
      is_master_client_task: Boolean(a.isMasterClientTask),
      employee_name: emp ? emp.name : 'FLUMENX Production Team',
      deliverables: (a.deliverables || []).map((d: any) => ({
        id: d._id,
        name: d.name || d.title,
        title: d.title || d.name,
        brief: d.brief,
        work_type: d.workType,
        contracted: d.contracted || 1,
        delivered: d.delivered || (d.status === 'Completed' || d.status === 'Published' ? 1 : 0),
        status: d.status,
      })),
      attachments: (a.attachments || []).map((att: any) => ({
        id: att._id,
        name: att.name,
        url: att.url,
        file_type: att.fileType,
      })),
    };
  };

  const clientDeliverables = allClientTasks
    .filter((t) => t.isMasterClientTask || !t.parentTask)
    .map(formatTask);

  const internalEmployeeTasks = allClientTasks
    .filter((t) => !t.isMasterClientTask && t.parentTask)
    .map(formatTask);

  // If no parent/sub hierarchy exists, treat all as client deliverables
  const finalClientDeliverables = clientDeliverables.length > 0 ? clientDeliverables : allClientTasks.map(formatTask);

  let overallProgress = 0;
  if (finalClientDeliverables.length > 0) {
    const totalAssigned = finalClientDeliverables.reduce((sum, a) => sum + (a.assigned_quantity || 1), 0);
    const totalCompleted = finalClientDeliverables.reduce((sum, a) => sum + Math.min(a.assigned_quantity || 1, a.completed_quantity || 0), 0);
    overallProgress = totalAssigned > 0 ? Math.min(100, Math.round((totalCompleted / totalAssigned) * 100)) : 0;
  }

  res.json({
    client_name: clientObj ? clientObj.name : (link.client as any)?.name || 'Client',
    industry: clientObj?.industry || 'General',
    public_update: link.publicUpdate,
    scope: link.assignment ? 'assignment' : 'client',
    overall_progress: overallProgress,
    assignments: finalClientDeliverables,
    client_deliverables: finalClientDeliverables,
    internal_tasks: internalEmployeeTasks,
    documents: (clientObj?.documents || []).map((d) => ({
      name: d.name,
      url: d.url,
      document_type: d.documentType,
    })),
    brand_assets: (clientObj?.brandAssets || []).map((b) => ({
      name: b.name,
      url: b.url,
      asset_type: b.assetType,
      notes: b.notes,
    })),
    last_updated: (link as any).updatedAt ? (link as any).updatedAt.toISOString() : new Date().toISOString(),
  });
}

export async function incrementDeliverable(req: Request, res: Response): Promise<void> {
  const { id, deliverableId } = req.params;
  const { delta = 1 } = req.body;

  const assignment = await findWorkAssignmentByIdOrLegacy(id);
  if (!assignment) {
    res.status(404).json({ detail: 'Work assignment not found.' });
    return;
  }

  if (!assignment.deliverables || assignment.deliverables.length === 0) {
    res.status(404).json({ detail: 'No deliverables found on this assignment.' });
    return;
  }

  const deliverable = assignment.deliverables.find(
    (d: any) =>
      String(d._id) === String(deliverableId) ||
      String(d.id) === String(deliverableId) ||
      String(d.legacyId) === String(deliverableId)
  );

  if (!deliverable) {
    res.status(404).json({ detail: 'Deliverable item not found.' });
    return;
  }

  const contracted = (deliverable as any).contracted || 1;
  const currentDelivered =
    (deliverable as any).delivered !== undefined
      ? (deliverable as any).delivered
      : (deliverable as any).status === 'Completed' || (deliverable as any).status === 'Published'
      ? 1
      : 0;

  const targetDelta = Number(delta);
  let newDelivered = currentDelivered + targetDelta;
  if (targetDelta > 0 && currentDelivered === 0) {
    newDelivered = 1;
  } else if (targetDelta < 0 && currentDelivered > 0) {
    newDelivered = 0;
  }
  newDelivered = Math.max(0, Math.min(contracted, newDelivered));

  (deliverable as any).delivered = newDelivered;

  if (newDelivered >= contracted) {
    (deliverable as any).status = 'Completed';
    (deliverable as any).completedAt = new Date();
  } else if (newDelivered > 0) {
    (deliverable as any).status = 'In Progress';
    (deliverable as any).completedAt = null;
  } else {
    (deliverable as any).status = 'Assigned';
    (deliverable as any).completedAt = null;
  }

  syncFromDeliverables(assignment);
  await assignment.save();

  res.json(assignment);
}
