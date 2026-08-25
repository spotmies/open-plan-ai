import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// E.164-ish: optional leading "+", 7-15 digits total, no leading 0.
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

export function isValidPhoneNumber(value: string): boolean {
  return PHONE_REGEX.test(value);
}

export function sanitizePhoneInput(value: string): string {
  const hasPlus = value.trimStart().startsWith("+");
  const digits = value.replace(/\D/g, "");
  return (hasPlus ? "+" : "") + digits;
}

/**
 * Human-readable display ID for a task/issue, e.g. "RVC-T-42" / "RVC-I-7".
 * Returns null when either half is unavailable (e.g. a personal task with no
 * project, or a project whose code hasn't loaded yet) so callers can skip
 * rendering rather than show a broken "undefined-T-undefined" label.
 */
export function getDisplayId(
  projectCode: string | null | undefined,
  kind: "T" | "I",
  number: number | null | undefined,
): string | null {
  if (!projectCode || number == null) return null;
  return `${projectCode}-${kind}-${number}`;
}
