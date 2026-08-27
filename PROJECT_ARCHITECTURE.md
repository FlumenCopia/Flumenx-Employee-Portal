# Project Architecture: FLUMENX Employee Portal

## 1. System Architecture Overview

FLUMENX Employee Portal is constructed as a modern, decoupled two-tier Web Application:

1. **Frontend Tier**: Next.js 15 (App Router) + React 19 + TypeScript client application running on Node.js / Vercel.
2. **Backend Tier**: Express.js + TypeScript REST API server running on Node.js.
3. **Database Tier**: MongoDB document store managed via Mongoose ODM.

```text
+-----------------------------------------------------------------------+
|                            NEXT.JS 15 FRONTEND                        |
|   (App Router Pages, Feature Components, Vanilla CSS Design System)   |
+-----------------------------------------------------------------------+
                                   │
                   HTTP REST APIs (JSON / Cookies)
                                   │
                                   ▼
+-----------------------------------------------------------------------+
|                           EXPRESS.JS BACKEND                          |
|  [CORS] -> [CookieParser] -> [Auth Middleware] -> [CSRF Verification] |
|                                  │                                    |
|         ┌────────────────────────┼────────────────────────┐           |
|         ▼                        ▼                        ▼           |
|   Controllers                Services                 Middleware      |
|  (HTTP Handlers)        (Business Engines)          (RBAC / Upload)   |
|         │                        │                        │           |
|         └────────────────────────┼────────────────────────┘           |
|                                  │                                    |
|                                  ▼                                    |
|                           Mongoose ODM Models                         |
+-----------------------------------------------------------------------+
                                   │
                           MongoDB Wire Protocol
                                   │
                                   ▼
+-----------------------------------------------------------------------+
|                            MONGODB DATABASE                           |
|                       (flumenx_portal Collection)                     |
+-----------------------------------------------------------------------+
```

---

## 2. Application Startup Sequence

```text
[Node Process Execution: tsx watch src/server.ts]
                         │
                         ▼
             Environment Configuration (`env.ts`)
  - Reads process.env (PORT, MONGODB_URI, JWT_SECRET, CORS_ORIGINS)
                         │
                         ▼
             Database Initialization (`db.ts`)
  - Mongoose connects to MongoDB URI (Timeout: 5000ms)
                         │
                         ▼
             Express App Middleware Setup (`server.ts`)
  - CORS Middleware (Origin check, credentials: true, exposed headers)
  - CookieParser Middleware
  - JSON Body Parser & URL Encoded Body Parser
  - Static Media File Serving (/media directory protected by auth)
  - CSRF Verification Middleware (`verifyCsrf`)
                         │
                         ▼
             Route Registration (`routes/index.ts`)
  - Mounts routes under `/api` and `/`
    - `/auth` -> Auth Router
    - `/employees` -> Employee Router
    - `/` -> Work, Attendance, KPI, Portal, Other Routers
                         │
                         ▼
             Global Error Handler (`errorHandler.ts`)
  - Intercepts CastError (404) and ApiError / standard exceptions (500/400)
                         │
                         ▼
             HTTP Server Listen (`server.ts`)
  - Binds to PORT (Default: 8000)
```

---

## 3. Complete Request/Response Lifecycle

```text
HTTP Request (Client)
  │
  ▼
CORS Filter (validates origin & credentials)
  │
  ▼
Cookie Parser (extracts access_token, refresh_token, csrftoken)
  │
  ▼
CSRF Middleware (`verifyCsrf`: validates X-CSRFToken header against cookie)
  │
  ▼
Authentication Middleware (`authenticateToken`: validates JWT Bearer or Cookie)
  │
  ▼
RBAC Middleware (`requirePermission` / `requireRole`: checks dynamic user permissions)
  │
  ▼
Controller Endpoint Handler (e.g. `checkInAttendance`, `createWorkAssignment`)
  │
  ├──────────────────────────────────┐
  ▼                                  ▼
Domain Engine Calculation     Direct Model Query
(e.g., `calculateAttendance`,  (e.g., `Employee.find()`)
 `calculateKPI`)                     │
  │                                  │
  └──────────────────────────────────┘
  │
  ▼
MongoDB Execution via Mongoose ODM
  │
  ▼
Response JSON Formatter (Transforms MongoDB documents to Django API format parity)
  │
  ▼
HTTP 200/201/204 Response to Client
```

