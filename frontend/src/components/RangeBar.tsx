import type { Band, BandPosition } from '../api/types';

interface Props {
  /** Shared scale so rows can be compared; amounts in the same currency as everything else. */
  domain: [number, number];
  band?: Band | null;
  quartiles?: { p25Minor: number; medianMinor: number; p75Minor: number };
  marker?: { amountMinor: number; position?: BandPosition };
  /** Spoken summary for screen readers. */
  label: string;
  /** Optional value labels drawn under the bar, on the same scale. */
  ticks?: { value: number; text: string }[];
}

/**
 * The pay band range bar: band (light), P25-P75 box (green), median tick (ink),
 * and an optional employee marker coloured by band position.
 */
export function RangeBar({ domain, band, quartiles, marker, label, ticks }: Props) {
  const [lo, hi] = domain;
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo || 1)) * 100))}%`;
  const width = (a: number, b: number) => `calc(${pct(b)} - ${pct(a)})`;

  const bar = (
    <div className="range" role="img" aria-label={label} title={label}>
      <div className="range__track" />
      {band && (
        <>
          <div className="range__band" style={{ left: pct(band.minMinor), width: width(band.minMinor, band.maxMinor) }} />
          <div className="range__mid" style={{ left: pct(band.midMinor) }} />
        </>
      )}
      {quartiles && (
        <>
          <div
            className="range__box"
            style={{ left: pct(quartiles.p25Minor), width: width(quartiles.p25Minor, quartiles.p75Minor) }}
          />
          <div className="range__median" style={{ left: pct(quartiles.medianMinor) }} />
        </>
      )}
      {marker && (
        <div className="range__marker" data-position={marker.position} style={{ left: pct(marker.amountMinor) }} />
      )}
    </div>
  );
  if (!ticks) return bar;
  return (
    <div>
      {bar}
      <div className="range__ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.text} style={{ left: pct(t.value) }}>
            {t.text}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Pads a [min, max] domain on each side (5% by default) so marks do not sit on the edge. */
export function paddedDomain(values: number[], padding = 0.05): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * padding || max * padding;
  return [min - pad, max + pad];
}
