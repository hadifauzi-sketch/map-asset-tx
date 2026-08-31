// Estimated paper condition, expressed as remaining life.
//
// Degree of polymerisation (DP) is the accepted measure of cellulose ageing:
// ~1000 for new paper, ~200 at end of life. DP cannot be measured without a
// paper sample, so it is inferred from degradation by-products in the oil.
//
// The correlations here were previously inline in components/OilTestSection.jsx.
// They are shared now so the Maintenance chart and the oil test table can never
// disagree about the same transformer's condition.

export const DP_NEW_PAPER = 1000;
export const DP_END_OF_LIFE = 200;

/** ppb per ppm — the app stores and displays 2-FAL in ppb throughout. */
const PPB_PER_PPM = 1000;

/**
 * Dong et al. correlation: DP = 402.47 − 220.87·log₁₀(2FAL in ppm).
 *
 * Takes 2-FAL in **ppb**, the unit the whole app stores and labels it in, and
 * converts before applying the correlation. Feeding the ppb figure straight in
 * makes the expression cross zero at 2-FAL ≈ 66 ppb, so every realistic reading
 * (hundreds to thousands of ppb) returned null and the furan-based DP silently
 * produced nothing.
 */
export function calculateDpFromFuran(fal2Ppb) {
  const val = parseFloat(fal2Ppb);
  if (!val || val <= 0) return null;
  const dp = 402.47 - 220.87 * Math.log10(val / PPB_PER_PPM);
  return dp > 0 ? Math.round(dp) : null;
}

/** Jalbert et al. correlation: log₁₀(CH₃OH) = −0.00283·DP + 3.837 */
export function calculateDpFromMethanol(methanol) {
  const val = parseFloat(methanol);
  if (!val || val <= 0) return null;
  const dp = (3.837 - Math.log10(val)) / 0.00283;
  return dp > 0 ? Math.round(dp) : null;
}

/**
 * Life already consumed, 0% at DP 1000 down to 100% at DP 200.
 * Matches calcLifeUsed() in OilTestSection, which drives the "Life" chip.
 */
export function lifeUsedPercent(dp) {
  const value = parseFloat(dp);
  if (!value || value <= 0) return null;
  const pct = Math.round(((DP_NEW_PAPER - value) / (DP_NEW_PAPER - DP_END_OF_LIFE)) * 100);
  return Math.min(100, Math.max(0, pct));
}

/** The complement: 100% for new paper, falling towards 0% at end of life. */
export function remainingLifePercent(dp) {
  const used = lifeUsedPercent(dp);
  return used === null ? null : 100 - used;
}

/**
 * Remaining-life series for the trending charts.
 *
 * Takes the CUMULATIVE by-product totals rather than the measured values. A
 * filtration strips furan and methanol out of the oil, so a life figure derived
 * from the measured value climbs back up after every treatment — reporting that
 * the paper got younger. Feeding it the lifetime total instead keeps the curve
 * monotonic, which is the whole point of tracking paper ageing.
 *
 * @param {Array} rows chart rows already carrying `FuranTotal` / `MethanolTotal`
 * @returns {Array} rows with `LifeFromFuran` and `LifeFromMethanol` (percent
 *   remaining, or null where the by-product was never measured)
 */
export function buildPaperLifeSeries(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const dpFuran = calculateDpFromFuran(row?.FuranTotal);
    const dpMethanol = calculateDpFromMethanol(row?.MethanolTotal);

    return {
      ...row,
      DpFuranTotal: dpFuran,
      DpMethanolTotal: dpMethanol,
      LifeFromFuran: remainingLifePercent(dpFuran),
      LifeFromMethanol: remainingLifePercent(dpMethanol),
    };
  });
}

/** Worst-case remaining life across the available markers, for the caption. */
export function lowestRemainingLife(rows) {
  const values = (Array.isArray(rows) ? rows : [])
    .flatMap((row) => [row?.LifeFromFuran, row?.LifeFromMethanol])
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  return values.length ? Math.min(...values) : null;
}