---

## 4. Key Architectural Sub-Modules

### Authentication & Session Management
- **Tokens**: Dual JWT strategy (`access_token` expires in 15 minutes, `refresh_token` expires in 7 days).
- **Cookies**: HTTP-only, `SameSite=lax` cookies set automatically upon login (`access_token`, `refresh_token`).
- **CSRF**: Double-submit CSRF cookie pattern (`csrftoken` cookie matched against `X-CSRFToken` request header).

### Dynamic RBAC & Permission Engine
- **Wildcard SuperAdmin**: Users with `role === 'SUPER_ADMIN'` or `isSuperuser === true` or dynamic role with `isSuperadminWildcard === true` bypass all permission checks.
- **Module Permission Checks**: `requirePermission(moduleCode, action)` dynamically looks up the user's attached `DynamicRole` document, matches the `PortalPage` module code, and verifies `canView`, `canCreate`, `canEdit`, or `canDelete`.
- **Role Fallback**: Fallback hardcoded module maps exist for standard roles (`HR`, `ADMIN`, `TEAM_LEAD`, `EMPLOYEE`).

---

## 5. Critical Files Inventory

### Critical Architecture Files
- [`backend/src/server.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/server.ts): Express server entry point and pipeline configuration.
- [`backend/src/config/env.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/config/env.ts): Central environment variable definitions.
- [`backend/src/config/db.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/config/db.ts): Database connection bootstrap.
- [`frontend/lib/api.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/frontend/lib/api.ts): Central frontend API client, token refresh logic, and CSRF token injection.

### Core Business Logic Files
- [`backend/src/services/workSyncEngine.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/services/workSyncEngine.ts): Work quantity calculation, status weighting, deliverable aggregation, and parent task cascading.
- [`backend/src/services/kpiEngine.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/services/kpiEngine.ts): 4-factor employee KPI scoring algorithm and grade assigner.
- [`backend/src/services/attendanceEngine.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/services/attendanceEngine.ts): Geofence distance calculation (Haversine formula) and attendance status logic.
- [`backend/src/services/pdfGenerator.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/services/pdfGenerator.ts): PDFKit corporate salary slip document generator.

### Authentication & Authorization Files
- [`backend/src/middleware/auth.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/middleware/auth.ts): JWT authentication middleware.
- [`backend/src/middleware/csrf.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/middleware/csrf.ts): Double-submit CSRF verification.
- [`backend/src/middleware/rbac.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/middleware/rbac.ts): Dynamic RBAC permission validator.
- [`backend/src/controllers/authController.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/controllers/authController.ts): Login, registration, token refresh, and user context endpoints.

---

## 6. Dependency & Impact Maps

```text
Authentication Subsystem
├── middleware/auth.ts
├── middleware/csrf.ts
├── controllers/authController.ts
├── models/User.ts
├── models/Employee.ts
├── frontend/lib/api.ts
└── frontend/lib/auth-cache.ts

Work Assignment Subsystem
├── controllers/workController.ts
├── services/workSyncEngine.ts
├── services/shareLinkService.ts
├── models/WorkAssignment.ts
├── models/Client.ts
├── models/ClientWorkShareLink.ts
└── frontend/features/work/

Attendance Subsystem
├── controllers/attendanceController.ts
├── services/attendanceEngine.ts
├── models/AttendanceRecord.ts
├── models/AttendancePolicy.ts
├── models/AttendanceCorrection.ts
└── frontend/features/attendance/

KPI Performance Subsystem
├── controllers/kpiController.ts
├── services/kpiEngine.ts
├── models/EmployeeKPIRating.ts
├── models/WorkAssignment.ts
├── models/AttendanceRecord.ts
└── frontend/features/kpi/
```
