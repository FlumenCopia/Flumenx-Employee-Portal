import { Employee } from '../models/Employee.js';

/**
 * Resolves the Employee document associated with a User.
 * If the employee has not yet been linked to the User by user ID (e.g. employee.user is null),
 * but shares the same work email, this function automatically self-heals by linking
 * employee.user = user._id and persisting the change to MongoDB.
 */
export async function getEmployeeForUser(user: any): Promise<any> {
  if (!user || !user._id) return null;

  // 1. Direct lookup by user ID
  let employee = await Employee.findOne({ user: user._id });
  if (employee) return employee;

  // 2. Fallback lookup by email for self-healing
  if (user.email && typeof user.email === 'string') {
    const cleanEmail = user.email.trim().toLowerCase();
    employee = await Employee.findOne({ email: cleanEmail });

    if (employee) {
      if (!employee.user || employee.user.toString() !== user._id.toString()) {
        employee.user = user._id;
        await employee.save().catch((err: any) => {
          console.error('[employeeResolver] Failed to auto-link employee to user:', err);
        });
      }
      return employee;
    }
  }

  return null;
}
