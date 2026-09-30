import { DynamicRole, DataScope } from '../models/DynamicRole.js';
import { PortalPage } from '../models/PortalPage.js';
import { Employee } from '../models/Employee.js';

export async function getRoleDataScope(user: any, moduleCode: string): Promise<DataScope> {
  if (!user) return 'OWN';
  const userRole = (user.role || 'EMPLOYEE').toUpperCase();
  if (userRole === 'SUPER_ADMIN' || user.isSuperuser) return 'ALL';

  const normalizedCode = moduleCode.trim().toUpperCase();

  // 1. Dynamic Role lookup
  if (user.dynamicRole) {
    let dynamicRoleDoc = user.dynamicRole;
    if (typeof dynamicRoleDoc !== 'object' || !dynamicRoleDoc.permissions) {
      dynamicRoleDoc = await DynamicRole.findById(user.dynamicRole).populate('permissions.page');
    }

    if (dynamicRoleDoc) {
      if (dynamicRoleDoc.isSuperadminWildcard) return 'ALL';

      const searchCodes = normalizedCode === 'WORK' ? ['WORK', 'TASKS'] : normalizedCode === 'TASKS' ? ['TASKS', 'WORK'] : [normalizedCode];
      const targetPage = await PortalPage.findOne({ moduleCode: { $in: searchCodes } });
      if (targetPage) {
        const perm = dynamicRoleDoc.permissions?.find((p: any) => {
          if (!p.page) return false;
          const pId = p.page._id ? p.page._id.toString() : p.page.toString();
          return pId === targetPage._id.toString();
        });

        if (perm && perm.dataScope) {
          return perm.dataScope as DataScope;
        }
      }
    }
  }

  // 2. Fallbacks for system roles
  if (userRole === 'ADMIN' || userRole === 'OPERATIONS' || userRole === 'OPERATIONS_HEAD') return 'ALL';
  if (userRole === 'HR') {
    return ['ATTENDANCE', 'LEAVES', 'EMPLOYEES', 'TASKS', 'REPORTS'].includes(normalizedCode) ? 'ALL' : 'OWN';
  }
  if (userRole === 'ACCOUNTANT' || userRole === 'CFO') {
    return ['ACCOUNTING', 'SALARY_SLIPS', 'ATTENDANCE', 'REPORTS'].includes(normalizedCode) ? 'ALL' : 'OWN';
  }
  if (userRole === 'TEAM_LEAD' || userRole.includes('LEAD')) {
    return ['TASKS', 'ATTENDANCE', 'LEAVES', 'TRACKING', 'EMPLOYEE_TRACKING'].includes(normalizedCode) ? 'TEAM' : 'OWN';
  }

  return 'OWN';
}

export async function buildDataScopeFilter(user: any, moduleCode: string, employeeField = 'employee'): Promise<any> {
  const scope = await getRoleDataScope(user, moduleCode);

  if (scope === 'ALL' || user.role === 'SUPER_ADMIN' || user.isSuperuser) {
    return {}; // No filter, global company visibility
  }

  const userId = user._id || user.id;
  const ownEmployee = await Employee.findOne({ user: userId });
  const ownEmployeeId = ownEmployee?._id;

  if (scope === 'DEPARTMENT' && ownEmployee?.department) {
    const deptRegex = new RegExp(`^${ownEmployee.department.trim()}$`, 'i');
    const deptEmployees = await Employee.find({ department: deptRegex }).select('_id user');
    const ids = [
      ownEmployeeId,
      ...deptEmployees.map((e) => e._id),
      ...deptEmployees.map((e) => e.user).filter(Boolean),
    ].filter(Boolean);

    return { [employeeField]: { $in: ids } };
  }

  if (scope === 'TEAM' && ownEmployeeId) {
    // Find all subordinates whose teamLead is this user's employee ID
    const teamEmployees = await Employee.find({ teamLead: ownEmployeeId }).select('_id user');
    const ids = [
      ownEmployeeId,
      userId,
      ...teamEmployees.map((e) => e._id),
      ...teamEmployees.map((e) => e.user).filter(Boolean),
    ].filter(Boolean);

    return { [employeeField]: { $in: ids } };
  }

  // Fallback: OWN
  const selfIds = [ownEmployeeId, userId].filter(Boolean);
  return { [employeeField]: { $in: selfIds } };
}
