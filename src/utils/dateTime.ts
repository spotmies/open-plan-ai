/**
 * Timezone-aware date formatting using the native Intl API.
 * No extra packages needed — works with any IANA timezone string.
 */

function toDate(date: Date | string): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

function safeFormat(date: Date, options: Intl.DateTimeFormatOptions, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
}

/** Format as "3:42 PM" in the given timezone */
export function formatTimeInTimezone(date: Date | string, timezone: string): string {
  return safeFormat(toDate(date), { hour: 'numeric', minute: '2-digit', hour12: true }, timezone);
}

/** Format as "May 20, 2026" in the given timezone */
export function formatDateInTimezone(date: Date | string, timezone: string): string {
  return safeFormat(toDate(date), { month: 'short', day: 'numeric', year: 'numeric' }, timezone);
}

/** Returns the YYYY-MM-DD string for a date in a given timezone (for day comparison) */
function toLocalDateString(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(date);
  }
}

/** Format like Teams: "3:42 PM" for today, "Jun 24, 3:42 PM" for other days */
export function formatMessageTimestamp(date: Date | string, timezone: string): string {
  const d = toDate(date);
  const time = safeFormat(d, { hour: 'numeric', minute: '2-digit', hour12: true }, timezone);
  if (toLocalDateString(d, timezone) === toLocalDateString(new Date(), timezone)) {
    return time;
  }
  const datePart = safeFormat(d, { month: 'short', day: 'numeric' }, timezone);
  return `${datePart}, ${time}`;
}

export function isTodayInTimezone(date: Date | string, timezone: string): boolean {
  const d = toDate(date);
  return toLocalDateString(d, timezone) === toLocalDateString(new Date(), timezone);
}

export function isYesterdayInTimezone(date: Date | string, timezone: string): boolean {
  const d = toDate(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return toLocalDateString(d, timezone) === toLocalDateString(yesterday, timezone);
}
