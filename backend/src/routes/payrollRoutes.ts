import { Router } from 'express';
import {
  getSalaryHeads,
  createSalaryHead,
  updateSalaryHead,
  deleteSalaryHead,
  getSalaryStructures,
  getEmployeeSalaryStructure,
  saveEmployeeSalaryStructure,
} from '../controllers/salaryStructureController.js';
import {
  getPayrollRecords,
  getPayrollRecordById,
  calculateEmployeePayrollPreview,
  processPayrollCycleHandler,
  approvePayrollRecord,
  reprocessEmployeePayrollRecord,
  markPaidPayrollRecord,
  reopenPayrollRecord,
  getPayrollSummaryReport,
  getStatutoryReport,
  getAttendanceImpactReport,
  getLeaveConversionReport,
} from '../controllers/payrollController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateToken);

// Reports
router.get('/payroll/reports/summary/?', requirePermission('salary_slips', 'canView'), getPayrollSummaryReport);
router.get('/payroll/reports/statutory/?', requirePermission('salary_slips', 'canView'), getStatutoryReport);
router.get('/payroll/reports/attendance-impact/?', requirePermission('salary_slips', 'canView'), getAttendanceImpactReport);
router.get('/payroll/reports/leave-conversion/?', requirePermission('salary_slips', 'canView'), getLeaveConversionReport);

// Salary Heads Configuration
router.get('/salary-heads/?', requirePermission('salary_slips', 'canView'), getSalaryHeads);
router.post('/salary-heads/?', requirePermission('salary_slips', 'canCreate'), createSalaryHead);
router.put('/salary-heads/:id/?', requirePermission('salary_slips', 'canEdit'), updateSalaryHead);
router.patch('/salary-heads/:id/?', requirePermission('salary_slips', 'canEdit'), updateSalaryHead);
router.delete('/salary-heads/:id/?', requirePermission('salary_slips', 'canDelete'), deleteSalaryHead);

// Employee Salary Structures
router.get('/salary-structures/?', requirePermission('salary_slips', 'canView'), getSalaryStructures);
router.get('/salary-structures/employee/:employeeId/?', requirePermission('salary_slips', 'canView'), getEmployeeSalaryStructure);
router.post('/salary-structures/?', requirePermission('salary_slips', 'canCreate'), saveEmployeeSalaryStructure);

// Payroll Processing & Calculations
router.get('/payroll/?', requirePermission('salary_slips', 'canView'), getPayrollRecords);
router.get('/payroll/:id/?', requirePermission('salary_slips', 'canView'), getPayrollRecordById);
router.post('/payroll/preview/?', requirePermission('salary_slips', 'canCreate'), calculateEmployeePayrollPreview);
router.post('/payroll/process-cycle/?', requirePermission('salary_slips', 'canCreate'), processPayrollCycleHandler);
router.post('/payroll/:id/reprocess/?', requirePermission('salary_slips', 'canEdit'), reprocessEmployeePayrollRecord);
router.post('/payroll/:id/approve/?', requirePermission('salary_slips', 'canEdit'), approvePayrollRecord);
router.post('/payroll/:id/pay/?', requirePermission('salary_slips', 'canEdit'), markPaidPayrollRecord);
router.post('/payroll/:id/unlock/?', requirePermission('salary_slips', 'canEdit'), reopenPayrollRecord);
router.post('/payroll/:id/reopen/?', requirePermission('salary_slips', 'canEdit'), reopenPayrollRecord);

export default router;
