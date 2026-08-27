# Project Data Model & Database Architecture: FLUMENX Employee Portal

This document documents all 19 database entities, embedded subdocuments, relationships, schema types, unique constraints, and indexes in MongoDB.

---

## 1. Database Entity Relationship Diagram (ERD)

```text
               ┌──────────────────┐
               │    DynamicRole   │
               └────────┬─────────┘
                        │ 1:N
                        ▼
┌──────────────┐ 1:1  ┌──────────┐ 1:1  ┌──────────────────┐
│  Department  │◄─────│ Employee │─────►│   User (Auth)    │
└──────────────┘      └────┬─────┘      └────────┬─────────┘
                           │ 1:N                 │ 1:N
         ┌─────────────────┼───────────────┐     ├─────────────────┐
         ▼                 ▼               ▼     ▼                 ▼
 ┌──────────────┐  ┌──────────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────┐
 │  Attendance  │  │ LeaveRequest │ │ SalarySlip │ │ Announcement │ │ AuditLog   │
 │   Record     │  └──────────────┘ └────────────┘ └──────────────┘ └────────────┘
 └──────┬───────┘                                        │ 1:N
        │ 1:N                                            ▼
 ┌──────┴───────┐                                 ┌──────────────┐
 │ Attendance   │                                 │ Notification │
 │ Correction   │                                 └──────────────┘
 └──────────────┘

 ┌──────────────┐ 1:N ┌──────────────────┐ 1:N ┌─────────────────────┐
 │    Client    │◄────│  WorkAssignment  │◄────│ ClientWorkShareLink │
 └──────────────┘     └────────┬─────────┘     └─────────────────────┘
                               │ (Embedded Array)
                               ▼
                      ┌──────────────────┐
                      │ WorkDeliverable  │
                      └──────────────────┘
```

---

## 2. Complete Model Schemas & Specifications

### 1. `User` Collection (`models/User.ts`)
- `_id`: ObjectId (Primary Key)
- `legacyId`: Number (Sparse, Unique Index)
- `username`: String (Required, Unique, Trimmed)
- `email`: String (Required, Unique, Trimmed, Lowercase)
- `password`: String (Hashed via bcrypt or Django PBKDF2)
- `firstName`: String (Default: `""`)
- `lastName`: String (Default: `""`)
- `isActive`: Boolean (Default: `true`)
- `isStaff`: Boolean (Default: `false`)
- `isSuperuser`: Boolean (Default: `false`)
- `role`: String Enum (`SUPER_ADMIN`, `HR`, `ADMIN`, `ACCOUNTANT`, `BDE`, `TEAM_LEAD`, `EMPLOYEE`, `OPERATIONS`, `OPERATIONS_HEAD`)
- `dynamicRole`: ObjectId -> Ref: `DynamicRole`
- `dateJoined`: Date (Default: `Date.now`)

### 2. `DynamicRole` Collection (`models/DynamicRole.ts`)
- `_id`: ObjectId (Primary Key)
- `name`: String (Required)
- `code`: String (Required, Unique)
- `description`: String (Default: `""`)
- `isSuperadminWildcard`: Boolean (Default: `false`)
- `isSystemRole`: Boolean (Default: `false`)
- `permissions`: Embedded Array of `rolePermissionSchema`:
  - `page`: ObjectId -> Ref: `PortalPage`
  - `canView`, `canCreate`, `canEdit`, `canDelete`: Boolean

### 3. `Department` Collection (`models/Department.ts`)
- `name`: String (Required, Unique)
- `code`: String (Required, Unique)
- `description`: String
- `isActive`: Boolean (Default: `true`)
- `displayOrder`: Number (Default: `0`)
- **Index**: `{ displayOrder: 1, name: 1 }`

### 4. `PortalPage` Collection (`models/PortalPage.ts`)
- `title`: String (Required)
- `routePath`: String (Required, Unique)
- `moduleCode`: String (Required, Unique)
- `icon`: String (Default: `'LayoutDashboard'`)
- `sidebarOrder`: Number (Default: `0`)
- `isActive`: Boolean (Default: `true`)
- **Index**: `{ sidebarOrder: 1, title: 1 }`

