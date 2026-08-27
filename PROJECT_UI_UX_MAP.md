# Project UI/UX & Responsive Map: FLUMENX Employee Portal

This document documents the frontend user interface system, component hierarchy, state management, design tokens, responsive mobile implementation, and accessibility findings.

---

## 1. UI Architecture & Design System Tokens

**Styling Strategy**: Vanilla CSS with CSS custom properties (`var(...)`) defined in [`frontend/app/globals.css`](file:///d:/flumenx/Flumenx-Employee-Portal/frontend/app/globals.css).

### Design Tokens (`:root`)
- **Primary Brand Accent**: `--primary-green: #087A5B`, `--amber: #087A5B` (Deep Emerald Green)
- **Hover & Dark Brand**: `--goldD: #066348`, `--sidebar-active: #23463C`
- **Soft Background Accent**: `--soft-brand-bg: #E7F3EE`
- **Background Fill**: `--bg: #F3F5F4` (Off-white / Slate Gray)
- **Panels & Cards**: `--panel: #FFFFFF`, `--panel2: #F8FAF9`
- **Borders & Dividers**: `--border: #DCE3E0`, `--line: #DCE3E0`, `--border2: #C9D3CF`
- **Typography Colors**: `--text: #18231F` (Charcoal Black), `--muted: #5F6F69`, `--dim: #89958F`
- **Sidebar Theme**: `--sidebar-bg: #13231F`, `--sidebar-sec: #192D27`, `--sidebar-active: #23463C`
- **Status Colors**:
  - Success: `--green: #16855B`
  - Danger / Error: `--red: #C84B4B`, `--danger: #C84B4B`
  - Warning: `--warning: #C98717`
  - Info: `--info: #3976C4`
- **Typography**: Google Font `Jost` (`--font-body`), System UI fallbacks.
- **Border Radii**: `--r: 10px` (Cards/Panels), `--r-sm: 6px` (Inputs/Buttons/Badges), `--r-full: 9999px` (Pills/Avatars)

---

## 2. Page & Route Map

### Role-Based Workspace Routing Model
The application uses role-scoped workspace route prefixes mapped to user roles:
- `admin` -> `/admin/*` (`SUPER_ADMIN`, `ADMIN`, `OPERATIONS`, `OPERATIONS_HEAD`)
- `hr` -> `/hr/*` (`HR`)
- `accountant` -> `/accountant/*` (`ACCOUNTANT`)
- `bdo` -> `/bdo/*` (`BDE`)
- `team-lead` -> `/team-lead/*` (`TEAM_LEAD`)
- `employee` -> `/employee/*` (`EMPLOYEE`)

Role layouts (`app/[role]/layout.tsx`) wrap pages with `<Shell role={role}>`. The `normalizeWorkspaceRoute()` helper in [`frontend/components/layout/navigation.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/frontend/components/layout/navigation.ts) normalizes navigation paths to canonical feature destinations while maintaining workspace role security guards.

### Route Map Matrix

| URL Path Pattern | Page Component | Layout Shell | Data Loaded | APIs Called | Key User Actions |
|---|---|---|---|---|---|
| `/login` | `LoginPage` | Unauthenticated | None | `POST /api/auth/login/`, `GET /api/auth/csrf/` | Account login |
| `/reset-password` | `ResetPasswordPage` | Unauthenticated | None | `POST /api/auth/password-reset/` | Request password reset |
| `/[role]/dashboard` | `DashboardPage` | `Shell role={role}` | Stats, Tasks, Attendance, Leaves | `GET /api/dashboard/`, `GET /api/auth/me/` | View workspace overview & metrics |
| `/employees`, `/[role]/employees` | `EmployeesPage` | `Shell` | Employee Directory, Documents | `GET /api/employees/`, `GET /api/portal/departments/` | Add/Edit employee, upload/delete docs |
| `/employee/[id]` | `EmployeeDetailPage` | `Shell` | Employee Profile | `GET /api/employees/:id/` | View detailed employee profile |
| `/attendance`, `/[role]/attendance` | `EmployeeAttendancePage` / `AdminAttendancePage` | `Shell` | Attendance Records, Policy | `GET /api/attendance/`, `GET /api/attendance-policy/` | Camera QR Check-In/Out, Corrections |
| `/leaves`, `/[role]/leaves` | `LeavesPage` | `Shell` | Leave Requests | `GET /api/leaves/` | Apply leave, Approve/Reject leave |
| `/work`, `/[role]/work` | `WorkManagementPage` | `Shell` | Work Assignments, Deliverables, Clients | `GET /api/work-assignments/`, `GET /api/clients/` | Create task, Start/stop timer, Deliverables |
| `/team-work`, `/[role]/team-work` | `TeamWorkPage` | `Shell` | Work Assignments (Team Lead view) | `GET /api/work-assignments/` | Review submitted team tasks |
| `/kpi`, `/[role]/kpi` | `KPIDashboardPage` | `Shell` | KPI Scores, Averages, Rankings | `GET /api/kpi/dashboard/`, `GET /api/kpi/my-kpi/` | Rate manager factor, CSV Export |
| `/clients`, `/[role]/clients` | `ClientMasterPage` | `Shell` | Clients, KPI Health, Share Links | `GET /api/clients/`, `GET /api/work-share-links/` | Add client, Generate public Share link |
| `/meetings`, `/[role]/meetings` | `MeetingsPage` | `Shell` | Meetings & Announcements | `GET /api/meetings/`, `GET /api/announcements/` | Schedule meeting, Broadcast announcement |
| `/settings`, `/[role]/settings` | `SettingsAccessPage` | `Shell` | Departments, Pages, Dynamic Roles, Users | `GET /api/portal/departments/`, `GET /api/portal/roles/` | RBAC Matrix, User roles, SuperAdmin users |
| `/timer` | `TaskTimerPage` | `Shell` | Active Task Timer | `GET /api/work-assignments/` | Real-time task timer control |
| `/share/[token]` | `PublicWorkProgressPage` | Public (No Shell) | Public Work Progress | `GET /api/public/work-progress/:token/` | View client progress report |

---

## 3. Component Architecture & Reusability

### Layout & Global Components
- **`Shell`** ([`frontend/components/shell.tsx`](file:///d:/flumenx/Flumenx-Employee-Portal/frontend/components/shell.tsx)): Sticky sidebar navigation, top header bar, notification bell dropdown (`NotificationBell`), task creation modal trigger, and confirmation modal (`LogoutModal`).
- **`NotificationBell`**: Real-time / polled unread notification drop-down feed with mark-as-read triggers.
- **`AppInitialLoader`**: Splash screen shown during initial session validation.

### Feature Components
- **`WorkManagementPage`** & **`CommandCenterView`**: Complex multi-column Kanban and List workboards, deliverable expanders, task timer controls, and share link modal triggers.
- **`EmployeeAttendancePage`** & **`AttendanceCameraModal`**: Geofenced QR code check-in widget with HTML5 webcam photo capture and Haversine distance verification.
- **`KPIDashboardPage`** & **`EmployeeKPIDetailPage`**: Visual KPI progress rings, grade badges, department average cards, and manager rating sliders.
- **`ClientMasterPage`**: Client cards, satisfaction score gauges, and share link management drawers.
- **`EmployeesPage`** & **`EmployeeDocumentsModal`**: Employee table grid and PDF document upload/delete drawer.

---

## 4. Frontend State Management

1. **Global Auth State**: Managed via `ShellUserContext` React Context provided by `Shell`, backed by `loadAuthUser()` and `getCachedAuthUser()` in [`frontend/lib/auth-cache.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/frontend/lib/auth-cache.ts).
2. **Server State & Data Fetching**: Managed via custom async `api()` wrapper in [`frontend/lib/api.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/frontend/lib/api.ts). Automatically handles 401 token refresh, CSRF token header injection (`X-CSRFToken`), and error formatting.
3. **Local Component State**: Standard React `useState` and `useCallback` hooks for active modals, search query filters, tab switching, and form inputs.

---

## 5. Mobile & Responsive Discovery

### Responsive Breakpoints
- **Desktop / Laptop (`> 1050px`)**: Full sidebar navigation expanded (248px width), multi-column grid layouts (4-column stats, 2-column dashboard grid).
- **Tablet (`761px - 1050px`)**: Stats grid collapses to 2 columns (`grid-template-columns: repeat(2, 1fr)`), table layouts enable horizontal overflow scrolling.
- **Mobile Phones (`≤ 760px`)**:
  - Sidebar collapses off-screen (`transform: translateX(-100%)`).
  - Hamburger menu button appears in sticky topbar.
  - Page padding narrows (`padding: 28px 16px 55px`).
  - Form grids collapse to single column (`grid-template-columns: 1fr`).
  - Tables acquire horizontal scroll wrappers (`overflow: auto`, `min-width: 720px`).

### Discovered UI Inconsistencies & Potential Issues — DO NOT FIX
1. **Button Style Inconsistency**: Primary buttons on `/login` use a custom `linear-gradient` (`background: linear-gradient(135deg, #087A5B 0%, #066349 100%)`), whereas primary buttons across internal pages use solid `--amber: #087A5B`.
2. **Table Horizontal Overflow on Mobile**: Tables on `/attendance` and `/salary-slips` rely on fixed minimum column widths (`min-width: 900px`). On mobile screens (<360px width), users must swipe horizontally to view row action buttons.
3. **Camera Modal Viewport**: The webcam capture modal on mobile devices requires explicit camera permission prompts which may fail if accessed over unsecure HTTP origins (requires HTTPS).

---

## 6. Accessibility Discovery (a11y)

- **Semantic HTML**: Structural tags (`<aside>`, `<main>`, `<header>`, `<nav>`, `<article>`, `<button>`) are used throughout `shell.tsx` and feature pages.
- **ARIA Attributes**: `aria-expanded` and `aria-label` are present on key interactive elements such as `NotificationBell`, mobile menu toggle, and modal close buttons.
- **Keyboard Navigation**: Focus outline rings (`focus-within` with `box-shadow`) are styled for input fields and buttons. `Escape` key listeners close `LogoutModal` and `NotificationBell`.
