import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/lib/random.js';

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces a different sequence for a different seed', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('returns values in [0, 1)', () => {
    const next = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const v = next();
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
});