### 5. `Employee` Collection (`models/Employee.ts`)
- `user`: ObjectId -> Ref: `User` (Unique, Sparse)
- `employeeCode`: String (Required, Unique)
- `name`: String (Required)
- `email`: String (Required, Unique)
- `phone`: String (Required)
- `department`: String (Required)
- `departmentRef`: ObjectId -> Ref: `Department`
- `designation`: String (Required)
- `joiningDate`: Date (Required)
- `status`: String Enum (`Active`, `On Leave`, `Inactive`)
- `avatar`: String
- `location`: String
- `teamLead`: ObjectId -> Ref: `Employee`
- **Indexes**: `{ status: 1, name: 1 }`, `{ department: 1, status: 1 }`

### 6. `Client` Collection (`models/Client.ts`)
- `name`: String (Required, Unique)

### 7. `WorkAssignment` Collection (`models/WorkAssignment.ts`)
- `employee`: ObjectId -> Ref: `Employee`
- `client`: ObjectId -> Ref: `Client`
- `parentTask`: ObjectId -> Ref: `WorkAssignment`
- `isMasterClientTask`: Boolean (Default: `false`)
- `title`: String (Required)
- `description`: String
- `priority`: String Enum (`Low`, `Normal`, `High`, `Urgent`)
- `assignedDate`: Date (Required)
- `dueDate`: Date (Required)
- `status`: String Enum (`Backlog`, `Assigned`, `Pending`, `In Progress`, `Ongoing`, `Blocked`, `In Review`, `Changes Requested`, `Rejected`, `Approved`, `Completed`, `Published`)
- `progress`: Number (0 - 100)
- `assignedQuantity`: Number (Default: 100)
- `completedQuantity`: Number (Default: 0)
- `unit`: String (Default: `'%'`)
- `completedAt`: Date
- `assignedBy`: ObjectId -> Ref: `User`
- `reviewer`: ObjectId -> Ref: `User`
- `reviewStatus`: String Enum (`PENDING_REVIEW`, `OK`, `CORRECTION_NEEDED`)
- `reviewNote`: String
- `deliverables`: Embedded Array of `workDeliverableSchema`:
  - `title`, `brief`, `workType`, `dueDate`, `status`, `completedAt`, `client`
- `totalTimeSpentSeconds`: Number (Default: 0)
- `activeTimer`: Embedded Object (`startedAt`, `startedBy`)
- `timeLogs`: Embedded Array of `timeLogSchema` (`startTime`, `endTime`, `durationSeconds`, `loggedBy`)
- **Indexes**: `{ dueDate: 1, status: 1 }`, `{ status: 1, priority: 1 }`

### 8. `ClientWorkShareLink` Collection (`models/ClientWorkShareLink.ts`)
- `token`: String (Required, Unique, Indexed)
- `client`: ObjectId -> Ref: `Client` (Required)
- `assignment`: ObjectId -> Ref: `WorkAssignment`
- `publicUpdate`: String
- `createdBy`: ObjectId -> Ref: `User`
- `expiresAt`: Date
- `isRevoked`: Boolean (Default: `false`)
- **Indexes**: `{ token: 1, isRevoked: 1 }`, `{ client: 1, isRevoked: 1 }`

### 9. `AttendancePolicy` Collection (`models/AttendancePolicy.ts`)
- Singleton Document (`officeStartTime`, `gracePeriodMinutes`, `officeEndTime`, `earlyCheckoutHalfDayCutoff`, `halfDayHours`, `fullDayHours`, `officeLatitude`, `officeLongitude`, `allowedRadiusMeters`, `activeQrReference`)

