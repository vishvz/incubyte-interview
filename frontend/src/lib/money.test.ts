import { describe, expect, it } from 'vitest';
import { convertMinor, formatMinor, parseMajorToMinor } from './money';

describe('parseMajorToMinor', () => {
  it('parses decimals exactly, without float drift', () => {
    expect(parseMajorToMinor('85000.50')).toBe(8_500_050);
    expect(parseMajorToMinor('0.29')).toBe(29);
    expect(parseMajorToMinor('1234567.89')).toBe(123_456_789);
  });

  it('accepts thousands separators and surrounding spaces', () => {
    expect(parseMajorToMinor(' 85,000 ')).toBe(8_500_000);
    expect(parseMajorToMinor('85,000.5')).toBe(8_500_050);
  });

  it('rejects more than two decimals, signs, letters and empty input', () => {
    expect(parseMajorToMinor('1.005')).toBeNull();
    expect(parseMajorToMinor('-100')).toBeNull();
    expect(parseMajorToMinor('abc')).toBeNull();
    expect(parseMajorToMinor('')).toBeNull();
    expect(parseMajorToMinor('1e5')).toBeNull();
  });
});

describe('formatMinor', () => {
  it('formats minor units in the currency', () => {
    expect(formatMinor(8_500_050, 'USD')).toBe('$85,000.50');
  });

  it('can drop the cents for compact tables', () => {
    expect(formatMinor(8_500_050, 'USD', { cents: false })).toBe('$85,001');
  });
});

describe('convertMinor', () => {
  it('converts through USD and rounds to the nearest minor unit', () => {
    expect(convertMinor(100_000, 1.27, 1.08)).toBe(117_593);
  });
});
