# Project Codebase Map: FLUMENX Employee Portal

## 1. Repository Inventory

The repository is structured into distinct top-level directories handling the Express/MongoDB backend, Next.js frontend, legacy Django backup, system documentation, and environment configurations.

### Root Directories & Files
- `backend/`: Primary production Express.js + TypeScript + MongoDB application server.
- `frontend/`: Primary production Next.js 15 + React 19 + TypeScript client application.
- `docs/`: Audit logs, parity matrices, UAT reports, and migration risk documents from the Django → Express migration.
- `backend-django-backup/`: Legacy Django REST Framework backend (retained for reference and database migration source).
- `.gitignore`: Git exclusion patterns for Node modules, build outputs, environment files, and media.
- `README.md`: Workspace placeholder file.

---

## 2. Complete File Structure

```text
Flumenx-Employee-Portal/
├── backend/
│   ├── .env                       # Local environment variable configuration
│   ├── package.json               # Backend dependencies & script definitions
│   ├── tsconfig.json              # TypeScript compilation options (ES2022/NodeNext)
│   ├── media/                     # User uploads (attendance photos, salary PDFs, avatars, docs)
│   └── src/
│       ├── server.ts              # HTTP server entry point & middleware mounting
│       ├── config/
│       │   ├── db.ts              # Mongoose MongoDB connection initializer
│       │   └── env.ts             # Centralized environment variable loader
│       ├── models/                # 19 Mongoose document schemas & TypeScript interfaces
│       │   ├── User.ts
│       │   ├── DynamicRole.ts
│       │   ├── Department.ts
│       │   ├── PortalPage.ts
│       │   ├── Employee.ts
│       │   ├── Client.ts
│       │   ├── WorkAssignment.ts
│       │   ├── ClientWorkShareLink.ts
│       │   ├── AttendancePolicy.ts
│       │   ├── AttendanceRecord.ts
│       │   ├── AttendanceCorrection.ts
│       │   ├── LeaveRequest.ts
│       │   ├── SalarySlip.ts
│       │   ├── EmployeeKPIRating.ts
│       │   ├── Meeting.ts
│       │   ├── Announcement.ts
│       │   ├── Notification.ts
│       │   ├── AuditLog.ts
│       │   └── EmployeeDocument.ts
│       ├── controllers/           # HTTP Request/Response handlers
│       │   ├── authController.ts
│       │   ├── employeeController.ts
│       │   ├── workController.ts
│       │   ├── attendanceController.ts
│       │   ├── kpiController.ts
│       │   ├── portalController.ts
│       │   ├── salaryController.ts
│       │   ├── leaveController.ts
│       │   ├── communicationController.ts
│       │   └── dashboardController.ts
│       ├── services/              # Pure business logic & calculation engines
│       │   ├── attendanceEngine.ts # Haversine geo-distance & status calculations
│       │   ├── kpiEngine.ts        # 4-factor KPI scoring engine & grade assigner
│       │   ├── workSyncEngine.ts   # Work quantity sync, deliverable weights & cascading
│       │   ├── shareLinkService.ts # Public share link token generation & validation
│       │   └── pdfGenerator.ts     # PDFKit salary slip document renderer
│       ├── middleware/            # Express request pipeline handlers
│       │   ├── auth.ts            # JWT token verifier (Header & Cookie)
│       │   ├── csrf.ts            # Double-submit CSRF protection middleware
│       │   ├── rbac.ts            # Dynamic RBAC & permission checking middleware
│       │   ├── errorHandler.ts    # Centralized API error formatter
│       │   ├── upload.ts          # Multer disk storage handler for media files
│       │   └── asyncHandler.ts    # Async wrapper for route handlers
│       ├── routes/                # Express router declarations
│       │   ├── index.ts           # Root router bundler
│       │   ├── authRoutes.ts
│       │   ├── employeeRoutes.ts
│       │   ├── workRoutes.ts
│       │   ├── attendanceRoutes.ts
│       │   ├── kpiRoutes.ts
│       │   ├── portalRoutes.ts
│       │   └── otherRoutes.ts
│       ├── types/
│       │   └── express.d.ts       # Express Request type extensions (req.user)
│       └── scripts/               # Migration and utility scripts
│           ├── migrateFromDjango.ts
│           ├── seed_rbac_and_data.ts
│           ├── seed_clients_page.ts
│           ├── seed_timer_page.ts
│           └── test_all_ui_api_flows.ts
│
├── frontend/
│   ├── package.json               # Next.js frontend dependencies & scripts
│   ├── next.config.ts             # Next.js configuration
│   ├── tsconfig.json              # TypeScript frontend config
│   ├── vercel.json                # Vercel deployment configuration
│   ├── public/                    # Static assets & brand graphics
│   │   ├── flumenx-dashboard-official-logo.png
│   │   └── flumenx-mark-only.png
│   ├── lib/                       # Core frontend utilities & API client
│   │   ├── api.ts                 # Fetch wrapper with CSRF, JWT refresh & error handling
│   │   ├── auth-cache.ts          # In-memory & LocalStorage user session cache
│   │   ├── navigation.ts          # Navigation link generators & role-to-route maps
│   │   └── types.ts               # Shared TypeScript domain interfaces
│   ├── components/                # Global UI components & shell layout
│   │   ├── shell.tsx              # App Shell layout with sidebar, topbar & notifications
│   │   ├── AppInitialLoader.tsx   # Initial page load splash screen
│   │   ├── admin-dashboard.tsx    # Admin metrics dashboard overview
│   │   ├── employee-dashboard.tsx # Employee dashboard widget view
│   │   ├── intro.tsx              # Splash animation screen
│   │   ├── icons.tsx              # SVG Brand marks & Avatars
│   │   └── layout/
│   │       └── navigation.ts      # Navigation configuration
│   ├── features/                  # Feature-based modular React components
│   │   ├── admin/                 # Audit logs, Settings, Users, Roles & Pages
│   │   ├── announcements/         # Announcement feed components
│   │   ├── attendance/            # Attendance camera modal, reports, & records
│   │   ├── clients/               # Client directory & KPI Health cards
│   │   ├── common/                # Shared UI controls
│   │   ├── employees/             # Employee listing & document management modals
│   │   ├── kpi/                   # KPI dashboard cards & employee detail views
│   │   ├── leaves/                # Leave request lists & approval modals
│   │   ├── meetings/              # Meeting poster & scheduling views
│   │   ├── profile/               # Employee profile views
│   │   ├── salary/                # Salary slip lists & PDF download triggers
│   │   └── work/                  # Work management board, deliverables & task timers
│   └── app/                       # Next.js App Router Pages
│       ├── layout.tsx             # Root HTML layout & font provider
│       ├── page.tsx               # Entry point (redirects to /login)
│       ├── globals.css            # Global CSS variables, utility classes & design system
│       ├── login/                 # Login screen page
│       ├── reset-password/        # Password reset request page
│       ├── dashboard/             # Role-based dashboard router page
│       ├── employees/             # Employee management page
│       ├── employee/[id]/         # Individual employee profile page
│       ├── attendance/            # Attendance check-in/out page
│       ├── leaves/                # Leave management page
│       ├── work/                  # Work assignment board page
│       ├── team-work/             # Team work review page
│       ├── kpi/                   # KPI overview page
│       ├── clients/               # Client management page
│       ├── meetings/              # Meeting schedule page
│       ├── settings/              # System settings & RBAC matrix page
│       └── share/[token]/         # Public client progress share page
│
├── docs/                          # Audit & Migration Documentation
│   ├── API-PARITY-MATRIX-v1.1.md
│   ├── DATA-MIGRATION-PARITY-v1.1.md
│   ├── DJANGO-TO-EXPRESS-PARITY-AUDIT-v1.1.md
│   ├── FINAL-MIGRATION-RISK-REPORT-v1.1.md
│   ├── MODEL-PARITY-MATRIX-v1.1.md
│   ├── REAL-LIFE-EXPRESS-UAT-v1.1.md
│   └── UI-BACKEND-INTEGRATION-GAP-v1.1.md
│
└── backend-django-backup/         # Legacy Django Application (Archive)
```