### 10. `AttendanceRecord` Collection (`models/AttendanceRecord.ts`)
- `employee`: ObjectId -> Ref: `Employee`
- `attendanceDate`: Date (Required)
- `checkInTime`: String (`"09:15"`)
- `checkOutTime`: String (`"18:30"`)
- `checkInStatus`: String (`"On Time"`, `"Grace Period"`, `"Late"`)
- `attendanceStatus`: String Enum (`Present`, `Present (Late)`, `Present (Early Exit)`, `Present (Late + Early Exit)`, `Absent`, `Half Day`, `Leave`)
- `isLate`: Boolean
- `lateMinutes`: Number
- `isEarlyExit`: Boolean
- `earlyExitMinutes`: Number
- `workingHours`: Number
- `source`: String Enum (`Manual`, `QR`, `QR + Location`, `Admin`)
- `latitude`, `longitude`: Number
- `checkInDistanceMeters`: Number
- `locationVerified`: Boolean
- `photo`: String (Image URL)
- **Indexes**: `{ attendanceDate: 1 }`, `{ employee: 1, attendanceDate: 1 }` (Unique Constraint)

### 11. `AttendanceCorrection` Collection (`models/AttendanceCorrection.ts`)
- `employee`: ObjectId -> Ref: `Employee`
- `attendanceRecord`: ObjectId -> Ref: `AttendanceRecord` (Required)
- `requestedCheckIn`, `requestedCheckOut`: String
- `reason`: String (Required)
- `status`: String Enum (`Pending`, `Approved`, `Rejected`)
- `adminNote`: String
- `reviewedBy`: ObjectId -> Ref: `User`
- `reviewedAt`: Date

### 12. `LeaveRequest` Collection (`models/LeaveRequest.ts`)
- `employee`: ObjectId -> Ref: `Employee`
- `leaveType`: String Enum (`Annual`, `Sick`, `Personal`, `Unpaid`)
- `startDate`, `endDate`: Date (Required)
- `reason`: String (Required)
- `status`: String Enum (`Pending`, `Approved`, `Rejected`)
- `adminNote`: String
- **Index**: `{ status: 1, createdAt: -1 }`

### 13. `SalarySlip` Collection (`models/SalarySlip.ts`)
- `employee`: ObjectId -> Ref: `Employee`
- `month`, `year`: Number (Required)
- `file`: String (PDF File URL)
- `grossSalary`, `netSalary`: Number
- `basicSalary`, `hra`, `conveyance`, `allowances`, `pf`, `tax`, `deductions`: Number
- `uploadedAt`: Date
- **Indexes**: `{ year: -1, month: -1 }`, `{ employee: 1, month: 1, year: 1 }` (Unique Constraint)

### 14. `EmployeeKPIRating` Collection (`models/EmployeeKPIRating.ts`)
- `employee`: ObjectId -> Ref: `Employee`
- `month`, `year`: Number (Required)
- `rating`: Number (1.0 - 5.0)
- `notes`: String
- `ratedBy`: ObjectId -> Ref: `User`
- **Index**: `{ employee: 1, month: 1, year: 1 }` (Unique Constraint)

### 15. `Meeting` Collection (`models/Meeting.ts`)
- `title`: String (Required)
- `date`: Date (Required)
- `time`: String (Required)
- `description`, `department`, `location`: String
- `createdBy`: ObjectId -> Ref: `User`

### 16. `Announcement` Collection (`models/Announcement.ts`)
- `title`, `message`: String (Required)
- `date`: Date (Default: `Date.now`)
- `priority`: String Enum (`Normal`, `Important`, `Urgent`)
- `createdBy`: ObjectId -> Ref: `User`

### 17. `Notification` Collection (`models/Notification.ts`)
- `user`: ObjectId -> Ref: `User`
- `title`, `message`: String (Required)
- `category`: String (Default: `'General'`)
- `isRead`: Boolean (Default: `false`)
- **Index**: `{ user: 1, isRead: 1, createdAt: -1 }`

### 18. `AuditLog` Collection (`models/AuditLog.ts`)
- `actor`: ObjectId -> Ref: `User`
- `action`, `entityType`: String (Required)
- `entityId`: String
- `details`: Mixed Object
- **Index**: `{ createdAt: -1 }`

### 19. `EmployeeDocument` Collection (`models/EmployeeDocument.ts`)
- `employee`: ObjectId -> Ref: `Employee` (Required)
- `title`, `documentType`, `fileName`, `fileUrl`, `fileType`: String
- `fileSize`: Number
- `uploadedBy`: ObjectId -> Ref: `User`
