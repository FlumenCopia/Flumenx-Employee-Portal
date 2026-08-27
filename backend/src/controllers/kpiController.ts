import { Request, Response } from 'express';
import { Employee } from '../models/Employee.js';
import { EmployeeKPIRating } from '../models/EmployeeKPIRating.js';
import { KPIService, getKPIGrade } from '../services/kpiEngine.js';

function formatEmployeeKPI(emp: any, kpiData: any) {
  const isEvaluated = kpiData.grade !== 'Not Evaluated' && ((kpiData.metrics.totalWorkAssignments || 0) > 0 || kpiData.totalKpiScore > 0);
  const scoreOutOf10 = isEvaluated ? Number((kpiData.totalKpiScore || 0).toFixed(1)) : 0;
  const finalScore = isEvaluated ? Math.round((kpiData.totalKpiScore || 0) * 10) : 0;

  return {
    employee_id: emp._id.toString(),
    employee_code: emp.employeeCode || `EMP-${emp._id.toString().slice(-4)}`,
    employee_name: emp.name,
    department: emp.department,
    designation: emp.designation,
    month: kpiData.month,
    year: kpiData.year,
    final_score: finalScore,
    score_out_of_10: scoreOutOf10,
    is_evaluated: isEvaluated,
    grade: kpiData.grade,
    components: {
      attendance: {
        score: kpiData.attendanceScore,
        max_score: 2.0,
        percentage: Math.round((kpiData.metrics.attendanceRatio || 0) * 100),
        total_days: 30,
        present_days: Math.round((kpiData.metrics.attendanceRatio || 0) * 30),
      },
      on_time_delivery: {
        score: kpiData.onTimeScore,
        max_score: 3.0,
        on_time_count: kpiData.metrics.onTimeAssignments || 0,
        total_due: kpiData.metrics.totalWorkAssignments || 0,
      },
      work_quality: {
        score: kpiData.reviewQualityScore,
        max_score: 3.0,
        quality_rating: kpiData.metrics.reviewApprovedAssignments || 0,
      },
      work_completion: {
        score: kpiData.manualRatingScore,
        max_score: 2.0,
        completed_quantity: kpiData.metrics.completedAssignments || 0,
        assigned_quantity: kpiData.metrics.totalWorkAssignments || 0,
      },
      pending_work: {
        score: Math.max(0, (kpiData.metrics.totalWorkAssignments || 0) - (kpiData.metrics.completedAssignments || 0)),
        max_score: kpiData.metrics.totalWorkAssignments || 0,
      },
      rework: {
        score: 0,
        max_score: 0,
      },
      leave_discipline: {
        score: kpiData.attendanceScore,
        max_score: 2.0,
      },
      consistency: {
        score: kpiData.totalKpiScore,
        max_score: 10.0,
      },
    },
  };
}

export async function getKPIDashboard(req: Request, res: Response): Promise<void> {
  const { month, year, department, search, grade } = req.query;

  const now = new Date();
  const targetMonth = month ? parseInt(month as string, 10) : now.getMonth() + 1;
  const targetYear = year ? parseInt(year as string, 10) : now.getFullYear();

  const filter: any = { status: 'Active' };
  const isSuper = req.user?.role === 'SUPER_ADMIN' || req.user?.isSuperuser;
  const isHRorAdmin = ['ADMIN', 'HR', 'OPERATIONS', 'OPERATIONS_HEAD'].includes(req.user?.role || '');
  const isTeamLead = req.user?.role === 'TEAM_LEAD';

  if (!isSuper && !isHRorAdmin) {
    const ownEmp = await Employee.findOne({ user: req.user?._id });
    if (!ownEmp) {
      res.json({ selected_month: targetMonth, selected_year: targetYear, total_employees: 0, evaluated_employees: 0, average_kpi: 0, average_kpi_out_of_10: 0, top_performer: null, critical_performers_count: 0, critical_performers: [], department_averages: [], leaderboard: [] });
      return;
    }

    if (isTeamLead) {
      filter.department = ownEmp.department;
    } else {
      // Standard employee strictly gets only their own KPI
      filter._id = ownEmp._id;
    }
  } else if (department) {
    filter.department = department;
  }
  if (search) {
    filter.$or = [
      { name: { $regex: search as string, $options: 'i' } },
      { employeeCode: { $regex: search as string, $options: 'i' } },
    ];
  }

  const employees = await Employee.find(filter);
  const employeeResults: any[] = [];

  for (const emp of employees) {
    const kpiData = await KPIService.calculateEmployeeKPI(emp, targetMonth, targetYear);
    const formatted = formatEmployeeKPI(emp, kpiData);
    if (grade && formatted.grade !== grade) {
      continue;
    }
    employeeResults.push(formatted);
  }

  const totalEmployees = employeeResults.length;
  const evaluatedEmployees = employeeResults.filter((e) => e.is_evaluated).length;
  const avgKpi10 = totalEmployees > 0
    ? Number((employeeResults.reduce((acc, e) => acc + e.score_out_of_10, 0) / totalEmployees).toFixed(1))
    : 0;

  const sortedByScore = [...employeeResults].sort((a, b) => b.final_score - a.final_score);
  const topEmp = sortedByScore.length > 0 ? sortedByScore[0] : null;
  const criticalEmps = employeeResults.filter((e) => e.grade === 'Critical' || e.grade === 'Needs Improvement');

  // Department Averages
  const deptMap: Record<string, { total: number; count: number }> = {};
  for (const e of employeeResults) {
    if (!deptMap[e.department]) deptMap[e.department] = { total: 0, count: 0 };
    deptMap[e.department].total += e.score_out_of_10;
    deptMap[e.department].count += 1;
  }
  const department_averages = Object.keys(deptMap).map((dept) => ({
    department: dept as any,
    average_score: Math.round((deptMap[dept].total / deptMap[dept].count) * 10),
    average_score_out_of_10: Number((deptMap[dept].total / deptMap[dept].count).toFixed(1)),
    employee_count: deptMap[dept].count,
  }));

  res.json({
    selected_month: targetMonth,
    selected_year: targetYear,
    total_employees: totalEmployees,
    evaluated_employees: evaluatedEmployees,
    average_kpi: Math.round(avgKpi10 * 10),
    average_kpi_out_of_10: avgKpi10,
    top_performer: topEmp
      ? {
          id: topEmp.employee_id,
          name: topEmp.employee_name,
          department: topEmp.department,
          score: topEmp.final_score,
          score_out_of_10: topEmp.score_out_of_10,
          grade: topEmp.grade,
        }
      : null,
    critical_performers_count: criticalEmps.length,
    critical_performers: criticalEmps.map((e) => ({
      id: e.employee_id,
      name: e.employee_name,
      department: e.department,
      score: e.final_score,
      score_out_of_10: e.score_out_of_10,
      grade: e.grade,
    })),
    department_averages,
    monthly_trend: [
      {
        month: targetMonth,
        year: targetYear,
        period: `${targetYear}-${targetMonth.toString().padStart(2, '0')}`,
        average_score: Math.round(avgKpi10 * 10),
        average_score_out_of_10: avgKpi10,
      },
    ],
    employees: employeeResults,
  });
}

