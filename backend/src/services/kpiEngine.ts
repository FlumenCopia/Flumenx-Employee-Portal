import { IEmployee } from '../models/Employee.js';
import { WorkAssignment, IWorkAssignment } from '../models/WorkAssignment.js';
import { AttendanceRecord, IAttendanceRecord } from '../models/AttendanceRecord.js';
import { EmployeeKPIRating } from '../models/EmployeeKPIRating.js';

export function getKPIGrade(score: number): string {
  if (score >= 9.5) return 'Outstanding';
  if (score >= 8.5) return 'Excellent';
  if (score >= 7.5) return 'Good';
  if (score >= 6.0) return 'Needs Improvement';
  return 'Critical';
}

export interface KPICalculationResult {
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  month: number;
  year: number;
  attendanceScore: number;
  onTimeScore: number;
  reviewQualityScore: number;
  manualRatingScore: number;
  totalKpiScore: number;
  grade: string;
  metrics: {
    totalWorkAssignments: number;
    completedAssignments: number;
    onTimeAssignments: number;
    reviewApprovedAssignments: number;
    attendanceRatio: number;
    manualRating?: number;
  };
}

export class KPIService {
  static async calculateEmployeeKPI(
    employee: IEmployee,
    month: number,
    year: number
  ): Promise<KPICalculationResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // If month is before employee's joining date, do not evaluate
    if (employee.joiningDate) {
      const joinDate = new Date(employee.joiningDate);
      joinDate.setHours(0, 0, 0, 0);
      if (endDate < joinDate) {
        return {
          employeeId: employee._id.toString(),
          employeeName: employee.name,
          department: employee.department,
          designation: employee.designation,
          month,
          year,
          attendanceScore: 0,
          onTimeScore: 0,
          reviewQualityScore: 0,
          manualRatingScore: 0,
          totalKpiScore: 0,
          grade: 'Not Evaluated',
          metrics: {
            totalWorkAssignments: 0,
            completedAssignments: 0,
            onTimeAssignments: 0,
            reviewApprovedAssignments: 0,
            attendanceRatio: 0,
            manualRating: 0,
          },
        };
      }
    }

    // Fetch assignments for the target month
    const assignments = await WorkAssignment.find({
      employee: employee._id,
      $or: [
        { assignedDate: { $gte: startDate, $lte: endDate } },
        { dueDate: { $gte: startDate, $lte: endDate } },
      ],
    });

    // Fetch attendance for the target month
    const attendanceRecords = await AttendanceRecord.find({
      employee: employee._id,
      attendanceDate: { $gte: startDate, $lte: endDate },
    });

    const isEvaluated = assignments.length > 0;

    // -------------------------------------------------------------
    // Factor 1: Attendance (Max 2.0 pts)
    // -------------------------------------------------------------
    const totalAttRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((r) =>
      ['Present', 'Present (Late)', 'Present (Early Exit)', 'Present (Late + Early Exit)'].includes(
        r.attendanceStatus
      )
    ).length;
    const halfDayCount = attendanceRecords.filter((r) => r.attendanceStatus === 'Half Day').length;
    const leaveCount = attendanceRecords.filter((r) => r.attendanceStatus === 'Leave').length;

    const effectivePresent = presentCount + halfDayCount * 0.5;
    const eligibleAttDays = Math.max(0, totalAttRecords - leaveCount);

    let attRatio = 1.0;
    if (totalAttRecords > 0 && eligibleAttDays > 0) {
      attRatio = Math.min(1.0, Math.max(0.0, effectivePresent / eligibleAttDays));
    } else {
      attRatio = isEvaluated ? 1.0 : 0.0;
    }

    const attendanceScore = Math.round(attRatio * 2.0 * 100) / 100;

    // -------------------------------------------------------------
    // Factor 2: On-Time Delivery (Max 3.0 pts)
    // -------------------------------------------------------------
    const dueAssignments = assignments.filter((wa) => wa.dueDate);
    const evaluableOnTimeTasks = dueAssignments.filter(
      (wa) => ['Published', 'Completed'].includes(wa.status) || new Date(wa.dueDate) <= today
    );

    let onTimeCount = 0;
    let onTimeRatio = 1.0;

    if (evaluableOnTimeTasks.length > 0) {
      for (const wa of evaluableOnTimeTasks) {
        if (['Published', 'Completed'].includes(wa.status)) {
          if (!wa.completedAt || new Date(wa.completedAt) <= new Date(wa.dueDate)) {
            onTimeCount++;
          }
        }
      }
      onTimeRatio = Math.min(1.0, Math.max(0.0, onTimeCount / evaluableOnTimeTasks.length));
    } else {
      onTimeRatio = isEvaluated ? 1.0 : 0.0;
    }

    const onTimeScore = Math.round(onTimeRatio * 3.0 * 100) / 100;

    // -------------------------------------------------------------
    // Factor 3: Review Quality (Max 3.0 pts)
    // -------------------------------------------------------------
    const completedAssignments = assignments.filter((wa) =>
      ['Completed', 'Published'].includes(wa.status)
    );
    let reviewApprovedCount = 0;
    let reviewQualityRatio = 1.0;

    if (completedAssignments.length > 0) {
      reviewApprovedCount = completedAssignments.filter(
        (wa) => wa.reviewStatus === 'OK' || wa.reviewStatus === 'PENDING_REVIEW'
      ).length;
      reviewQualityRatio = Math.min(
        1.0,
        Math.max(0.0, reviewApprovedCount / completedAssignments.length)
      );
    } else {
      reviewQualityRatio = isEvaluated ? 1.0 : 0.0;
    }

    const reviewQualityScore = Math.round(reviewQualityRatio * 3.0 * 100) / 100;

    // -------------------------------------------------------------
    // Factor 4: Manual Manager Rating (Max 2.0 pts)
    // -------------------------------------------------------------
    const manualRatingDoc = await EmployeeKPIRating.findOne({
      employee: employee._id,
      month,
      year,
    });

    let manualRatingVal = 5.0;
    if (manualRatingDoc && manualRatingDoc.rating !== undefined) {
      manualRatingVal = manualRatingDoc.rating;
    }

    // Convert 1.0 - 5.0 scale to 0.0 - 2.0 pts
    const manualRatingScore = Math.round(((manualRatingVal - 1.0) / 4.0) * 2.0 * 100) / 100;

    // Total Score (Max 10.0 pts)
    const totalKpiScore = Math.round(
      (attendanceScore + onTimeScore + reviewQualityScore + manualRatingScore) * 100
    ) / 100;

    const grade = getKPIGrade(totalKpiScore);

    return {
      employeeId: employee._id.toString(),
      employeeName: employee.name,
      department: employee.department,
      designation: employee.designation,
      month,
      year,
      attendanceScore,
      onTimeScore,
      reviewQualityScore,
      manualRatingScore,
      totalKpiScore,
      grade,
      metrics: {
        totalWorkAssignments: assignments.length,
        completedAssignments: completedAssignments.length,
        onTimeAssignments: onTimeCount,
        reviewApprovedAssignments: reviewApprovedCount,
        attendanceRatio: attRatio,
        manualRating: manualRatingVal,
      },
    };
  }
}
