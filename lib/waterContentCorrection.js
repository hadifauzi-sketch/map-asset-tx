// IEC 60422:2024 Annex C - Normalising water in oil for comparison and trending.
// Reference temperature is 20 C. The empirical normalisation factor is
//   f(Ts) = 2.24 * exp(-0.04 * Ts)
// where Ts is the sampling temperature in Celsius. The factor is only valid
// when Ts >= 35 C; below that the diffusion of water in the paper is too slow
// to assume equilibrium and the formula gives misleading results.
//
//   wn = wm * f(Ts)         measured at Ts -> normalized to 20 C
//   wm = wn / f(Ts)         normalized to 20 C -> measured at Ts
//
// IEC 60422 Table 5 limits are stated against the at-operating-temperature
// (measured) value, so any normalized lab result must be back-converted before
// it can be compared against the limits.

export const WATER_CONTENT_BASIS = Object.freeze({
  MEASURED: 'measured',
  NORMALIZED_20C: 'normalized_20c',
});

export const WATER_CONTENT_REFERENCE_TEMPERATURE_C = 20;
export const WATER_CONTENT_NORMALIZATION_MIN_TEMPERATURE_C = 35;

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function getWaterCorrectionFactor(samplingTemperatureC) {
  const Ts = toFiniteNumber(samplingTemperatureC);
  if (Ts === null) return null;
  return 2.24 * Math.exp(-0.04 * Ts);
}

export function isWaterCorrectionApplicable(samplingTemperatureC) {
  const Ts = toFiniteNumber(samplingTemperatureC);
  return Ts !== null && Ts >= WATER_CONTENT_NORMALIZATION_MIN_TEMPERATURE_C;
}

export function normaliseWaterContentTo20C(measuredPpm, samplingTemperatureC) {
  const wm = toFiniteNumber(measuredPpm);
  const f = getWaterCorrectionFactor(samplingTemperatureC);
  if (wm === null || f === null) return null;
  return wm * f;
}

export function denormaliseWaterContentToSamplingTemp(normalizedPpm, samplingTemperatureC) {
  const wn = toFiniteNumber(normalizedPpm);
  const f = getWaterCorrectionFactor(samplingTemperatureC);
  if (wn === null || f === null || f === 0) return null;
  return wn / f;
}

// Resolves the value to use against IEC 60422 Table 5 limits, which are stated
// at the at-operating-temperature basis. Returns the input unchanged if no
// basis/temperature info is present, or if the basis is already 'measured'.
export function resolveAtOperatingTempValue({ value, basis, samplingTemperatureC }) {
  const v = toFiniteNumber(value);
  if (v === null) return null;
  if (basis === WATER_CONTENT_BASIS.NORMALIZED_20C) {
    const back = denormaliseWaterContentToSamplingTemp(v, samplingTemperatureC);
    return back !== null ? back : v;
  }
  return v;
}

// Convenience for the modal: given the stored value/basis/temperature, return
// both the measured-at-Ts value and the normalised-at-20C value plus a flag
// indicating whether normalisation is reliable per Annex C (Ts >= 35 C).
export function describeWaterContent({ value, basis, samplingTemperatureC }) {
  const stored = toFiniteNumber(value);
  if (stored === null) {
    return {
      stored: null,
      basis: basis || WATER_CONTENT_BASIS.MEASURED,
      samplingTemperatureC: toFiniteNumber(samplingTemperatureC),
      measuredAtTs: null,
      normalizedAt20C: null,
      correctionApplicable: false,
      hasTemperature: toFiniteNumber(samplingTemperatureC) !== null,
    };
  }

  const Ts = toFiniteNumber(samplingTemperatureC);
  const applicable = isWaterCorrectionApplicable(Ts);
  const effectiveBasis = basis === WATER_CONTENT_BASIS.NORMALIZED_20C
    ? WATER_CONTENT_BASIS.NORMALIZED_20C
    : WATER_CONTENT_BASIS.MEASURED;

  let measuredAtTs = null;
  let normalizedAt20C = null;

  if (effectiveBasis === WATER_CONTENT_BASIS.MEASURED) {
    measuredAtTs = stored;
    normalizedAt20C = applicable ? normaliseWaterContentTo20C(stored, Ts) : null;
  } else {
    normalizedAt20C = stored;
    measuredAtTs = applicable ? denormaliseWaterContentToSamplingTemp(stored, Ts) : null;
  }

  return {
    stored,
    basis: effectiveBasis,
    samplingTemperatureC: Ts,
    measuredAtTs,
    normalizedAt20C,
    correctionApplicable: applicable,
    hasTemperature: Ts !== null,
  };
}
