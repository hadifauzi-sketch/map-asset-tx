import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Droplets,
  FlaskConical,
  Gauge,
  TrendingUp,
} from 'lucide-react';
import { accumulateFuran, accumulateMarker, summariseFuran } from '../lib/furanAccumulation';
import {
  buildPaperLifeSeries,
  DP_END_OF_LIFE,
  DP_NEW_PAPER,
  lowestRemainingLife,
} from '../lib/paperLife';
import { buildInterventionMarkers } from '../lib/interventionMarkers';
import { getInterventionType } from '../lib/interventionTypes';
import { mapOilTestsToChartData } from '../lib/oilTestChartData';
import { summariseInterventionImpact } from '../lib/maintenanceImpact';

const AXIS = 'color-mix(in srgb, var(--foreground) 58%, var(--border) 42%)';
const TEXT = 'var(--foreground)';
const MUTED = 'color-mix(in srgb, var(--foreground) 68%, var(--muted) 32%)';
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--foreground)',
  fontSize: 12,
};

function formatDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value ?? '')
    : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return Math.abs(value) >= 100 ? Math.round(value).toString() : Number(value.toFixed(2)).toString();
}

/** Vertical maintenance markers. Every event is drawn here — on this tab the
 *  point is to see the work against every measure, not only the ones it resets. */
function markers(groups, yAxisId) {
  return groups.map((group) => (
    <ReferenceLine
      key={`m-${group.x}-${group.label}`}
      x={group.x}
      {...(yAxisId ? { yAxisId } : {})}
      stroke={group.color}
      strokeDasharray="4 4"
      strokeWidth={1.5}
      label={{ value: group.label, position: 'top', fill: group.color, fontSize: 10, fontWeight: 700 }}
    />
  ));
}

function ChartCard({ title, icon: Icon, accent, children, footer, ownContainer = false }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[var(--card)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-md"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {title}
        </h4>
      </div>
      {ownContainer ? (
        children
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          {children}
        </ResponsiveContainer>
      )}
      {footer ? <p className="mt-1.5 text-[10px] text-[var(--muted)]">{footer}</p> : null}
    </div>
  );
}

const DGA_SERIES = [
  { key: 'TDCG', name: 'TDCG', color: '#f97316', width: 2.5 },
  { key: 'H2', name: 'H₂', color: '#3b82f6' },
  { key: 'CH4', name: 'CH₄', color: '#22c55e' },
  { key: 'C2H6', name: 'C₂H₆', color: '#14b8a6' },
  { key: 'C2H4', name: 'C₂H₄', color: '#a855f7' },
  { key: 'C2H2', name: 'C₂H₂', color: '#ef4444' },
  { key: 'CO', name: 'CO', color: '#eab308' },
];

/**
 * Same clickable-legend behaviour as the Trending tab's DGA chart: with seven
 * gases at half width, hiding the ones you are not chasing is the only way to
 * read a step change across a maintenance marker.
 */
function MaintenanceDgaChart({ data, groups, axisProps }) {
  const [hidden, setHidden] = useState({});

  const toggle = (entry) => {
    const key = entry?.dataKey;
    if (!key) return;
    setHidden((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <ResponsiveContainer width="100%" height={210}>
      <ComposedChart data={data} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis {...axisProps} />
        <YAxis fontSize={9} stroke={AXIS} tick={{ fill: TEXT }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend
          verticalAlign="top"
          height={30}
          onClick={toggle}
          wrapperStyle={{ fontSize: 10, cursor: 'pointer' }}
          formatter={(value, entry) => (
            <span
              style={{
                color: hidden[entry?.dataKey] ? MUTED : TEXT,
                textDecoration: hidden[entry?.dataKey] ? 'line-through' : 'none',
                opacity: hidden[entry?.dataKey] ? 0.6 : 1,
              }}
            >
              {value}
            </span>
          )}
        />
        {DGA_SERIES.map((series) =>
          series.key === 'TDCG' ? (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.name}
              fill={series.color}
              fillOpacity={0.12}
              stroke={series.color}
              strokeWidth={series.width}
              hide={Boolean(hidden[series.key])}
            />
          ) : (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.name}
              stroke={series.color}
              strokeWidth={1.5}
              dot={false}
              hide={Boolean(hidden[series.key])}
            />
          )
        )}
        {markers(groups)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function DeltaChip({ measure }) {
  const tone =
    measure.improved === null
      ? { color: MUTED, Icon: ArrowRight }
      : measure.improved
        ? { color: '#10b981', Icon: measure.delta > 0 ? ArrowUpRight : ArrowDownRight }
        : { color: '#ef4444', Icon: measure.delta > 0 ? ArrowUpRight : ArrowDownRight };

  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[var(--card-muted)] px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--muted)]">
        {measure.label}
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]">
        {formatNumber(measure.from)}
        <ArrowRight className="h-3 w-3 text-[var(--muted)]" />
        {formatNumber(measure.to)}
        <span className="text-[10px] font-normal text-[var(--muted)]">{measure.unit}</span>
      </p>
      <p className="mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: tone.color }}>
        <tone.Icon className="h-3 w-3" />
        {measure.delta > 0 ? '+' : ''}
        {formatNumber(measure.delta)}
        {measure.percent !== null ? ` (${measure.percent > 0 ? '+' : ''}${Math.round(measure.percent)}%)` : ''}
      </p>
    </div>
  );
}

