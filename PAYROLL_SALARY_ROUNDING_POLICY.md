# Flumenx BOS — Payroll Final Salary Rounding Specification & Audit Policy

## 1. Executive Summary & Policy Objective
This document outlines the deterministic final net salary rounding policy implemented across the **Flumenx Business Operating System (BOS)** and Employee Portal.

In standard payroll disbursement, odd-digit net salaries (e.g., ₹12,355, ₹14,040, ₹16,874) introduce administrative friction in bank batch transfers and petty cash reconciliation. The Flumenx salary rounding policy enforces that **all final net salaries end strictly in ₹50 or ₹100s (00)** by rounding up to the nearest multiple of 50.

---

## 2. Rounding Mathematical Definition
Given the pre-round net salary $S_{\text{raw}} = \text{Total Earnings} - \text{Total Deductions}$:

$$
S_{\text{final}} = \begin{cases}
0 & \text{if } S_{\text{raw}} \le 0 \\
\lceil S_{\text{raw}} / 50 \rceil \times 50 & \text{if } S_{\text{raw}} > 0
\end{cases}
$$

The rounding adjustment (employer-borne round-off addition) is calculated as:
$$
\Delta_{\text{round}} = S_{\text{final}} - S_{\text{raw}}
$$

### Rule Breakdown:
1. **If remainder modulo 100 is between 1 and 50 ($0 < S_{\text{raw}} \pmod{100} \le 50$):**
   - Rounds UP to **50**.
   - *Example:* ₹14,040 $\rightarrow$ **₹14,050** ($\Delta = +₹10$).
   - *Example:* ₹14,001 $\rightarrow$ **₹14,050** ($\Delta = +₹49$).
2. **If remainder modulo 100 is greater than 50 ($50 < S_{\text{raw}} \pmod{100} < 100$):**
   - Rounds UP to the next **100**.
   - *Example:* ₹16,874 $\rightarrow$ **₹16,900** ($\Delta = +₹26$).
   - *Example:* ₹12,355 $\rightarrow$ **₹12,400** ($\Delta = +₹45$).
3. **If remainder modulo 100 is 0 or 50:**
   - Already rounded; stays unchanged.
   - *Example:* ₹14,050 $\rightarrow$ **₹14,050** ($\Delta = ₹0$).
   - *Example:* ₹14,000 $\rightarrow$ **₹14,000** ($\Delta = ₹0$).
4. **Zero or Negative Net Salary:**
   - Employees with 0 payable days or negative net pay remain at **₹0** (no rounding applied to zero).

---

## 3. Test Cases & Example Conversion Table

| Unrounded Net Salary ($S_{\text{raw}}$) | Last 2 Digits | Condition | Final Rounded Salary ($S_{\text{final}}$) | Rounding Adjustment ($\Delta$) | Resulting Digits |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **₹14,040.00** | 40 | $\le 50$ | **₹14,050.00** | +₹10.00 | Ends in `50` |
| **₹16,874.00** | 74 | $> 50$ | **₹16,900.00** | +₹26.00 | Ends in `00` |
| **₹12,355.00** | 55 | $> 50$ | **₹12,400.00** | +₹45.00 | Ends in `00` |
| **₹14,050.00** | 50 | $= 50$ | **₹14,050.00** | ₹0.00 | Ends in `50` |
| **₹14,000.00** | 00 | $= 00$ | **₹14,000.00** | ₹0.00 | Ends in `00` |
| **₹14,001.00** | 01 | $\le 50$ | **₹14,050.00** | +₹49.00 | Ends in `50` |
| **₹14,051.00** | 51 | $> 50$ | **₹14,100.00** | +₹49.00 | Ends in `00` |
| **₹14,040.40** | 40.4 | $\le 50$ | **₹14,050.00** | +₹9.60 | Ends in `50` |
| **₹0.00** | 00 | Zero | **₹0.00** | ₹0.00 | Ends in `00` |

---

## 4. Accounting & Double-Entry Bookkeeping Treatment
To maintain accounting integrity and satisfy the double-entry invariant ($\sum \text{Debits} \equiv \sum \text{Credits}$):
- **Debits (Expense)**:
  - Account `5210` (Salaries & Wages): Debited with $(\text{Gross Base} - \text{LOP Deductions}) + \Delta_{\text{round}}$
  - Accounts `5220` & `5225` (Employer PF & ESI contributions)
- **Credits (Liabilities)**:
  - Account `2120` (Payroll Payable / Net Salaries): Credited with $S_{\text{final}}$
  - Accounts `2130`, `2135`, `2140`, `2145` (PF, ESI, PT, TDS payables)
- **Result**: Perfect zero-variance balance across the accrual journal entry (`postPayrollAccrualJournal`).

---

## 5. Export Excel (CSV) Column Specifications
All Excel exports now explicitly include:
1. **Unrounded Net Salary**: The raw mathematical net pay before rounding.
2. **Rounding Adjustment**: The differential added to round up to the nearest ₹50/₹100.
3. **Final Net Salary (Rounded)**: The actual net payable salary disbursed to the employee.

### Export Endpoints & Files:
- **Backend CSV Export**: `GET /api/payroll/export/csv/?month=M&year=Y`
- **Frontend Detailed Salary Process Report**: Downloadable from `/salary-slips` modal as `Salary_Process_Report_<Month>_<Year>.csv`
- **Enterprise Reports Center**: `GET /api/reports/?type=payroll&format=csv`
