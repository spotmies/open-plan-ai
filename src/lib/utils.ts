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
