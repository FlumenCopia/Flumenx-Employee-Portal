/**
 * Salary Rounding Utilities
 * 
 * Rounding Rule:
 * - If last digits <= 50 (and > 0), round up to 50 (e.g., 14040 -> 14050, 14001 -> 14050)
 * - If last digits > 50, round up to 100 (e.g., 16874 -> 16900, 12355 -> 12400)
 * - Salaried amounts already ending in 00 or 50 remain unchanged (e.g., 14000 -> 14000, 14050 -> 14050)
 * - Non-positive values return 0
 * - Guarantees all final salaries strictly end in 50 or 00 (no arbitrary single digits like 12355)
 */

export interface SalaryRoundingDetails {
  unroundedNetSalary: number;
  roundedNetSalary: number;
  roundingAdjustment: number;
}

/**
 * Rounds an amount up to the nearest multiple of 50.
 * If 14040 -> 14050 (since last digits 40 <= 50, rounded up to 50)
 * If 16874 -> 16900 (since last digits 74 > 50, rounded up to 100)
 * If 12355 -> 12400 (since last digits 55 > 50, rounded up to 100)
 * If 14050 -> 14050 (already ends in 50)
 * If 14000 -> 14000 (already ends in 100s)
 */
export function roundFinalSalary(amount: number): number {
  if (!amount || amount <= 0) return 0;
  // Round to 2 decimal places first to avoid floating point precision quirks
  const normalized = Math.round(amount * 100) / 100;
  if (normalized <= 0) return 0;
  return Math.ceil(normalized / 50) * 50;
}

/**
 * Computes deterministic salary rounding breakdown including unrounded amount and adjustment.
 */
export function calculateSalaryRounding(rawNetSalary: number): SalaryRoundingDetails {
  const unroundedNetSalary = Math.max(0, Math.round((rawNetSalary || 0) * 100) / 100);
  const roundedNetSalary = roundFinalSalary(unroundedNetSalary);
  const roundingAdjustment = Math.max(0, Math.round((roundedNetSalary - unroundedNetSalary) * 100) / 100);

  return {
    unroundedNetSalary,
    roundedNetSalary,
    roundingAdjustment,
  };
}
