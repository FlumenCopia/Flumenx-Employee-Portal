# Project Workflows: FLUMENX Employee Portal

This document maps all major end-to-end user and system workflows across the application.

---

## 1. Authentication & Session Initialization Workflow

```text
User enters credentials on /login
  │
  ▼
Frontend `login()` in `api.ts` makes POST /api/auth/login/
  │
  ▼
`authController.ts` -> `login()`
  1. Searches User by username or email
  2. Compares password via bcrypt or Django PBKDF2 hash algorithm
  3. Signs 15-min Access JWT and 7-day Refresh JWT
  4. Sets HttpOnly cookies (`access_token`, `refresh_token`)
  5. Fetches linked Employee record (if present)
  6. Returns JSON payload with User, Role, Employee data, and Access/Refresh tokens
  │
  ▼
Frontend stores User in `auth-cache.ts` (LocalStorage + Memory)
  │
  ▼
Frontend Shell verifies session & redirects user to role dashboard (/dashboard)
```

---

## 2. Work Assignment & Deliverable Lifecycle Workflow

```text
Team Lead / Admin creates Work Assignment
  │
  ▼
POST /api/work-assignments/
  - Payload: title, client, employee, parent_task, assigned_quantity, deliverables[]
  │
  ▼
`workController.ts` -> `createWorkAssignment()`
  - Sanitizes deliverables array
  - Invokes `syncQuantityState(assignment)` from `workSyncEngine.ts`
  - Saves WorkAssignment document in MongoDB
  - If parent_task exists, calls `syncParentTaskProgression()`
  │
  ▼
Employee starts work & logs progress
  - Employee triggers `startTaskTimer()` -> POST /api/work-assignments/:id/start-timer/
  - Timer active state saved on task (`activeTimer`)
  - Status transitions to "In Progress"
  │
  ▼
Employee updates deliverable status (e.g. deliverable status -> "Completed")
  - PUT /api/work-assignments/:id/
  │
  ▼
`workSyncEngine.ts` -> `syncFromDeliverables(assignment)`
  - Calculates weighted deliverable completion sum using `STATUS_WEIGHT_MAP`:
    - Backlog/Assigned/Pending/Blocked/Rejected = 0.0
    - In Progress/Ongoing = 0.25
    - In Review/Changes Requested = 0.50
    - Approved = 0.75
    - Completed/Published = 1.00
  - Updates `assignment.completedQuantity` & `assignment.progress` (0 - 100%)
  - Cascades progress upward to Master Parent Task (`syncParentTaskProgression`)
```

---

## 3. Client Share Link & Public Progress Update Workflow

```text
Agency Team Lead creates Share Link for Client
  │
  ▼
POST /api/work-share-links/
  - Payload: client_id, assignment_id (optional), public_update, expires_in_days
  │
  ▼
`shareLinkService.ts` -> `createShareLink()`
  - Generates 64-character hex cryptographic token (`crypto.randomBytes(32)`)
  - Calculates expiration date
  - Saves `ClientWorkShareLink` document
  │
  ▼
Client accesses public link: /share/[token]
  │
  ▼
GET /api/public/work-progress/:token/ (Unauthenticated)
  │
  ▼
`workController.ts` -> `getPublicWorkProgress()`
  - Validates token & expiration date via `link.isValid()`
  - Populates client name, public updates, work assignments, and deliverable status
  - Returns public progress view JSON
```

---

## 4. Attendance Check-In / Check-Out Workflow

```text
Employee opens /attendance and clicks "Check In"
  │
  ▼
Frontend captures browser GPS coordinates & optional photo via camera modal
  │
  ▼
POST /api/attendance/check-in/ (Multipart Form Data with photo file)
  │
  ▼
`attendanceController.ts` -> `checkInAttendance()`
  1. Multer uploads photo to `media/attendance_photos/`
  2. Fetches `AttendancePolicy` singleton document
  3. Calculates Haversine spherical distance between user GPS & office GPS coordinates:
     d = 2 * R * atan2(√a, √(1-a))
  4. Sets `locationVerified = distanceMeters <= policy.allowedRadiusMeters`
  5. Invokes `calculateAttendanceRecordState(record, policy)`:
     - Check-in time <= gracePeriod -> "On Time" / "Grace Period"
     - Check-in time > gracePeriod -> "Late" (calculates lateMinutes)
     - Sets status: "Present", "Present (Late)", or "Half Day"
  6. Saves `AttendanceRecord` document (enforces unique index: employee + attendanceDate)
```

---

## 5. Attendance Correction Workflow

```text
Employee requests correction for missed check-in/out
  │
  ▼
POST /api/attendance-corrections/
  - Payload: attendance_record_id, requested_check_in, requested_check_out, reason
  │
  ▼
`AttendanceCorrection` document created with status = "Pending"
  │
  ▼
HR / Admin reviews request on /attendance page
  │
  ▼
PUT /api/attendance-corrections/:id/
  - Payload: status ("Approved" or "Rejected"), admin_note
  │
  ▼
`attendanceController.ts` -> `updateAttendanceCorrection()`
  - If status === "Approved":
    - Updates `checkInTime` / `checkOutTime` on `AttendanceRecord`
    - Recalculates working hours, late minutes, and attendance status via `attendanceEngine.ts`
    - Saves updated `AttendanceRecord`
```