export default function MaintenanceImpactCharts({ oilTests = [], interventions = [] }) {
  const chartData = useMemo(() => mapOilTestsToChartData(oilTests), [oilTests]);
  const { groups, pending } = useMemo(
    () => buildInterventionMarkers(interventions, chartData),
    [chartData, interventions]
  );
  const { compared, uncomparable } = useMemo(
    () => summariseInterventionImpact(interventions, chartData),
    [chartData, interventions]
  );
  // Only recorded work resets the total. Reading a reset off the curve's shape
  // would treat ordinary sample-to-sample variation as fresh production.
  const furanRemovalDates = useMemo(
    () =>
      interventions
        .filter((event) => getInterventionType(event.eventType).resets.includes('Furan'))
        .map((event) => String(event.eventDate)),
    [interventions]
  );

  const furanData = useMemo(
    () => accumulateFuran(chartData, furanRemovalDates),
    [chartData, furanRemovalDates]
  );

  // Life is derived from the LIFETIME totals, not the measured values: oil
  // treatment removes both by-products, so a life figure built on what is
  // currently in the oil recovers after every filtration — reporting that the
  // paper got younger.
  const lifeData = useMemo(() => {
    const withMethanol = accumulateMarker(furanData, furanRemovalDates, {
      sourceKey: 'Methanol',
      totalKey: 'MethanolTotal',
      resetKey: 'methanolReset',
    });
    return buildPaperLifeSeries(withMethanol);
  }, [furanData, furanRemovalDates]);

  const lowestLife = useMemo(() => lowestRemainingLife(lifeData), [lifeData]);

  const lifeFooter =
    lowestLife === null
      ? 'No furan or methanol results yet, so paper condition cannot be estimated.'
      : `Lowest estimate ${lowestLife}% remaining (DP ${DP_NEW_PAPER} new, ${DP_END_OF_LIFE} end of life). Derived from lifetime by-product totals, so filtration does not make the paper look younger.`;
  const furanSummary = useMemo(
    () => summariseFuran(chartData, furanRemovalDates),
    [chartData, furanRemovalDates]
  );

  const furanFooter =
    furanSummary.total === null
      ? 'No 2-FAL results recorded yet.'
      : furanSummary.resetCount > 0
        ? `About ${Math.round(furanSummary.total)} ppb produced over the asset's life; ${Math.round(
            furanSummary.current
          )} ppb is still in the oil, so roughly ${Math.round(
            furanSummary.removed
          )} ppb has been stripped out by ${furanSummary.resetCount} treatment(s). The paper does not recover.`
        : `About ${Math.round(
            furanSummary.total
          )} ppb produced so far. No furan-removing work recorded, so the measured curve is still the true one.`;

  if (!interventions.length) {
    return null;
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[color:var(--border)] px-4 py-6 text-center">
        <p className="text-sm text-[var(--foreground)]">No oil tests to chart</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Maintenance is recorded, but there are no results in this compartment to show its effect.
        </p>
      </div>
    );
  }

  const axisProps = {
    dataKey: 'date',
    fontSize: 9,
    stroke: AXIS,
    tick: { fill: TEXT },
    interval: 'preserveStartEnd',
  };
  const legendProps = {
    verticalAlign: 'top',
    height: 24,
    wrapperStyle: { fontSize: 10 },
    formatter: (value) => <span style={{ color: TEXT }}>{value}</span>,
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[var(--foreground)]">Effect on oil condition</h3>
        <p className="mt-1 max-w-3xl text-xs text-[var(--muted)]">
          The four measures maintenance is judged on, with each job marked on the date of the first
          sample that could show its effect. Compare across a marker to see whether the work held.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartCard
          title="Dissolved gas (click legend to toggle)"
          icon={Activity}
          accent="#f97316"
          ownContainer
          footer="Filtration, degassing, retrofill and untanking all reset this baseline."
        >
          <MaintenanceDgaChart data={chartData} groups={groups} axisProps={axisProps} />
        </ChartCard>

        <ChartCard
          title="Moisture & breakdown voltage"
          icon={Droplets}
          accent="#0ea5e9"
          footer="They move together: drying the oil raises BDV. Moisture down and BDV up across a marker means the filtration worked."
        >
          <ComposedChart data={chartData} margin={{ top: 14, right: -8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis {...axisProps} />
            <YAxis
              yAxisId="moisture"
              fontSize={9}
              stroke="#0ea5e9"
              tick={{ fill: TEXT }}
              unit=" ppm"
              width={52}
            />
            <YAxis
              yAxisId="bdv"
              orientation="right"
              fontSize={9}
              stroke="#10b981"
              tick={{ fill: TEXT }}
              unit=" kV"
              width={48}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend {...legendProps} />
            <Area
              yAxisId="moisture"
              type="monotone"
              dataKey="Moisture"
              name="Water content (ppm)"
              fill="#0ea5e9"
              fillOpacity={0.14}
              stroke="#0ea5e9"
              strokeWidth={2}
            />
            <Line
              yAxisId="bdv"
              type="monotone"
              dataKey="BDV"
              name="BDV (kV)"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
            {markers(groups, 'moisture')}
          </ComposedChart>
        </ChartCard>

        <ChartCard
          title="Estimated remaining life (%)"
          icon={Gauge}
          accent="#22c55e"
          footer={lifeFooter}
        >
          <ComposedChart data={lifeData} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis {...axisProps} />
            <YAxis
              fontSize={9}
              stroke={AXIS}
              tick={{ fill: TEXT }}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              unit="%"
              width={44}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => `${value}%`} />
            <Legend {...legendProps} />
            <ReferenceLine
              y={20}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ position: 'insideBottomRight', value: 'End of life', fill: '#ef4444', fontSize: 9 }}
            />
            <Area
              type="monotone"
              dataKey="LifeFromFuran"
              name="From furan"
              fill="#22c55e"
              fillOpacity={0.12}
              stroke="#22c55e"
              strokeWidth={2.5}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="LifeFromMethanol"
              name="From methanol"
              stroke="#ec4899"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 2 }}
              connectNulls
            />
            {markers(groups)}
          </ComposedChart>
        </ChartCard>

        <ChartCard
          title="Cumulative furan (lifetime paper ageing)"
          icon={TrendingUp}
          accent="#f43f5e"
          footer={furanFooter}
        >
          <ComposedChart data={furanData} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis {...axisProps} />
            <YAxis fontSize={9} stroke={AXIS} tick={{ fill: TEXT }} unit=" ppb" width={56} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend {...legendProps} />
            <Area
              type="monotone"
              dataKey="FuranTotal"
              name="Total produced (ppb)"
              fill="#f43f5e"
              fillOpacity={0.14}
              stroke="#f43f5e"
              strokeWidth={2.5}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="Furan"
              name="Still in oil (ppb)"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
            {markers(groups)}
          </ComposedChart>
        </ChartCard>
      </div>

      {pending.length ? (
        <p className="text-xs italic text-[var(--muted)]">
          {pending.length} event(s) recorded after the latest sample — not yet drawn, because nothing
          has been measured since.
        </p>
      ) : null}

      {compared.length ? (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">Before and after</h4>
          {compared.map(({ event, before, after, measures }) => {
            const type = getInterventionType(event.eventType);

            return (
              <div
                key={event.id}
                className="rounded-lg border border-[color:var(--border)] bg-[var(--card)] p-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex h-6 items-center rounded-md px-2 text-[11px] font-bold"
                    style={{ backgroundColor: `${type.color}22`, color: type.color }}
                  >
                    {type.code}
                  </span>
                  <span className="text-sm font-medium text-[var(--foreground)]">{type.label}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {formatDate(event.eventDate)} · comparing {formatDate(before.isoDate)} with{' '}
                    {formatDate(after.isoDate)}
                  </span>
                </div>

                {measures.length ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {measures.map((measure) => (
                      <DeltaChip key={measure.key} measure={measure} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    The samples either side share no common measurement, so nothing can be compared.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {uncomparable.length ? (
        <ul className="space-y-1">
          {uncomparable.map(({ event, reason }) => (
            <li key={event.id} className="text-xs text-[var(--muted)]">
              <strong style={{ color: getInterventionType(event.eventType).color }}>
                {getInterventionType(event.eventType).code}
              </strong>{' '}
              {formatDate(event.eventDate)} — {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
