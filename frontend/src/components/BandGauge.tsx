import type { Band, BandPosition } from '../api/types';

/**
 * One employee's salary against their pay band, drawn as a gauge with three zones
 * (below, within, above) and a labelled pin. Used on the profile, where there is room
 * for labels; table rows use the compact RangeBar instead.
 */
export function BandGauge({
  band,
  amountMinor,
  position,
  format,
}: {
  band: Band;
  amountMinor: number;
  position: BandPosition;
  format: (minor: number) => string;
}) {
  // Scale: band ±30% of its width, widened if the salary sits further out.
  const span = band.maxMinor - band.minMinor || band.maxMinor;
  const lo = Math.min(band.minMinor - span * 0.3, amountMinor - span * 0.1);
  const hi = Math.max(band.maxMinor + span * 0.3, amountMinor + span * 0.1);
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const min = pct(band.minMinor);
  const max = pct(band.maxMinor);

  return (
    <div
      className="gauge"
      role="img"
      aria-label={`Salary ${format(amountMinor)} is ${position} the band of ${format(band.minMinor)} to ${format(band.maxMinor)}`}
    >
      <div className="gauge__pin" data-position={position} style={{ left: `${pct(amountMinor)}%` }}>
        <span className="gauge__bubble num">{format(amountMinor)}</span>
        <span className="gauge__stem" />
      </div>
      <div
        className="gauge__track"
        style={{
          background: `linear-gradient(to right,
            var(--below-tint) 0 ${min}%,
            var(--band-strong) ${min}% ${max}%,
            var(--above-tint) ${max}% 100%)`,
        }}
      >
        <span className="gauge__mid" style={{ left: `${pct(band.midMinor)}%` }} />
      </div>
      <div className="gauge__ticks" aria-hidden="true">
        <span style={{ left: `${min}%` }}>
          <b>Min</b> {format(band.minMinor)}
        </span>
        <span style={{ left: `${pct(band.midMinor)}%` }}>
          <b>Mid</b> {format(band.midMinor)}
        </span>
        <span style={{ left: `${max}%` }}>
          <b>Max</b> {format(band.maxMinor)}
        </span>
      </div>
    </div>
  );
}
