import React from 'react';

export const formatRupees = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

/*
 * Dual-handle price slider built from two overlapping native range inputs,
 * so it stays keyboard and screen-reader accessible.
 */
const PriceRangeSlider = ({ min, max, step = 1, value, onChange }) => {
  const [low, high] = value;
  const span = Math.max(max - min, 1);
  const lowPct = ((low - min) / span) * 100;
  const highPct = ((high - min) / span) * 100;

  const setLow = (next) => onChange([Math.min(Number(next), high), high]);
  const setHigh = (next) => onChange([low, Math.max(Number(next), low)]);

  // When both handles sit at the top end, keep the low handle on top so it can be dragged back
  const lowOnTop = low >= max - span * 0.05;

  return (
    <div className="price-slider">
      <div className="price-slider-values" aria-hidden="true">
        <span>{formatRupees(low)}</span>
        <span className="price-slider-dash">–</span>
        <span>{formatRupees(high)}</span>
      </div>
      <div className="price-slider-control">
        <div className="price-slider-track" />
        <div className="price-slider-range" style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }} />
        <input
          type="range"
          className="price-slider-input"
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(e) => setLow(e.target.value)}
          aria-label="Minimum price"
          aria-valuetext={formatRupees(low)}
          style={{ zIndex: lowOnTop ? 4 : 3 }}
        />
        <input
          type="range"
          className="price-slider-input"
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(e) => setHigh(e.target.value)}
          aria-label="Maximum price"
          aria-valuetext={formatRupees(high)}
          style={{ zIndex: lowOnTop ? 3 : 4 }}
        />
      </div>
      <div className="price-slider-bounds" aria-hidden="true">
        <span>{formatRupees(min)}</span>
        <span>{formatRupees(max)}</span>
      </div>
    </div>
  );
};

export default PriceRangeSlider;
