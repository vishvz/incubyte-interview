export type BandPosition = 'below' | 'within' | 'above';

/** Band edges count as within the band. */
export function classifyBand(amountMinor: number, band: { minMinor: number; maxMinor: number }): BandPosition {
  if (amountMinor < band.minMinor) return 'below';
  if (amountMinor > band.maxMinor) return 'above';
  return 'within';
}
