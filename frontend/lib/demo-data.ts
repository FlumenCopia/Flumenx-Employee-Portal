import { Announcement, AttendanceRecord, Employee, Leave, Meeting, SalarySlip } from "./types";

const iso = (days = 0) => {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
};

export const employees: Employee[] = [
  { id: 1, employee_code: "FLX-001", name: "Maya Kapoor", email: "maya@flumenx.local", phone: "+91 98765 43000", department: "Engineering", designation: "Senior Product Engineer", joining_date: "2022-01-12", status: "Active", location: "Bengaluru" },
  { id: 2, employee_code: "FLX-002", name: "Rohan Mehta", email: "rohan@flumenx.local", phone: "+91 98765 43001", department: "Design", designation: "Product Designer", joining_date: "2023-02-12", status: "Active", location: "Mumbai" },
  { id: 3, employee_code: "FLX-003", name: "Ananya Singh", email: "ananya@flumenx.local", phone: "+91 98765 43002", department: "HR", designation: "People Operations Lead", joining_date: "2024-03-12", status: "Active", location: "Delhi" },
  { id: 4, employee_code: "FLX-004", name: "Kabir Shah", email: "kabir@flumenx.local", phone: "+91 98765 43003", department: "Finance", designation: "Finance Analyst", joining_date: "2022-04-12", status: "Active", location: "Pune" },
  { id: 5, employee_code: "FLX-005", name: "Ishita Rao", email: "ishita@flumenx.local", phone: "+91 98765 43004", department: "Sales", designation: "Enterprise Account Manager", joining_date: "2023-05-12", status: "Active", location: "Hyderabad" },
  { id: 6, employee_code: "FLX-006", name: "Dev Malhotra", email: "dev@flumenx.local", phone: "+91 98765 43005", department: "Operations", designation: "Operations Manager", joining_date: "2024-06-12", status: "On Leave", location: "Bengaluru" },
];
export const leaves: Leave[] = [
  { id: 1, employee: 2, employee_name: "Rohan Mehta", employee_code: "FLX-002", leave_type: "Annual", start_date: iso(3), end_date: iso(5), reason: "Family event", status: "Pending", days: 3 },
  { id: 2, employee: 1, employee_name: "Maya Kapoor", employee_code: "FLX-001", leave_type: "Sick", start_date: iso(-12), end_date: iso(-11), reason: "Recovery and rest", status: "Approved", days: 2 },
  { id: 3, employee: 5, employee_name: "Ishita Rao", employee_code: "FLX-005", leave_type: "Personal", start_date: iso(9), end_date: iso(9), reason: "Personal appointment", status: "Pending", days: 1 },
];
export const meetings: Meeting[] = [
  { id: 1, title: "Q3 Product Direction", date: iso(2), time: "10:30:00", description: "Decisions, bets, and the road ahead.", department: "Engineering", location: "Orion Room" },
  { id: 2, title: "All Hands Â· The Next Chapter", date: iso(4), time: "16:00:00", description: "Company momentum and what comes next.", department: "All Employees", location: "Town Hall" },
  { id: 3, title: "Design Critique", date: iso(6), time: "11:30:00", description: "Weekly craft and product review.", department: "Design", location: "Studio 02" },
];
export const announcements: Announcement[] = [
  { id: 1, title: "Welcome to FLUMENX", message: "One place for our people, work, and shared momentum.", date: iso(0), priority: "Important" },
  { id: 2, title: "Wellness Friday", message: "This Friday closes at 3 PM. Take the space to recharge.", date: iso(-1), priority: "Normal" },
  { id: 3, title: "Benefits enrollment", message: "Annual benefits enrollment is open through the end of this month.", date: iso(-3), priority: "Urgent" },
];
export const salarySlips: SalarySlip[] = [0, 1, 2].map((offset, i) => {
  const d = new Date(); d.setMonth(d.getMonth() - offset);
  return { id: i + 1, employee: 1, employee_name: "Maya Kapoor", month: d.getMonth() + 1, year: d.getFullYear(), gross_salary: "125000.00", net_salary: "108500.00", uploaded_at: d.toISOString() };
});

export const attendanceRecords: AttendanceRecord[] = employees.map((employee, index) => {
  const patterns = [
    ["09:24:00", "18:38:00", "On Time", "Present", false, 0, false, 0, "9.23"],
    ["09:32:00", "18:34:00", "Grace Period", "Present", false, 0, false, 0, "9.03"],
    ["09:47:00", "18:42:00", "Late", "Present (Late)", true, 12, false, 0, "8.92"],
    ["09:28:00", "18:05:00", "On Time", "Present (Early Exit)", false, 0, true, 25, "8.62"],
    ["09:41:00", "18:12:00", "Late", "Present (Late + Early Exit)", true, 6, true, 18, "8.52"],
    [null, null, "", "Absent", false, 0, false, 0, "0.00"],
  ] as const;
  const p = patterns[index];
  return {
    id: index + 1, employee: employee.id, employee_name: employee.name, employee_code: employee.employee_code,
    department: employee.department, attendance_date: iso(0), check_in_time: p[0], check_out_time: p[1],
    check_in_status: p[2], attendance_status: p[3], is_late: p[4], late_minutes: p[5],
    is_early_exit: p[6], early_exit_minutes: p[7], working_hours: p[8],
    source: index === 5 ? "â€”" : "QR + Location", location_verified: index !== 5,
  };
});

export const monthlyAttendance = Array.from({ length: 18 }, (_, i) => ({
  day: i + 1, present: 124 + (i % 5) * 3, late: 5 + (i % 4), early: 3 + (i % 3), absent: 8 - (i % 4),
}));

