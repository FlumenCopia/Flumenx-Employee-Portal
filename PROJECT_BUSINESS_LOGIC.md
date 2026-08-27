# Project Business Logic & Rules Discovery

This document details all business rules, mathematical formulas, status transition algorithms, and potential business logic issues discovered during the audit.

---

## 1. Work Synchronization & Quantity Calculation Engine

**Location**: [`backend/src/services/workSyncEngine.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/services/workSyncEngine.ts)

### Status Weight Matrix (`STATUS_WEIGHT_MAP`)
Work progress and completed quantities are calculated dynamically based on status weights:

| Status | Weight | Meaning |
|---|---|---|
| `Backlog` | `0.00` | Unscheduled |
| `Assigned` | `0.00` | Assigned to employee |
| `Pending` | `0.00` | Awaiting action |
| `In Progress` | `0.25` | Active development |
| `Ongoing` | `0.25` | Active development |
| `In Review` | `0.50` | Submitted for internal review |
| `Changes Requested` | `0.50` | Feedback provided |
| `Rejected` | `0.00` | Rejected work |
| `Approved` | `0.75` | Reviewer approved |
| `Completed` | `1.00` | Fully finished |
| `Published` | `1.00` | Client delivered / Published |
| `Blocked` | `0.00` | Blocked by dependencies |

### Quantity & Progress Formulas
1. **Single Task Progress**:
   - `completedQuantity = round(weight * assignedQuantity)`
   - `progress = round(weight * 100)` (bounded between 0% and 100%)
2. **Deliverables Aggregation (`syncFromDeliverables`)**:
   - When a task has N deliverables: `assignedQuantity = N`, `unit = 'items'`
   - `sumDelivCompleted = ∑ STATUS_WEIGHT_MAP[deliverable.status]`
   - `effectiveCompleted = max(0, min(assigned, max(sumDelivCompleted, parentCompleted)))`
   - `progress = round((effectiveCompleted / assigned) * 100)`
3. **Parent Task Cascading (`syncParentTaskProgression`)**:
   - Sums `completedQuantity` across all child tasks where `parentTask === parentId`
   - Updates `parentTask.completedQuantity` and `parentTask.progress`
   - If `parentTask.completedQuantity >= parentTask.assignedQuantity`, marks parent task `Completed`

---

## 2. Attendance Engine & Geofencing Logic

**Location**: [`backend/src/services/attendanceEngine.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/services/attendanceEngine.ts)

### Haversine Spherical Distance Formula
Calculates distance in meters between user GPS check-in coordinates and Office GPS coordinates:

$$\Delta\text{lat} = \frac{(\text{lat}_2 - \text{lat}_1) \cdot \pi}{180}, \quad \Delta\text{lon} = \frac{(\text{lon}_2 - \text{lon}_1) \cdot \pi}{180}$$
$$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos\left(\frac{\text{lat}_1 \cdot \pi}{180}\right) \cdot \cos\left(\frac{\text{lat}_2 \cdot \pi}{180}\right) \cdot \sin^2\left(\frac{\Delta\text{lon}}{2}\right)$$
$$c = 2 \cdot \text{atan2}(\sqrt{a}, \sqrt{1-a})$$
$$\text{distanceMeters} = \text{round}(6371000 \cdot c)$$

`locationVerified` is set to `true` if `distanceMeters <= policy.allowedRadiusMeters` (Default: 200m).

### Attendance Status Determination
- **Office Start Time**: Default `09:30`
- **Grace Period**: Default `5 minutes` (Grace cutoff = `09:35`)
- **Office End Time**: Default `18:30`
- **Early Checkout Cutoff**: Default `18:00`
- **Check-in Logic**:
  - Check-in time < `09:30` -> Check-in Status: `On Time`
  - Check-in time `09:30` - `09:35` -> Check-in Status: `Grace Period`
  - Check-in time > `09:35` -> Check-in Status: `Late` (calculates `lateMinutes`)
- **Status Assignment**:
  - `workingHours < policy.halfDayHours` (4 hrs) OR check-in late OR checkout before 18:00 -> `Half Day`
  - Early checkout only -> `Present (Early Exit)`
  - On-time full day -> `Present`

---

## 3. KPI 4-Factor Performance Scoring Formula

