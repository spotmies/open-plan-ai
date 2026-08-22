/**
 * Parsing for a spreadsheet cell that is supposed to hold a number.
 *
 * BOM sheets routinely carry prices as text — "₹314.65", "$12.80",
 * "1,234.56", "1,23,456.78" — because the column was formatted as currency,
 * pasted in, or round-tripped through a CSV export. `Number('₹314.65')` is
 * NaN, so those rows were rejected as "Unit Price must be a number"; and
 * `parseFloat('1,234.56')` is worse — it returns 1, silently off by three
 * orders of magnitude.
 *
 * Returns null for anything that isn't a usable number, so a caller can tell
 * "no value" apart from "zero".
 *
 * Mirrors the backend's shared/utils/numericCell.util.ts — the two must agree,
 * since the same sheet can arrive either through a file import (this one) or
 * the Google Sheets sync (that one). Keep them in step.
 */

// Everything that isn't a digit, a separator, a sign, or a paren — currency
// symbols (₹ $ € £ ¥), currency codes (INR, USD), stray spaces including the
// non-breaking and narrow-no-break ones spreadsheets emit in some locales.
const NOISE = /[^\d.,\-+()]/g;

export function parseNumericCell(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;

  let s = String(raw).trim();
  if (s === '') return null;

  // Strip the noise first so a symbol outside the parens — "₹(1,234.56)" —
  // doesn't hide the accounting-negative form below.
  s = s.replace(NOISE, '');
  if (s === '') return null;

  // Accounting-style negatives: (12.34) means -12.34.
  let negative = s.startsWith('-');
  const parenthesised = /^\((.*)\)$/.exec(s);
  if (parenthesised) {
    negative = true;
    s = parenthesised[1];
  }

  s = s.replace(/[-+()]/g, '');
  // A lone sign or bracket with no digits behind it is not a number — without
  // this, Number('') would hand back 0.
  if (!/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: whichever comes last is the decimal separator, the other
    // is grouping. Covers "1,234.56", "1.234,56" and Indian "1,23,456.78".
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // Only commas. Grouping when every run after a comma is exactly three
    // digits ("1,234", "1,234,567"); otherwise it's a decimal ("0,5").
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot >= 0 && s.indexOf('.') !== lastDot) {
    // Several dots can only be grouping ("1.234.567").
    s = s.replace(/\./g, '');
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}
