import { Request, Response } from 'express';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { Employee } from '../models/Employee.js';
import { WorkAssignment } from '../models/WorkAssignment.js';
import { EmployeeKPIRating } from '../models/EmployeeKPIRating.js';
import { SalarySlip } from '../models/SalarySlip.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Client } from '../models/Client.js';
import { AuditLog } from '../models/AuditLog.js';

export async function getReportsData(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }

  const role = (user.role || '').toUpperCase();
  const isSuperadmin = user.isSuperuser || role === 'SUPER_ADMIN' || role === 'ADMIN';
  const isHR = role === 'HR';
  const isAccountant = role === 'ACCOUNTANT';
  const isTeamLead = role === 'TEAM_LEAD';

  const ownEmployee = await Employee.findOne({ user: user._id });
  let targetEmpFilter: any = null;

  if (!isSuperadmin && !isHR && !isAccountant) {
    if (isTeamLead && ownEmployee?.department) {
      const deptRegex = new RegExp(`^${ownEmployee.department.trim()}$`, 'i');
      const teamEmployees = await Employee.find({ department: deptRegex }).select('_id');
      const teamEmpIds = teamEmployees.map((e) => e._id.toString());
      if (req.query.employeeId && teamEmpIds.includes(req.query.employeeId as string)) {
        targetEmpFilter = req.query.employeeId;
      } else if (!req.query.employeeId) {
        targetEmpFilter = { $in: teamEmpIds };
      } else {
        res.status(403).json({ detail: 'Permission denied. Team leads can only view reports for their department.' });
        return;
      }
    } else if (ownEmployee) {
      targetEmpFilter = ownEmployee._id;
    } else {
      res.status(403).json({ detail: 'No linked employee profile found.' });
      return;
    }
  } else if (req.query.employeeId) {
    targetEmpFilter = req.query.employeeId;
  }

  const { type = 'attendance', startDate, endDate, month, year, department, clientId, format } = req.query as Record<string, string>;

  let startD: Date | null = startDate ? new Date(startDate) : null;
  let endD: Date | null = endDate ? new Date(endDate) : null;
  if (endD) {
    endD.setHours(23, 59, 59, 999);
  }

  try {
    let reportTitle = 'Enterprise Report';
    let headers: string[] = [];
    let rows: any[] = [];
    let summary: Record<string, any> = {};

    // 1. ATTENDANCE REPORT
    if (type === 'attendance') {
      reportTitle = 'Employee Attendance & Timesheet Report';
      headers = ['Employee Code', 'Employee Name', 'Department', 'Date', 'Check In', 'Check Out', 'Status', 'Late (Mins)', 'Working Hours'];

      const query: any = {};
      if (startD && endD) {
        query.attendanceDate = { $gte: startD, $lte: endD };
      }
      if (targetEmpFilter) {
        query.employee = targetEmpFilter;
      }

      const records = await AttendanceRecord.find(query)
        .populate('employee', 'name employeeCode department')
        .sort({ attendanceDate: -1 })
        .limit(1000);

      let totalPresent = 0;
      let totalLate = 0;
      let totalAbsent = 0;

      rows = records.map((r: any) => {
        const emp = r.employee || {};
        const isPres = (r.attendanceStatus || '').toLowerCase().includes('present');
        if (isPres) totalPresent++;
        if (r.isLate) totalLate++;
        if ((r.attendanceStatus || '').toLowerCase().includes('absent')) totalAbsent++;

        return {
          employee_code: emp.employeeCode || 'N/A',
          employee_name: emp.name || 'Unknown',
          department: emp.department || 'General',
          date: r.attendanceDate ? new Date(r.attendanceDate).toISOString().split('T')[0] : 'N/A',
          check_in: r.checkInTime || '--:--',
          check_out: r.checkOutTime || '--:--',
          status: r.attendanceStatus || 'PRESENT',
          late_minutes: r.lateMinutes || 0,
          working_hours: r.workingHours || '0h 0m',
        };
      });

      summary = {
        totalRecords: rows.length,
        totalPresent,
        totalLate,
        totalAbsent,
      };
    }

    // 2. WORK & TASKS PERFORMANCE REPORT
    else if (type === 'work') {
      reportTitle = 'Deliverables & Task Performance Report';
      headers = ['Task Title', 'Client', 'Project', 'Assigned To', 'Dept Category', 'Status', 'Priority', 'Est (hrs)', 'Actual (hrs)', 'Overrun', 'Due Date'];

      const query: any = {};
      if (clientId) query.client = clientId;
      if (targetEmpFilter) query.employee = targetEmpFilter;
      if (department) query.departmentCategory = department;
      if (year && !isNaN(parseInt(year, 10))) {
        const y = parseInt(year, 10);
        query.createdAt = {
          $gte: new Date(`${y}-01-01T00:00:00.000+05:30`),
          $lte: new Date(`${y}-12-31T23:59:59.999+05:30`),
        };
      }

      const assignments = await WorkAssignment.find(query)
        .populate('client', 'name companyName')
        .populate('project', 'name')
        .populate('employee', 'name employeeCode department')
        .sort({ createdAt: -1 })
        .limit(1000);

      let completedTasks = 0;
      let pendingTasks = 0;
      let totalEstHours = 0;
      let totalActualHours = 0;
      let totalOverrunTasks = 0;

      rows = assignments.map((a: any) => {
        const client = a.client || {};
        const project = a.project || {};
        const emp = a.employee || {};
        const isDone = (a.status || '').toLowerCase() === 'completed' || (a.status || '').toLowerCase() === 'published';
        if (isDone) completedTasks++;
        else pendingTasks++;

        const est = a.estimatedHours || 0;
        const act = a.actualHours || 0;
        totalEstHours += est;
        totalActualHours += act;
        if (a.isOverrun) totalOverrunTasks++;

        return {
          task_title: a.title || 'Untitled Task',
          client: client.companyName || client.name || 'N/A',
          project: project.name || 'General / Direct Task',
          assigned_to: emp.name || 'Unassigned',
          department_category: a.departmentCategory || emp.department || 'General',
          status: (a.status || 'Assigned').toUpperCase(),
          priority: (a.priority || 'Normal').toUpperCase(),
          estimated_hours: est,
          actual_hours: act,
          is_overrun: a.isOverrun ? 'YES' : 'NO',
          due_date: a.dueDate ? new Date(a.dueDate).toISOString().split('T')[0] : 'N/A',
        };
      });

      summary = {
        totalTasks: rows.length,
        completedTasks,
        pendingTasks,
        totalEstHours,
        totalActualHours,
        totalOverrunTasks,
        completionRate: rows.length > 0 ? Math.round((completedTasks / rows.length) * 100) : 0,
      };
    }

    // 2B. CLIENT HIERARCHY SUMMARY REPORT
    else if (type === 'client_summary') {
      reportTitle = 'Client Project & Work Utilization Report';
      headers = ['Client Name', 'Total Projects', 'Total Tasks', 'Completed Tasks', 'Pending Tasks', 'Est Hours', 'Actual Hours', 'Billable Hours', 'Overrun Tasks'];

      const clients = await Client.find().sort({ name: 1 });
      const { Project } = await import('../models/Project.js');
      const { TimeEntry } = await import('../models/TimeEntry.js');

      rows = await Promise.all(
        clients.map(async (c: any) => {
          const projectsCount = await Project.countDocuments({ client: c._id });
          const taskQuery: any = { client: c._id };
          if (targetEmpFilter) taskQuery.employee = targetEmpFilter;
          const tasks = await WorkAssignment.find(taskQuery);

          const totalTasks = tasks.length;
          const completedTasks = tasks.filter((t) => ['Completed', 'Approved', 'Published'].includes(t.status)).length;
          const pendingTasks = totalTasks - completedTasks;
          const estHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
          const actHours = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
          const overrunTasks = tasks.filter((t) => t.isOverrun).length;

          const teQuery: any = { client: c._id, isBillable: true, status: 'STOPPED' };
          if (targetEmpFilter) teQuery.employee = targetEmpFilter;
          const billableEntries = await TimeEntry.find(teQuery);
          const billableSeconds = billableEntries.reduce((sum, te) => sum + (te.durationSeconds || 0), 0);
          const billableHours = Number((billableSeconds / 3600).toFixed(2));

          return {
            client_name: c.name,
            total_projects: projectsCount,
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            pending_tasks: pendingTasks,
            estimated_hours: estHours,
            actual_hours: actHours,
            billable_hours: billableHours,
            overrun_tasks: overrunTasks,
          };
        })
      );

      summary = {
        totalClients: clients.length,
        totalProjects: rows.reduce((s, r) => s + r.total_projects, 0),
        totalTasks: rows.reduce((s, r) => s + r.total_tasks, 0),
        totalHours: rows.reduce((s, r) => s + r.actual_hours, 0),
      };
    }

    // 2C. TIME ENTRIES AUDIT REPORT
    else if (type === 'time_entries') {
      reportTitle = 'Time Entries & Tracked Hours Audit Report';
      headers = ['Date', 'Employee', 'Client', 'Project', 'Task Title', 'Status', 'Duration (hrs)', 'Billable', 'Entry Type'];

      const { TimeEntry } = await import('../models/TimeEntry.js');
      const query: any = {};
      if (targetEmpFilter) query.employee = targetEmpFilter;
      if (clientId) query.client = clientId;

      if (startD && endD) {
        query.startTime = { $gte: startD, $lte: endD };
      } else if (year && !isNaN(parseInt(year, 10))) {
        const y = parseInt(year, 10);
        query.startTime = {
          $gte: new Date(`${y}-01-01T00:00:00.000+05:30`),
          $lte: new Date(`${y}-12-31T23:59:59.999+05:30`),
        };
      }

      const entries = await TimeEntry.find(query)
        .populate('employee', 'name employeeCode')
        .populate('client', 'name')
        .populate('project', 'name')
        .populate('task', 'title')
        .sort({ startTime: -1 })
        .limit(1000);

      let totalSeconds = 0;
      let billableSeconds = 0;

      rows = entries.map((te: any) => {
        const emp = te.employee || {};
        const client = te.client || {};
        const proj = te.project || {};
        const task = te.task || {};
        const sec = te.durationSeconds || 0;
        const hrs = Number((sec / 3600).toFixed(2));
        totalSeconds += sec;
        if (te.isBillable !== false) billableSeconds += sec;

        return {
          date: te.entryDate || (te.startTime ? new Date(te.startTime).toISOString().split('T')[0] : 'N/A'),
          employee: emp.name || 'Unknown',
          client: client.name || 'General',
          project: proj.name || 'Direct Task',
          task_title: task.title || 'Untitled Task',
          status: te.status || 'STOPPED',
          duration_hours: hrs,
          billable: te.isBillable !== false ? 'YES' : 'NO',
          entry_type: te.isManualEntry ? 'MANUAL' : 'TIMER',
        };
      });

      // Fallback: If no TimeEntry records were found, check WorkAssignment timeLogs
      if (rows.length === 0) {
        const workQuery: any = {};
        if (targetEmpFilter) workQuery.employee = targetEmpFilter;
        if (clientId) workQuery.client = clientId;
        const tasks = await WorkAssignment.find(workQuery).populate('employee', 'name').populate('client', 'name');
        for (const t of tasks) {
          for (const tl of (t.timeLogs || [])) {
            const logStart = tl.startTime ? new Date(tl.startTime) : null;
            if (startD && endD && logStart && (logStart < startD || logStart > endD)) continue;
            const sec = tl.durationSeconds || 0;
            const hrs = Number((sec / 3600).toFixed(2));
            totalSeconds += sec;
            billableSeconds += sec;
            rows.push({
              date: logStart ? logStart.toISOString().split('T')[0] : 'N/A',
              employee: (t.employee as any)?.name || 'Unknown',
              client: (t.client as any)?.name || 'General',
              project: 'Direct Task',
              task_title: t.title || 'Untitled Task',
              status: 'STOPPED',
              duration_hours: hrs,
              billable: 'YES',
              entry_type: 'TIMER',
            });
          }
        }
      }

      summary = {
        totalEntries: rows.length,
        totalHours: Number((totalSeconds / 3600).toFixed(2)),
        billableHours: Number((billableSeconds / 3600).toFixed(2)),
      };
    }

    // 3. KPI EVALUATION REPORT
    else if (type === 'kpi') {
      reportTitle = 'Employee KPI Performance & Ratings Report';
      headers = ['Employee Code', 'Employee Name', 'Department', 'Month/Year', 'Rating (1-5)', 'Notes'];

      const query: any = {};
      if (month) query.month = parseInt(month, 10);
      if (year) query.year = parseInt(year, 10);
      if (targetEmpFilter) query.employee = targetEmpFilter;

      const evaluations = await EmployeeKPIRating.find(query)
        .populate('employee', 'name employeeCode department')
        .sort({ year: -1, month: -1 })
        .limit(1000);

      let totalScoreSum = 0;

      rows = evaluations.map((k: any) => {
        const emp = k.employee || {};
        const rating = k.rating || 5.0;
        totalScoreSum += rating;

        return {
          employee_code: emp.employeeCode || 'N/A',
          employee_name: emp.name || 'Unknown',
          department: emp.department || 'General',
          period: `${k.month || 1}/${k.year || 2026}`,
          rating: `${rating.toFixed(1)} / 5.0`,
          notes: k.notes || 'Good performance',
        };
      });

      summary = {
        totalEvaluations: rows.length,
        averageRating: rows.length > 0 ? (totalScoreSum / rows.length).toFixed(2) : '5.00',
      };
    }

    // 4. PAYROLL & SALARY SLIPS REPORT
    else if (type === 'payroll') {
      if (!isSuperadmin && !isHR && !isAccountant) {
        res.status(403).json({ detail: 'Only Finance & HR can access Payroll reports.' });
        return;
      }

      reportTitle = 'Payroll & Salary Disbursement Report';
      headers = ['Employee Code', 'Employee Name', 'Month/Year', 'Basic Salary', 'Allowances', 'Deductions', 'Net Salary', 'Status'];

      const query: any = {};
      if (month) query.month = parseInt(month, 10);
      if (year) query.year = parseInt(year, 10);
      if (targetEmpFilter) query.employee = targetEmpFilter;

      const slips = await SalarySlip.find(query)
        .populate('employee', 'name employeeCode department')
        .sort({ year: -1, month: -1 })
        .limit(1000);

      let totalDisbursed = 0;

      rows = slips.map((s: any) => {
        const emp = s.employee || {};
        const net = s.netSalary || s.net_salary || 0;
        totalDisbursed += net;

        return {
          employee_code: emp.employeeCode || 'N/A',
          employee_name: emp.name || 'Unknown',
          period: `${s.month || 1}/${s.year || 2026}`,
          basic_salary: `₹${(s.basicSalary || 0).toLocaleString()}`,
          allowances: `₹${(s.allowances || 0).toLocaleString()}`,
          deductions: `₹${(s.deductions || 0).toLocaleString()}`,
          net_salary: `₹${net.toLocaleString()}`,
          status: (s.status || 'DISBURSED').toUpperCase(),
        };
      });

      summary = {
        totalSlips: rows.length,
        totalNetDisbursed: `₹${totalDisbursed.toLocaleString()}`,
      };
    }

    // 5. LEAVES & ABSENTEEISM REPORT
    else if (type === 'leaves') {
      reportTitle = 'Leave Requests & Absenteeism Report';
      headers = ['Employee Code', 'Employee Name', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status'];

      const query: any = {};
      if (startD && endD) {
        query.startDate = { $gte: startD, $lte: endD };
      }
      if (targetEmpFilter) query.employee = targetEmpFilter;

      const leaves = await LeaveRequest.find(query)
        .populate('employee', 'name employeeCode department')
        .sort({ createdAt: -1 })
        .limit(1000);

      let approved = 0;
      let pending = 0;
      let rejected = 0;

      rows = leaves.map((l: any) => {
        const emp = l.employee || {};
        const st = (l.status || 'PENDING').toUpperCase();
        if (st === 'APPROVED') approved++;
        else if (st === 'REJECTED') rejected++;
        else pending++;

        return {
          employee_code: emp.employeeCode || 'N/A',
          employee_name: emp.name || 'Unknown',
          department: emp.department || 'General',
          leave_type: (l.leaveType || 'Casual').toUpperCase(),
          start_date: l.startDate ? new Date(l.startDate).toISOString().split('T')[0] : 'N/A',
          end_date: l.endDate ? new Date(l.endDate).toISOString().split('T')[0] : 'N/A',
          days: l.daysCount || l.days || 1,
          reason: l.reason || 'Personal',
          status: st,
        };
      });

      summary = {
        totalLeaves: rows.length,
        approved,
        pending,
        rejected,
      };
    }

    // 6. CLIENTS & PROJECT DELIVERABLES REPORT
    else if (type === 'clients') {
      reportTitle = 'Client Accounts & Project Deliverables Report';
      headers = ['Client Name', 'Company Name', 'Email', 'Phone', 'Active Projects', 'Deliverable Target', 'Status'];

      const clients = await Client.find({}).sort({ name: 1 }).limit(1000);

      rows = clients.map((c: any) => ({
        client_name: c.name || 'N/A',
        company_name: c.companyName || c.company || 'N/A',
        email: c.email || 'N/A',
        phone: c.phone || 'N/A',
        active_projects: c.activeProjects || 1,
        deliverable_target: c.deliverableTarget || '100%',
        status: (c.status || 'ACTIVE').toUpperCase(),
      }));

      summary = {
        totalClients: rows.length,
      };
    }

    // 7. EMPLOYEES MASTER DIRECTORY REPORT
    else if (type === 'employees') {
      reportTitle = 'Employee Master Directory Report';
      headers = ['Employee Code', 'Full Name', 'Department', 'Designation', 'Official Email', 'Phone', 'Joining Date', 'Status'];

      const query: any = {};
      if (department) query.department = department;

      const employees = await Employee.find(query).sort({ employeeCode: 1 }).limit(1000);

      rows = employees.map((e: any) => ({
        employee_code: e.employeeCode || 'N/A',
        full_name: e.name || 'N/A',
        department: e.department || 'General',
        designation: e.designation || 'Specialist',
        email: e.email || 'N/A',
        phone: e.phone || 'N/A',
        joining_date: e.joiningDate ? new Date(e.joiningDate).toISOString().split('T')[0] : 'N/A',
        status: e.isActive !== false ? 'ACTIVE' : 'INACTIVE',
      }));

      summary = {
        totalEmployees: rows.length,
      };
    }

    // 8. SECURITY & AUDIT LOGS REPORT
    else if (type === 'audit') {
      if (!isSuperadmin) {
        res.status(403).json({ detail: 'Only Super Admin can access Security & Audit reports.' });
        return;
      }

      reportTitle = 'Security & Audit Trail Report';
      headers = ['Timestamp', 'Actor / User', 'Action', 'Resource', 'Details', 'IP Address'];

      const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(1000);

      rows = logs.map((l: any) => ({
        timestamp: l.createdAt ? new Date(l.createdAt).toLocaleString() : 'N/A',
        actor: l.actorName || l.username || 'System',
        action: (l.action || 'MODIFY').toUpperCase(),
        resource: l.resource || 'General',
        details: l.details || l.description || '',
        ip_address: l.ipAddress || '127.0.0.1',
      }));

      summary = {
        totalLogs: rows.length,
      };
    }

    // Export CSV Format
    if (format === 'csv') {
      let csvContent = headers.join(',') + '\n';
      rows.forEach((row) => {
        const values = Object.values(row).map((v) => `"${String(v).replace(/"/g, '""')}"`);
        csvContent += values.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${Date.now()}.csv"`);
      res.send(csvContent);
      return;
    }

    // Return structured JSON response
    res.json({
      success: true,
      reportTitle,
      type,
      generatedAt: new Date().toISOString(),
      generatedBy: user.employee?.name || user.username,
      headers,
      rows,
      summary,
    });
  } catch (err: any) {
    console.error('Error generating report:', err);
    res.status(500).json({ detail: err.message || 'Failed to generate report.' });
  }
}