**Location**: [`backend/src/services/kpiEngine.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/services/kpiEngine.ts)

Overall Monthly KPI Score (Max 10.0 points) is evaluated across 4 distinct factors:

$$\text{Total KPI Score} = \text{AttendanceScore} + \text{OnTimeScore} + \text{ReviewQualityScore} + \text{ManualRatingScore}$$

### Factor Breakdown
1. **Factor 1: Attendance Score (Max 2.0 pts)**
   - `effectivePresent = presentCount + (halfDayCount * 0.5)`
   - `eligibleAttDays = totalAttRecords - leaveCount`
   - `attRatio = effectivePresent / eligibleAttDays`
   - `AttendanceScore = round(attRatio * 2.0)`

2. **Factor 2: On-Time Delivery Score (Max 3.0 pts)**
   - `onTimeRatio = onTimeCompletedTasks / totalDueTasks`
   - Task is on time if `completedAt <= dueDate`
   - `OnTimeScore = round(onTimeRatio * 3.0)`

3. **Factor 3: Work Review Quality Score (Max 3.0 pts)**
   - `reviewQualityRatio = approvedTasks / completedTasks`
   - Task is approved if `reviewStatus === 'OK'` or `reviewStatus === 'PENDING_REVIEW'`
   - `ReviewQualityScore = round(reviewQualityRatio * 3.0)`

4. **Factor 4: Manager Rating Score (Max 2.0 pts)**
   - Manager assigns manual rating scale: `1.0` to `5.0` (Default: `5.0`)
   - `ManualRatingScore = round(((rating - 1.0) / 4.0) * 2.0)`

### KPI Performance Grade Table
- `≥ 9.5`: **Outstanding**
- `≥ 8.5`: **Excellent**
- `≥ 7.5`: **Good**
- `≥ 6.0`: **Needs Improvement**
- `< 6.0`: **Critical**

---

## 4. Potential Issues — DO NOT FIX

The following potential issues were discovered during codebase analysis. Per strict instructions, **NONE HAVE BEEN MODIFIED**.

### Issue 1: Discrepancy in Default Role Module Permissions Between Middleware and Navigation
- **Evidence**: [`backend/src/middleware/rbac.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/middleware/rbac.ts#L60-L65) defines default role permissions as `HR`: `['employees', 'attendance', 'leaves', 'salary_slips', 'meetings', 'announcements']`. However, [`backend/src/controllers/portalController.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/controllers/portalController.ts#L374-L380) defines `HR`: `['TASKS', 'EMPLOYEES', 'ATTENDANCE', 'LEAVES', 'MEETINGS', 'KPI', 'SALARY_SLIPS', 'ANNOUNCEMENTS']`.
- **File**: `backend/src/middleware/rbac.ts` vs `backend/src/controllers/portalController.ts`
- **Why it may be a problem**: Middleware uses lowercase module names (`employees`, `leaves`) while PortalPage database uses uppercase module codes (`EMPLOYEES`, `LEAVES`, `TASKS`). This could lead to a permission check mismatch if a user relies purely on fallback role permissions without an attached `DynamicRole`.
- **Affected areas**: Authorization checks for users without dynamic roles.
- **Confidence**: HIGH CONFIDENCE

### Issue 2: Duplicate Index Warning Declarations on Mongoose Schemas
- **Evidence**: [`backend/src/models/Client.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/models/Client.ts#L10) has `index: true` on `legacyId` property while also defining `unique: true`. Similarly, [`backend/src/models/DynamicRole.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/models/DynamicRole.ts#L36) defines `index: true` alongside `unique: true`.
- **File**: `backend/src/models/Client.ts`, `backend/src/models/DynamicRole.ts`
- **Why it may be a problem**: In Mongoose, setting `unique: true` automatically creates a unique index. Adding `index: true` on the same field produces duplicate index creation warnings during Mongoose server initialization.
- **Affected areas**: MongoDB log noise upon application start.
- **Confidence**: CONFIRMED

### Issue 3: Mid-Month Joining Date Handling in KPI Calculation
- **Evidence**: [`backend/src/services/kpiEngine.ts`](file:///d:/flumenx/Flumenx-Employee-Portal/backend/src/services/kpiEngine.ts#L50-L76) returns "Not Evaluated" if the target month end date is before the joining date. However, if an employee joins mid-month (e.g. 15th of the month), `totalAttRecords` in Factor 1 only contains records from the 15th onwards, but `eligibleAttDays` may calculate `attRatio` against available attendance records.
- **File**: `backend/src/services/kpiEngine.ts`
- **Why it may be a problem**: Mid-month hires might receive 100% attendance score if they attend 100% of their 15 active days, which is mathematically correct for active days but could differ from full-month quota expectations.
- **Affected areas**: KPI scoring for new hires in their first month.
- **Confidence**: POSSIBLE
