/**
 * Date utilities for handling date-only values stored as TIMESTAMPTZ.
 *
 * The core problem: HTML date inputs give "YYYY-MM-DD" (local date).
 * `new Date("2026-02-26")` parses as midnight UTC, which in Denver (UTC-7)
 * displays as Feb 25 at 5pm — wrong day.
 *
 * Solution: store date-only values at noon UTC so any timezone from
 * UTC-12 to UTC+12 resolves to the correct calendar date.
 */

/**
 * Convert a date-only string (YYYY-MM-DD) to noon UTC ISO string.
 * Use this when saving date-only values (due_at, snoozed_until).
 */
export function toNoonUTC(dateStr: string): string {
  return `${dateStr}T12:00:00.000Z`;
}

/**
 * Extract the YYYY-MM-DD date portion from a stored date value.
 * Uses UTC to avoid timezone shift — works correctly with noon UTC storage.
 */
export function toDateInputValue(dateValue: string | Date): string {
  const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return d.toISOString().split("T")[0];
}

/**
 * Format a stored date value for display (e.g. "2/26/2026").
 * Uses UTC timezone so the displayed date matches the intended calendar date.
 */
export function formatDateDisplay(dateValue: string | Date): string {
  const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return d.toLocaleDateString("en-US", { timeZone: "UTC" });
}

/**
 * Check if a due date is in the past (overdue).
 * Compares calendar dates in the user's local timezone.
 */
export function isDateOverdue(dueAt: string | Date): boolean {
  const dueStr = toDateInputValue(dueAt); // YYYY-MM-DD in UTC
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dueStr < todayStr;
}
