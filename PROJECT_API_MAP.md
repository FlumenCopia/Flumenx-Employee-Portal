# Project API Map: FLUMENX Employee Portal

This document provides complete technical documentation for all REST API endpoints implemented in the Express.js + TypeScript backend.

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/login/`
- **Controller**: `authController.login`
- **Auth/RBAC**: Public / Unauthenticated
- **Input**: `{ "username": "...", "password": "..." }`
- **Output**: `{ "access": "JWT", "refresh": "JWT", "user": { ... } }`
- **Cookies**: Sets `access_token` and `refresh_token` HTTP-only cookies
- **DB**: Queries `User` and `Employee` collections

### `POST /api/auth/register/`
- **Controller**: `authController.register`
- **Auth/RBAC**: Public / Unauthenticated
- **Input**: `{ "username": "...", "email": "...", "password": "...", "role": "EMPLOYEE" }`
- **Output**: `{ "id": "...", "username": "...", "email": "...", "role": "..." }`
- **DB**: Creates `User` document

### `POST /api/auth/logout/`
- **Controller**: `authController.logout`
- **Auth/RBAC**: Public / Unauthenticated
- **Output**: `{ "detail": "Successfully logged out." }`
- **Cookies**: Clears `access_token` and `refresh_token` cookies

### `POST /api/auth/refresh/`
- **Controller**: `authController.refresh`
- **Auth/RBAC**: Verifies `refresh_token` cookie or request body
- **Output**: `{ "access": "JWT" }`
- **Cookies**: Sets updated `access_token` cookie

### `GET /api/auth/csrf/`
- **Controller**: `csrf.handleCsrfEndpoint`
- **Auth/RBAC**: Public
- **Output**: `{ "csrfToken": "..." }`
- **Cookies**: Sets `csrftoken` cookie

### `GET /api/auth/me/`
- **Controller**: `authController.getMe`
- **Auth/RBAC**: `authenticateToken`
- **Output**: Detailed User & linked Employee Profile object

### `POST /api/auth/password-reset/` & `POST /api/auth/password-reset/confirm/`
- **Controller**: `authController.passwordResetRequest` / `passwordResetConfirm`
- **Auth/RBAC**: Public

---

## 2. Employee Endpoints (`/api/employees`)

### `GET /api/employees/`
- **Controller**: `employeeController.getEmployees`
- **Auth/RBAC**: `authenticateToken`, `requirePermission('employees', 'canView')`
- **Query Params**: `department`, `status`, `search`
- **Output**: `{ "count": N, "results": [ ... ] }`

### `POST /api/employees/`
- **Controller**: `employeeController.createEmployee`
- **Auth/RBAC**: `authenticateToken`, `requirePermission('employees', 'canCreate')`
- **Input**: Employee fields (`employee_code`, `name`, `email`, `department`, etc.)

### `GET /api/employees/:id/`, `PUT /api/employees/:id/`, `DELETE /api/employees/:id/`
- **Controller**: `employeeController.getEmployeeById`, `updateEmployee`, `deleteEmployee`
- **Auth/RBAC**: `requirePermission('employees', 'canView' | 'canEdit' | 'canDelete')`

### `GET /api/employees/:id/documents/` & `POST /api/employees/:id/documents/`
- **Controller**: `employeeController.getEmployeeDocuments`, `uploadEmployeeDocument`
- **Middleware**: `upload.single('file')`
- **Media**: Uploads to `media/employee_documents/`

---

## 3. Work Management Endpoints (`/api`)

### `GET /api/clients/` & `POST /api/clients/`
- **Controller**: `workController.getClients`, `createClient`
- **Auth/RBAC**: `authenticateToken`

### `GET /api/work-assignments/` & `POST /api/work-assignments/`
- **Controller**: `workController.getWorkAssignments`, `createWorkAssignment`
- **Engine**: Invokes `workSyncEngine.ts` to compute initial progress weights

### `POST /api/work-assignments/bulk-create/`
- **Controller**: `workController.bulkCreateWorkAssignments`
- **Input**: Array of task objects for batch creation

### `POST /api/work-assignments/:id/start-timer/` & `POST /api/work-assignments/:id/stop-timer/`
- **Controller**: `workController.startTaskTimer`, `stopTaskTimer`
- **Logic**: Tracks real-time `activeTimer` and appends `timeLogs` with duration in seconds

### `GET /api/work-assignments/summary/`
- **Controller**: `workController.getWorkAssignmentsSummary`
- **Output**: Total, pending, in-progress, blocked, completed, overdue, and review counts

### `GET /api/work-deliverables/` & `POST /api/work-deliverables/`
- **Controller**: `workController.getWorkDeliverables`, `createWorkDeliverable`

### `GET /api/work-share-links/` & `POST /api/work-share-links/`
- **Controller**: `workController.getShareLinks`, `createShareLinkHandler`
- **Service**: Calls `shareLinkService.ts` to generate hex token

### `GET /api/public/work-progress/:token/`
- **Controller**: `workController.getPublicWorkProgress`
- **Auth/RBAC**: Public / Unauthenticated token lookup

---

## 4. Attendance Endpoints (`/api`)

### `GET /api/attendance-policy/` & `PUT /api/attendance-policy/`
- **Controller**: `attendanceController.getAttendancePolicyHandler`, `updateAttendancePolicyHandler`

### `POST /api/attendance/check-in/` & `POST /api/attendance/check-out/`
- **Controller**: `attendanceController.checkInAttendance`, `checkOutAttendance`
- **Middleware**: `upload.single('photo')`
- **Engine**: `attendanceEngine.ts` Haversine geofence calculation & status logic

### `GET /api/attendance/` & `GET /api/attendance/summary/` & `GET /api/attendance/export/`
- **Controller**: `attendanceController.getAttendanceRecords`, `getAttendanceSummary`, `exportAttendanceCSV`

### `GET /api/attendance-corrections/` & `POST /api/attendance-corrections/` & `PUT /api/attendance-corrections/:id/`
- **Controller**: `attendanceController.getAttendanceCorrections`, `createAttendanceCorrection`, `updateAttendanceCorrection`

---

## 5. KPI Performance Endpoints (`/api/kpi`)

### `GET /api/kpi/dashboard/` & `GET /api/kpi/my-kpi/`
- **Controller**: `kpiController.getKPIDashboard`, `getMyKPI`
- **Engine**: Calls `KPIService.calculateEmployeeKPI()` for 4-factor scoring

### `POST /api/kpi/rating/` & `GET /api/kpi/export-csv/`
- **Controller**: `kpiController.saveKPIRating`, `exportKPICSV`

---

## 6. Portal Settings & SuperAdmin Endpoints (`/api/portal`)

### `GET /api/portal/departments/` & `POST /api/portal/departments/`
- **Controller**: `portalController.getDepartments`, `createDepartment`

### `GET /api/portal/pages/` & `POST /api/portal/pages/`
- **Controller**: `portalController.getPortalPages`, `createPortalPage`

### `GET /api/portal/roles/` & `GET/PUT /api/portal/roles/:roleId/permissions/`
- **Controller**: `portalController.getDynamicRoles`, `getRolePermissionMatrix`, `updateRolePermissionMatrix`

### `GET /api/portal/navigation/me/`
- **Controller**: `portalController.getDynamicNavigationMe`
- **Logic**: Returns allowed sidebar navigation items based on user's dynamic role permissions

### `GET /api/portal/super-admin/users/` & `POST /api/portal/super-admin/users/`
- **Controller**: `portalController.getSuperAdminUsers`, `createSuperAdminUser`

---

## 7. Leaves, Payroll & Communication Endpoints (`/api`)

### `GET /api/leaves/`, `POST /api/leaves/`, `POST /api/leaves/:id/decide/`
- **Controller**: `leaveController.getLeaves`, `createLeave`, `decideLeave`

### `GET /api/salary-slips/`, `POST /api/salary-slips/generate/`, `GET /api/salary-slips/:id/download/`
- **Controller**: `salaryController.getSalarySlips`, `generateSalarySlip`, `downloadSalarySlip`
- **Service**: Calls `pdfGenerator.ts` for PDFKit document rendering

### `GET /api/meetings/`, `POST /api/announcements/`, `GET /api/notifications/`
- **Controller**: `communicationController.getMeetings`, `createAnnouncement`, `getNotifications`
- **Logic**: Creating announcement broadcasts header bell notifications to all active users

### `GET /api/audit-logs/` & `GET /api/dashboard/`
- **Controller**: `communicationController.getAuditLogs`, `dashboardController.getDashboardStats`
