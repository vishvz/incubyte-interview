/**
 * Converts an amount in minor units between currencies via USD.
 * Rates are "1 unit of currency = rate USD". Rounds to the nearest minor unit.
 */
export function convertMinor(amountMinor: number, fromRateToUsd: number, toRateToUsd: number): number {
  return Math.round((amountMinor * fromRateToUsd) / toRateToUsd);
}
