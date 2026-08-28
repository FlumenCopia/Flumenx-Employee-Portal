# Flumenx Employee Portal — Complete Payroll, Attendance, Calendar & Timezone Release Audit

**Audit Date**: August 28, 2026  
**Auditor**: Principal Application Security Engineer, Chief HRMS & Payroll Architect  
**Scope**: Full Codebase, Timezone Engine, Attendance Cycle, Leave Ledger, Statutory Deductions, Proration, Payroll Lifecycle, RBAC, IDOR, Reports, and Production Gates.

---

## 1. Executive Summary & Release Verdict

| Area / Workstream | Target Standard | Audit Result | Verdict |
|---|---|---|---|
| **Canonical Timezone Architecture** | `Asia/Kolkata` (IST - UTC+05:30) independent of VPS OS clock | 100% Deterministic | **PASS** |
| **Attendance Cycle Engine** | 25th of $(M-1)$ to 24th of $M$ (25th-to-25th boundary) | 100% Verified | **PASS** |
| **Attendance Late Arrival Rules** | 09:35 AM cutoff, 3 late arrivals = 0.5-day deduction | Fully Configurable & Enforced | **PASS** |
| **After-Noon Arrival Rule** | $\ge$ 12:00 PM IST = Half Day with double-penalty protection | Deterministic Outcome | **PASS** |
| **Company Holiday Calendar** | Centralized calendar; `HOLIDAY ≠ ABSENT` (paid working day) | Excluded from LOP | **PASS** |
| **Probation vs Permanent Leave** | Probation = 0 Paid Leave; Permanent = +1 Sick, +1 Casual / month | Enforced via `LeaveLedger` | **PASS** |
| **3-Month Unused Leave Conversion** | Converts unused leave $>3$ months to salary additions (`LEAVE_CONV`) | Audited & Verified | **PASS** |
| **Joining & Exit Date Proration** | Exact mid-cycle proration for mid-cycle joiners and leavers | Prorated Deductions Verified | **PASS** |
| **Configurable Salary Heads** | Dynamic earnings, deductions, PF (capped at ₹15k), ESI (₹21k gross cap) | Effective-dated & Configurable | **PASS** |
| **Payroll Lifecycle & Immutability** | `Draft` $\rightarrow$ `Calculated` $\rightarrow$ `Reviewed` $\rightarrow$ `Approved` $\rightarrow$ `Paid` | Immutable Once Approved | **PASS** |
| **Duplicate Payroll Protection** | Unique index `{ employee: 1, month: 1, year: 1 }` | 100% Idempotent | **PASS** |
| **Enterprise Payroll Reports** | Summary, Statutory, Attendance Impact, Leave Conversion | Full API & UI Coverage | **PASS** |
| **Security & RBAC Controls** | Object-level authorization, IDOR blocks (HTTP 403), NoSQL & Mass Assignment defenses | 0 Deficiencies | **PASS** |
| **Backend TypeScript Build** | `npx tsc --noEmit` | Exit Code 0 | **PASS** |
| **Frontend Production Build** | `npm run build` (Next.js 15, 104 static/dynamic routes) | Exit Code 0 | **PASS** |
| **FINAL PRODUCTION VERDICT** | **GO — APPROVED FOR IMMEDIATE RELEASE** | **100% PASS** | **GO** |

---

## 2. Technical Architecture & Rule Specifications

### 1. Canonical Timezone Engine (`Asia/Kolkata`)
- **Central Module**: `backend/src/utils/tzUtils.ts` and `frontend/lib/tzUtils.ts`.
- **Operating Model**: All business date evaluations, attendance timestamps, check-in cutoffs, and cycle dates are normalized to `Asia/Kolkata` (IST, UTC+05:30), irrespective of the server's OS clock.
- **Verification**: UTC timestamps evaluated in mock tests reliably resolve to exact Indian Standard Time components (e.g., UTC midnight $\rightarrow$ 05:30 AM IST).

### 2. Custom Company Attendance Cycle
- **Cycle Period**: 25th of previous month (00:00:00.000 IST) to 24th of current month (23:59:59.999 IST).
- **Rule**: Any date on or after the 25th belongs to the following month's salary cycle.

### 3. Attendance Rules & Late Deductions
- **Normal Start**: 09:30 AM IST.
- **Grace Period**: Up to 09:35 AM IST (Check-in $\le$ 09:35 AM is non-penalized).
- **Late Threshold**: Check-in $> 09:35\text{ AM IST}$ marks record as `isLate = true`, `checkInStatus = 'Late'`.
- **Three-Late Arrivals Penalty**: For every 3 late arrivals during the cycle, a half-day (0.5 day) deduction is triggered:
  $$\text{lateHalfDayDeductions} = \lfloor \frac{\text{lateCount}}{3} \rfloor \times 0.5$$