---

## 3. Folder Responsibilities & Inter-Folder Communication

### Backend Layer Architecture
- **`backend/src/config/`**: Reads process environment variables (`env.ts`) and initializes Mongoose connection (`db.ts`). It is imported by `server.ts` and controllers requiring DB configuration.
- **`backend/src/models/`**: Defines Mongoose Schemas, interfaces, validation rules, and indexes. Imported by controllers, services, and middleware.
- **`backend/src/middleware/`**: Intercepts requests for authentication (`auth.ts`), CSRF validation (`csrf.ts`), role permissions (`rbac.ts`), file upload processing (`upload.ts`), and error handling (`errorHandler.ts`).
- **`backend/src/controllers/`**: Extracts HTTP params/query/body, executes model queries or calls domain services, and returns formatted JSON HTTP responses.
- **`backend/src/services/`**: Encapsulates core business algorithms (Attendance Haversine distance, KPI 4-factor scoring, Work quantity sync, PDFKit rendering).
- **`backend/src/routes/`**: Connects HTTP paths and HTTP methods to their corresponding middleware chains and controllers.

### Frontend Layer Architecture
- **`frontend/app/`**: Next.js App Router page routes. Renders feature components inside the top-level `Shell` component layout.
- **`frontend/components/`**: Layout containers (`shell.tsx`), global navigation loaders, navigation definitions, and dashboard shell components.
- **`frontend/features/`**: Feature-grouped UI components (Modals, Tables, Forms, Action buttons) isolated by domain (`work`, `attendance`, `kpi`, etc.).
- **`frontend/lib/`**: Centralized API communications (`api.ts`), Auth session storage (`auth-cache.ts`), Navigation routing logic (`navigation.ts`), and TypeScript interfaces (`types.ts`).
