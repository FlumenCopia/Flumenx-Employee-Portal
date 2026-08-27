import { Router } from 'express';
import authRoutes from './authRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import workRoutes from './workRoutes.js';
import attendanceRoutes from './attendanceRoutes.js';
import kpiRoutes from './kpiRoutes.js';
import portalRoutes from './portalRoutes.js';
import otherRoutes from './otherRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/', workRoutes);
router.use('/', attendanceRoutes);
router.use('/', kpiRoutes);
router.use('/', portalRoutes);
router.use('/', otherRoutes);

export default router;
