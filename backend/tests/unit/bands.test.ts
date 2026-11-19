import { describe, expect, it } from 'vitest';
import { classifyBand } from '../../src/lib/bands.js';

const band = { minMinor: 8_000_000, maxMinor: 12_000_000 };

describe('classifyBand', () => {
  it('counts the band edges as within', () => {
    expect(classifyBand(8_000_000, band)).toBe('within');
    expect(classifyBand(12_000_000, band)).toBe('within');
  });

  it('flags amounts below the minimum', () => {
    expect(classifyBand(7_999_999, band)).toBe('below');
  });

  it('flags amounts above the maximum', () => {
    expect(classifyBand(12_000_001, band)).toBe('above');
  });
});