---

## 6. Leave Application & Approval Workflow

```text
Employee submits Leave Request on /leaves
  │
  ▼
POST /api/leaves/
  - Payload: leave_type, start_date, end_date, reason
  │
  ▼
`leaveController.ts` -> `createLeave()`
  - Creates `LeaveRequest` with status = "Pending"
  - Returns formatted Leave Object with day count calculation
  │
  ▼
HR / Admin views pending requests
  - Unread pending leave count badge displayed in Shell navigation
  │
  ▼
POST /api/leaves/:id/decide/ (or PUT /api/leaves/:id/)
  - Payload: status ("Approved" | "Rejected"), admin_note
  │
  ▼
`leaveController.ts` updates LeaveRequest status
```

---

## 7. Salary Slip Generation & Download Workflow

```text
Accountant / HR opens Salary Slips view
  │
  ▼
POST /api/salary-slips/generate/
  - Payload: employee_id, month, year, basic_salary, hra, conveyance, allowances, pf, tax, deductions
  │
  ▼
`salaryController.ts` -> `generateSalarySlip()`
  1. Computes `grossSalary = basic + hra + conveyance + allowances`
  2. Computes `netSalary = grossSalary - (pf + tax + deductions)`
  3. Calls `pdfGenerator.ts` -> `generatePdfSalarySlip()`:
     - Initializes PDFKit document with A4 specifications
     - Renders Corporate Logo, FLUMENX Letterhead, and Employee Metadata block
     - Renders Earnings vs Deductions table
     - Computes Net Payable amount in words via `numberToWords()`
     - Streams PDF to disk at `media/salary_slips/SalarySlip_EMPCODE_MONTH_YEAR.pdf`
  4. Creates or updates `SalarySlip` document with file URL (enforces unique employee+month+year index)
  │
  ▼
Employee clicks "Download Payslip"
  │
  ▼
GET /api/salary-slips/:id/download/
  - `res.download(absolutePath)` streams generated PDF file to client browser
```

---

## 8. KPI Performance Scoring Engine Workflow

```text
Admin / HR accesses KPI Dashboard (/kpi)
  │
  ▼
GET /api/kpi/dashboard/?month=X&year=Y
  │
  ▼
`kpiController.ts` iterates over all Active employees
  │
  ▼
Calls `KPIService.calculateEmployeeKPI(employee, month, year)` in `kpiEngine.ts`:
  1. **Factor 1: Attendance (Max 2.0 pts)**
     - `attRatio = effectivePresent / eligibleAttDays`
     - `attendanceScore = attRatio * 2.0`
  2. **Factor 2: On-Time Delivery (Max 3.0 pts)**
     - `onTimeRatio = onTimeCompletedTasks / totalDueTasks`
     - `onTimeScore = onTimeRatio * 3.0`
  3. **Factor 3: Work Review Quality (Max 3.0 pts)**
     - `reviewQualityRatio = approvedTasks / completedTasks`
     - `reviewQualityScore = reviewQualityRatio * 3.0`
  4. **Factor 4: Manager Rating (Max 2.0 pts)**
     - Fetches `EmployeeKPIRating` document for target month/year (Default 5.0 / 5.0)
     - `manualRatingScore = ((rating - 1.0) / 4.0) * 2.0`
  5. **Total Score & Grade Assignment**
     - `totalKpiScore = attendanceScore + onTimeScore + reviewQualityScore + manualRatingScore` (Max 10.0)
     - Grade: ≥9.5 "Outstanding", ≥8.5 "Excellent", ≥7.5 "Good", ≥6.0 "Needs Improvement", <6.0 "Critical"
  │
  ▼
Returns JSON with overall company averages, top performers, critical list, and department breakdowns
```

---

## 9. Announcements & Broadcast Notifications Workflow

```text
Admin creates Announcement on /meetings (or /announcements)
  │
  ▼
POST /api/announcements/
  - Payload: title, message, priority
  │
  ▼
`communicationController.ts` -> `createAnnouncement()`
  1. Saves `Announcement` document
  2. Queries all active users (`User.find({ isActive: true })`)
  3. Bulk inserts `Notification` documents for header bell feed (`Notification.insertMany()`)
  │
  ▼
Real-time / Polled header bell icon in frontend `shell.tsx` receives unread count update
```

---

## 10. Dynamic Role & RBAC Matrix Management Workflow

```text
SuperAdmin opens Settings -> Roles & Access Control (/settings)
  │
  ▼
POST /api/portal/roles/ (Create Dynamic Role)
  - Creates `DynamicRole` document (e.g. "Senior Reviewer")
  │
  ▼
SuperAdmin configures module matrix: GET/PUT /api/portal/roles/:roleId/permissions/
  - Defines `canView`, `canCreate`, `canEdit`, `canDelete` per `PortalPage` module
  │
  ▼
SuperAdmin assigns role to user: PUT /api/portal/super-admin/users/:id/
  - Updates `user.dynamicRole` reference
  │
  ▼
Next time user makes an API call, `requirePermission` middleware evaluates the dynamic role matrix
```
