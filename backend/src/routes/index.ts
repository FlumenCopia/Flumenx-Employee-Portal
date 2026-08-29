import { Router } from 'express';
import authRoutes from './authRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import workRoutes from './workRoutes.js';
import attendanceRoutes from './attendanceRoutes.js';
import kpiRoutes from './kpiRoutes.js';
import portalRoutes from './portalRoutes.js';
import otherRoutes from './otherRoutes.js';
import holidayRoutes from './holidayRoutes.js';
import payrollRoutes from './payrollRoutes.js';
import projectRoutes from './projectRoutes.js';
import timerRoutes from './timerRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/projects', projectRoutes);
router.use('/timer', timerRoutes);
router.use('/time-entries', timerRoutes);
router.use('/', workRoutes);
router.use('/', attendanceRoutes);
router.use('/', kpiRoutes);
router.use('/', portalRoutes);
router.use('/', holidayRoutes);
router.use('/', payrollRoutes);
router.use('/', otherRoutes);

export default router;