export async function getMyKPI(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }

  const employee = await Employee.findOne({ user: req.user._id });
  if (!employee) {
    res.status(404).json({ detail: 'No employee profile associated with account.' });
    return;
  }

  const { month, year } = req.query;
  const now = new Date();
  const targetMonth = month ? parseInt(month as string, 10) : now.getMonth() + 1;
  const targetYear = year ? parseInt(year as string, 10) : now.getFullYear();

  const kpiData = await KPIService.calculateEmployeeKPI(employee, targetMonth, targetYear);
  const result = formatEmployeeKPI(employee, kpiData);
  res.json(result);
}

export async function getEmployeeKPI(req: Request, res: Response): Promise<void> {
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) {
    res.status(404).json({ detail: 'Employee not found.' });
    return;
  }

  const { month, year } = req.query;
  const now = new Date();
  const targetMonth = month ? parseInt(month as string, 10) : now.getMonth() + 1;
  const targetYear = year ? parseInt(year as string, 10) : now.getFullYear();

  const kpiData = await KPIService.calculateEmployeeKPI(employee, targetMonth, targetYear);
  const result = formatEmployeeKPI(employee, kpiData);
  res.json(result);
}

export async function saveKPIRating(req: Request, res: Response): Promise<void> {
  const { employee_id, month, year, rating, notes } = req.body;

  if (!employee_id || !month || !year || rating === undefined) {
    res.status(400).json({ detail: 'Employee ID, month, year, and rating are required.' });
    return;
  }

  let ratingDoc = await EmployeeKPIRating.findOne({
    employee: employee_id,
    month: parseInt(month, 10),
    year: parseInt(year, 10),
  });

  if (!ratingDoc) {
    ratingDoc = new EmployeeKPIRating({
      employee: employee_id,
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      rating: parseFloat(rating),
      notes: notes || '',
      ratedBy: req.user ? req.user._id : null,
    });
  } else {
    ratingDoc.rating = parseFloat(rating);
    if (notes !== undefined) ratingDoc.notes = notes;
    ratingDoc.ratedBy = req.user ? (req.user._id as any) : null;
  }

  await ratingDoc.save();
  res.json(ratingDoc);
}

export async function exportKPICSV(req: Request, res: Response): Promise<void> {
  const { month, year } = req.query;
  const now = new Date();
  const targetMonth = month ? parseInt(month as string, 10) : now.getMonth() + 1;
  const targetYear = year ? parseInt(year as string, 10) : now.getFullYear();

  const employees = await Employee.find({ status: 'Active' });
  const rows = [];

  rows.push([
    'Employee Code',
    'Employee Name',
    'Department',
    'Designation',
    'Month/Year',
    'Attendance Score (2.0)',
    'On-Time Score (3.0)',
    'Quality Score (3.0)',
    'Manager Rating (2.0)',
    'Total KPI Score (10.0)',
    'Grade',
  ]);

  for (const emp of employees) {
    const kpi = await KPIService.calculateEmployeeKPI(emp, targetMonth, targetYear);
    rows.push([
      emp.employeeCode,
      emp.name,
      emp.department,
      emp.designation,
      `${targetYear}-${targetMonth.toString().padStart(2, '0')}`,
      kpi.attendanceScore,
      kpi.onTimeScore,
      kpi.reviewQualityScore,
      kpi.manualRatingScore,
      kpi.totalKpiScore,
      kpi.grade,
    ]);
  }

  const csvString = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=KPI_Report_${targetYear}_${targetMonth}.csv`
  );
  res.send(csvString);
}

