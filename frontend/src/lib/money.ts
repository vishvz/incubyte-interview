// Money is always an integer number of minor units (cents) plus a currency code.

/**
 * Parses what a person types ("85,000.50") into minor units (8500050) using string
 * arithmetic, so no float rounding can creep in. Returns null for anything invalid.
 */
export function parseMajorToMinor(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim().replace(/,/g, ''));
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMinor(amountMinor: number, currency: string, { cents = true } = {}): string {
  const key = `${currency}:${cents}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f.format(amountMinor / 100);
}

/** Converts between currencies via USD. Rates are "1 unit = rate USD". */
export function convertMinor(amountMinor: number, fromRateToUsd: number, toRateToUsd: number): number {
  return Math.round((amountMinor * fromRateToUsd) / toRateToUsd);
}
