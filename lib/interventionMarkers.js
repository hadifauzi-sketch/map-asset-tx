import { getInterventionType } from './interventionTypes';

/**
 * Place maintenance events onto the trending charts.
 *
 * The charts use a *category* x-axis keyed on sample dates, so a reference line
 * can only be drawn at a date that actually has an oil test. An event is
 * therefore anchored to the first sample taken on or after it — which is also
 * the right reading: that sample is the first one showing the event's effect,
 * so the line lands exactly where the step change appears.
 *
 * Events sharing an anchor are grouped, so three jobs done between two samples
 * produce one labelled line instead of three overlapping ones.
 *
 * @param {Array} interventions records from interventionService
 * @param {Array} chartPoints   [{ date, isoDate }] in ascending date order
 * @returns {{ groups: Array, pending: Array }} `pending` holds events newer than
 *          the last sample: nothing has been measured since, so there is no
 *          anchor to draw, but the UI should still mention them.
 */
export function buildInterventionMarkers(interventions, chartPoints) {
  const points = Array.isArray(chartPoints) ? chartPoints : [];
  const events = (Array.isArray(interventions) ? interventions : [])
    .filter((event) => event?.eventDate)
    .slice()
    .sort((left, right) => String(left.eventDate).localeCompare(String(right.eventDate)));

  if (!points.length || !events.length) {
    return { groups: [], pending: [] };
  }

  const byAnchor = new Map();
  const pending = [];

  events.forEach((event) => {
    const eventDate = String(event.eventDate);
    // ISO dates compare correctly as strings, so no Date parsing is needed.
    const anchor = points.find((point) => String(point.isoDate) >= eventDate);

    if (!anchor) {
      pending.push(event);
      return;
    }

    if (!byAnchor.has(anchor.date)) {
      byAnchor.set(anchor.date, { x: anchor.date, isoDate: anchor.isoDate, events: [] });
    }

    byAnchor.get(anchor.date).events.push(event);
  });

  const groups = [...byAnchor.values()].map((group) => {
    const types = group.events.map((event) => getInterventionType(event.eventType));
    const resets = new Set();
    types.forEach((type) => type.resets.forEach((series) => resets.add(series)));

    return {
      ...group,
      label: types.map((type) => type.code).join('+'),
      // A group's colour comes from its first event; mixed groups are rare and
      // the tooltip lists them all anyway.
      color: types[0].color,
      resets: [...resets],
    };
  });

  return { groups, pending };
}

/**
 * Which marker groups matter for a given chart series.
 * A filtration is noise on the furan chart but essential on the moisture one,
 * so each chart only draws the events that actually reset what it plots.
 */
export function markersForSeries(groups, series) {
  if (!series) {
    return groups;
  }

  const wanted = Array.isArray(series) ? series : [series];
  return groups.filter((group) => group.resets.some((reset) => wanted.includes(reset)));
}
