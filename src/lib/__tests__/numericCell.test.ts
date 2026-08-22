import { describe, it, expect } from 'vitest';
import { parseNumericCell } from '@/lib/numericCell';

// Kept in step with the backend's shared/utils/__tests__/numericCell.util.test.ts
// — the same sheet reaches the BOM through either parser.
describe('parseNumericCell', () => {
  it('passes genuine numbers through', () => {
    expect(parseNumericCell(314.65)).toBe(314.65);
    expect(parseNumericCell(0)).toBe(0);
    expect(parseNumericCell(-12.5)).toBe(-12.5);
  });

  it('strips currency symbols and codes', () => {
    expect(parseNumericCell('₹314.65')).toBe(314.65);
    expect(parseNumericCell('₹ 314.65')).toBe(314.65);
    expect(parseNumericCell('$12.80')).toBe(12.8);
    expect(parseNumericCell('INR 245.00')).toBe(245);
    expect(parseNumericCell('12.80 USD')).toBe(12.8);
  });

  // Number('1,234.56') is NaN, which this file's callers turned into
  // "Unit Price must be a number"; parseFloat would have returned 1.
  it('reads thousands separators instead of rejecting or truncating', () => {
    expect(parseNumericCell('1,234.56')).toBe(1234.56);
    expect(parseNumericCell('1,234')).toBe(1234);
    expect(parseNumericCell('₹1,23,456.78')).toBe(123456.78); // Indian grouping
  });

  it('reads a comma decimal separator', () => {
    expect(parseNumericCell('0,5')).toBe(0.5);
    expect(parseNumericCell('1.234,56')).toBe(1234.56);
  });

  it('reads accounting-style negatives', () => {
    expect(parseNumericCell('(12.34)')).toBe(-12.34);
    expect(parseNumericCell('₹(1,234.56)')).toBe(-1234.56);
  });

  it('returns null for anything that is not a usable number', () => {
    expect(parseNumericCell('')).toBeNull();
    expect(parseNumericCell('—')).toBeNull();
    expect(parseNumericCell('-')).toBeNull();
    expect(parseNumericCell('N/A')).toBeNull();
    expect(parseNumericCell('₹')).toBeNull();
    expect(parseNumericCell(null)).toBeNull();
    expect(parseNumericCell(NaN)).toBeNull();
  });
});
