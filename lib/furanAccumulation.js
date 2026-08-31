// Lifetime furan produced by the paper, as opposed to furan currently in the oil.
//
// Filtration and retrofill strip furan out of the oil, so the measured 2-FAL
// curve drops — but the paper degradation that produced it has not reversed.
// Reading only the measured curve makes a treated transformer look younger than
// it is, which is the dangerous direction to be wrong in.
//
// The model, stated the way an engineer would:
//
//   Furan accumulates in the oil, so within one fill the latest reading already
//   contains everything measured before it. That fill's contribution is
//   therefore its PEAK reading, not the sum of its readings.
//
//   A filtration or retrofill resets the oil to (near) zero. Everything measured
//   after it is new production, and stacks on top of what came before.
//
//   250 ppb, then filtered to 0, then 30 ppb at the next test  ->  280 ppb.
//
// The reset is driven by RECORDED maintenance, not by the shape of the curve.
// Treating every dip as a strip counts ordinary sample-to-sample variation
// (700 -> 650) as 650 ppb of fresh production and inflates the total badly.

/**
 * A reading of 0 is treated as "not measured" rather than "none detected".
 * mapOilTestsToChartData collapses a missing 2-FAL to 0, so the two cannot be
 * told apart here; and a genuine zero contributes nothing to a running total
 * anyway, so skipping it is harmless in the case where it is real.
 */
function measuredAt(point, key) {
  const value = point?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function measuredFuran(point) {
  return measuredAt(point, 'Furan');
}

function toSortedDates(removalDates) {
  return (Array.isArray(removalDates) ? removalDates : [])
    .map((date) => String(date ?? ''))
    .filter(Boolean)
    .sort();
}

/**
 * @param {Array} chartPoints rows from mapOilTestsToChartData, ascending by date
 * @param {Array<string>} removalDates ISO dates of events that strip furan from
 *   the oil (filtration, retrofill, top-up) — i.e. types whose `resets` include
 *   'Furan'. Without these the total simply never resets, which is correct for
 *   an asset that has never been treated.
 * @returns {Array} rows with `FuranTotal` (lifetime total, null before the first
 *   real reading) and `furanReset` (true on the first sample after a strip).
 */
export function accumulateFuran(chartPoints, removalDates = []) {
  return accumulateMarker(chartPoints, removalDates, {
    sourceKey: 'Furan',
    totalKey: 'FuranTotal',
    resetKey: 'furanReset',
  });
}

/**
 * The same accumulation for any by-product stripped by oil treatment.
 * Methanol needs identical handling: filtration removes it too, so a life
 * estimate built on the measured value would recover after every treatment.
 */
export function accumulateMarker(chartPoints, removalDates, { sourceKey, totalKey, resetKey }) {
  const points = Array.isArray(chartPoints) ? chartPoints : [];
  const resets = toSortedDates(removalDates);

  // Sum of peaks from fills that have already been stripped and replaced.
  let carried = 0;
  // Peak reading of the oil currently in the tank.
  let segmentPeak = 0;
  let seenAnyReading = false;
  let lastPointDate = '';

  return points.map((point) => {
    const iso = String(point?.isoDate ?? '');
    const value = measuredAt(point, sourceKey);

    // Close the segment if a strip happened since the previous sample.
    const stripped = resets.some((reset) => reset > lastPointDate && reset <= iso);
    if (stripped && seenAnyReading) {
      carried += segmentPeak;
      segmentPeak = 0;
    }
    if (iso) {
      lastPointDate = iso;
    }

    if (value === null) {
      return {
        ...point,
        [totalKey]: seenAnyReading ? carried + segmentPeak : null,
        [resetKey]: false,
      };
    }

    seenAnyReading = true;
    // Within one fill, the peak is the accumulated total: a lower later reading
    // is variation, not the paper un-ageing.
    segmentPeak = Math.max(segmentPeak, value);

    return { ...point, [totalKey]: carried + segmentPeak, [resetKey]: stripped };
  });
}

/**
 * Summary for the chart caption: lifetime total, what is in the oil right now,
 * and how much has been stripped out across the asset's life.
 */
export function summariseFuran(chartPoints, removalDates = []) {
  const rows = accumulateFuran(chartPoints, removalDates);
  const measured = rows.filter((row) => measuredFuran(row) !== null);

  if (!measured.length) {
    return { total: null, current: null, removed: null, resetCount: 0 };
  }

  const latest = measured[measured.length - 1];
  const total = latest.FuranTotal;
  const current = latest.Furan;

  return {
    total,
    current,
    removed: total === null || current === null ? null : Math.max(0, total - current),
    resetCount: rows.filter((row) => row.furanReset).length,
  };
}
