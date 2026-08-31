// Before/after comparison for a maintenance event.
//
// A marker on a chart says when something happened; this says whether it
// worked. For each event it pairs the last sample before it with the first
// sample after it, which is the only honest comparison available — anything
// earlier or later has other changes mixed in.

/**
 * The measures a maintenance job is judged on, and which direction is good.
 * `betterWhen` matters: a rise in BDV is a success, a rise in moisture is not,
 * so the same delta has to be coloured differently.
 */
export const IMPACT_MEASURES = [
  { key: 'TDCG', label: 'TDCG', unit: 'ppm', betterWhen: 'lower' },
  { key: 'BDV', label: 'BDV', unit: 'kV', betterWhen: 'higher' },
  { key: 'Moisture', label: 'Moisture', unit: 'ppm', betterWhen: 'lower' },
  { key: 'Furan', label: '2-FAL', unit: 'ppb', betterWhen: 'lower' },
];

function readingAt(point, key) {
  const value = point?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Compare the samples either side of one event.
 *
 * @returns {{ before, after, measures }} `before`/`after` are chart rows or
 *   null. A measure is only reported when both sides have a reading, since a
 *   delta against a missing value would be invented rather than measured.
 */
export function compareAcrossEvent(eventDate, chartPoints, measures = IMPACT_MEASURES) {
  const points = Array.isArray(chartPoints) ? chartPoints : [];
  const date = String(eventDate ?? '');

  if (!date || !points.length) {
    return { before: null, after: null, measures: [] };
  }

  let before = null;
  let after = null;

  points.forEach((point) => {
    const iso = String(point.isoDate);
    if (iso < date) {
      // Points are ascending, so the last one to pass is the closest before.
      before = point;
    } else if (!after) {
      after = point;
    }
  });

  const compared = measures
    .map((measure) => {
      const from = readingAt(before, measure.key);
      const to = readingAt(after, measure.key);

      if (from === null || to === null) {
        return null;
      }

      const delta = to - from;
      const improved =
        delta === 0 ? null : measure.betterWhen === 'higher' ? delta > 0 : delta < 0;

      return {
        ...measure,
        from,
        to,
        delta,
        improved,
        // Guard against a zero baseline: percent change off 0 is meaningless.
        percent: from === 0 ? null : (delta / Math.abs(from)) * 100,
      };
    })
    .filter(Boolean);

  return { before, after, measures: compared };
}

/**
 * Impact rows for every event that has a sample on both sides of it.
 * Events with nothing to compare are returned separately so the UI can explain
 * the gap rather than silently dropping them.
 */
export function summariseInterventionImpact(interventions, chartPoints, measures = IMPACT_MEASURES) {
  const events = (Array.isArray(interventions) ? interventions : [])
    .filter((event) => event?.eventDate)
    .slice()
    .sort((left, right) => String(right.eventDate).localeCompare(String(left.eventDate)));

  const compared = [];
  const uncomparable = [];

  events.forEach((event) => {
    const result = compareAcrossEvent(event.eventDate, chartPoints, measures);

    if (!result.before || !result.after) {
      uncomparable.push({
        event,
        reason: !result.before
          ? 'No sample before this date to compare against.'
          : 'No sample taken since this work.',
      });
      return;
    }

    compared.push({ event, ...result });
  });

  return { compared, uncomparable };
}