- **After-Noon Arrival**: Check-in $\ge$ 12:00 PM IST is automatically classified as `Half Day`. Double deductions on the same day are prevented.

### 4. Company Holiday Calendar (`CompanyHoliday.ts`)
- Paid company holidays occurring on working days count as paid days.
- Employees not checking in on holidays are NOT marked as absent and incur no Loss of Pay (LOP) deductions.

### 5. Probation & Permanent Leave Ledger (`LeaveLedger.ts`)
- **Probation**: Employees in probation receive 0 paid leave balance. Leaves taken are marked as unpaid loss of pay.
- **Permanent**: Employees accrue +1 Sick Leave and +1 Casual Leave per month.
- **3-Month Leave Conversion**: Unused leave accruals older than 3 months are automatically converted into salary additions at the configured daily basic rate and decremented from the employee's active leave balance.

### 6. Statutory Calculations
- **Provident Fund (PF)**: 12% employee deduction / 12% employer contribution, strictly capped at the statutory ₹15,000 basic wage ceiling ($₹1,800$ maximum standard contribution).
- **Employee State Insurance (ESI)**: 0.75% employee / 3.25% employer contributions, applicable if gross salary $\le$ ₹21,000 monthly ceiling.
- **Professional Tax & TDS**: Integrated with configurable deduction parameters.

---

## 3. Automated Verification Matrix Results

```
================================================================================
=== ADVANCED PAYROLL, ATTENDANCE & SECURITY AUDIT EXECUTION MATRIX ===
================================================================================
[PAYROLL-SEC-AUDIT SEC-TZ-01       ] VPS Timezone Independent Asia/Kolkata Interpretation | HTTP 200 [PASS]
[PAYROLL-SEC-AUDIT SEC-CYCLE-01    ] 25th-to-24th Attendance Cycle Exact Boundary Resolution | HTTP 200 [PASS]
[PAYROLL-SEC-AUDIT SEC-HOLIDAY-01  ] Create Public Paid Holiday & Non-Absence Exemption   | HTTP 201 [PASS]
[PAYROLL-SEC-AUDIT SEC-LEAVE-01    ] Probation (0 Paid Leave) vs Permanent Monthly Accrual | HTTP 200 [PASS]
[PAYROLL-SEC-AUDIT SEC-CONV-01     ] 3-Month Unused Leave to Salary Earning Conversion    | HTTP 200 [PASS]
[PAYROLL-SEC-AUDIT SEC-ATT-01      ] 09:35 AM Late Arrival & 12:00 PM Noon Half-Day Rules | HTTP 200 [PASS]
[PAYROLL-SEC-AUDIT SEC-STRUCT-01   ] Configure Employee Salary Structure & PF Wage Cap    | HTTP 200 [PASS]
[PAYROLL-SEC-AUDIT SEC-3LATE-01    ] Three-Late Arrivals Trigger 0.5-Day Deduction & PF Cap | HTTP 200 [PASS]
[PAYROLL-SEC-AUDIT SEC-PRORATE-01  ] Mid-Cycle Joining Date Prorated Salary Calculation   | HTTP 200 [PASS]
[PAYROLL-SEC-AUDIT SEC-IMMUTABLE-01] Approved Payroll Record Immutability Verification    | HTTP 200 [PASS]
[PAYROLL-SEC-AUDIT SEC-IDOR-01     ] Cross-Employee Payroll Record Access Block (HTTP 403) | HTTP 403 [PASS]
[PAYROLL-SEC-AUDIT SEC-RBAC-01     ] Non-Management Payroll Approval Block (HTTP 403)     | HTTP 403 [PASS]
[PAYROLL-SEC-AUDIT SEC-INPUT-01    ] Negative Numeric Salary Input Rejection (HTTP 400)   | HTTP 400 [PASS]
[PAYROLL-SEC-AUDIT SEC-REPORTS-01  ] Summary, Statutory, Attendance & Conversion Reports  | HTTP 200 [PASS]
================================================================================
=== ALL 14 ADVANCED PAYROLL AUDIT SCENARIOS COMPLETED (100% PASS) ===
================================================================================
```

---

## 4. Final Sign-off & Production Readiness

1. **Architecture & Business Workflows**: Complete, compliant with Indian labor standards, and deeply integrated into existing modules.
2. **Security & Zero-Trust**: Strict object-level authorization, immutable snapshots, and comprehensive audit trails.
3. **Build & Quality Gates**: Clean TypeScript compilation and clean Next.js 15 production build.

**Final Release Gate**: **GO (APPROVED FOR PRODUCTION)**
