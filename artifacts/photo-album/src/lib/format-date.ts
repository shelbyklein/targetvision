import { format, isValid, parseISO } from "date-fns";

type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null || input === "") return null;
  // Date-only strings (e.g. "2026-01-04") are parsed as local midnight by
  // parseISO, which avoids the UTC day-shift that `new Date("2026-01-04")` causes.
  const date = typeof input === "string" ? parseISO(input) : new Date(input);
  return isValid(date) ? date : null;
}

/**
 * Formats a date for display as "Jan 04, 2026" (short month, zero-padded day,
 * full year). Returns an empty string for null/empty/invalid input.
 */
export function formatDate(input: DateInput): string {
  const date = toDate(input);
  return date ? format(date, "MMM dd, yyyy") : "";
}

/**
 * Formats a date and time for display as "Jan 04, 2026, 3:45 PM". Returns an
 * empty string for null/empty/invalid input.
 */
export function formatDateTime(input: DateInput): string {
  const date = toDate(input);
  return date ? format(date, "MMM dd, yyyy, h:mm a") : "";
}
