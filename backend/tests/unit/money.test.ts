import { describe, expect, it } from 'vitest';
import { convertMinor } from '../../src/lib/money.js';

describe('convertMinor', () => {
  it('converts GBP to USD', () => {
    expect(convertMinor(100_000, 1.27, 1)).toBe(127_000);
  });

  it('rounds INR to USD to the nearest cent', () => {
    // 1,234,567.89 INR * 0.012 = 14,814.81468 USD
    expect(convertMinor(123_456_789, 0.012, 1)).toBe(1_481_481);
  });

  it('converts GBP to EUR through USD', () => {
    // 1,000.00 GBP = 1,270.00 USD = 1,175.93 EUR
    expect(convertMinor(100_000, 1.27, 1.08)).toBe(117_593);
  });

  it('returns the same amount for the same currency', () => {
    expect(convertMinor(123_45, 1.08, 1.08)).toBe(123_45);
  });
});
