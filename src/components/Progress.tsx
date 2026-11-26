import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../lib/id'
import { exerciseLabel } from '../lib/equipment'
import { cardioProgressFor, cardioRecords, catalogKey, personalRecords, progressFor, type CatalogItem } from '../lib/stats'
import { sortWeighIns } from '../lib/profile'
import type { BodyWeight, Equipment, Units, Workout } from '../lib/types'
import { formatDistance, formatDuration, formatPace, formatWeight, fromKg, fromKm, paceInUnit } from '../lib/units'

interface Row {
  date: string
  value: number
}
interface Metric {
  id: string
  label: string
  rows: Row[]
  /** Formats a chart value for the tooltip. */
  fmt: (v: number) => string
  /** Formats a chart value for the y-axis (defaults to fmt). */
  tick?: (v: number) => string
}
interface RecordItem {
  label: string
  value?: string
  detail?: string
}

const r = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp

function strengthView(
  workouts: Workout[],
  name: string,
  equipment: Equipment | undefined,
  units: Units,
): { metrics: Metric[]; records: RecordItem[] } {
  const pts = progressFor(workouts, name, equipment)
  const w = units.weight
  const rows = (k: 'est1RmKg' | 'topWeightKg' | 'volumeKg') => pts.map((p) => ({ date: p.date, value: r(fromKg(p[k], w), 1) }))
  const fmt = (v: number) => `${v} ${w}`
  const prs = personalRecords(workouts, name, equipment)
  return {
    metrics: [
      { id: 'e1rm', label: 'Estimated 1-rep max', rows: rows('est1RmKg'), fmt },
      { id: 'top', label: 'Heaviest set', rows: rows('topWeightKg'), fmt },
      { id: 'volume', label: 'Volume (reps × weight)', rows: rows('volumeKg'), fmt },
    ],
    records: [
      {
        label: 'Heaviest set',
        value: prs.heaviest && `${formatWeight(prs.heaviest.weightKg, w)} × ${prs.heaviest.reps}`,
        detail: prs.heaviest && formatDate(prs.heaviest.date),
      },
      {
        label: 'Best est. 1RM',
        value: prs.bestEst1Rm && formatWeight(prs.bestEst1Rm.est1RmKg, w),
        detail:
          prs.bestEst1Rm &&
          `${formatWeight(prs.bestEst1Rm.weightKg, w)} × ${prs.bestEst1Rm.reps}, ${formatDate(prs.bestEst1Rm.date)}`,
      },
      {
        label: 'Most volume in a day',
        value: prs.mostVolumeInDay && formatWeight(prs.mostVolumeInDay.volumeKg, w),
        detail: prs.mostVolumeInDay && formatDate(prs.mostVolumeInDay.date),
      },
    ],
  }
}

function cardioView(workouts: Workout[], name: string, units: Units): { metrics: Metric[]; records: RecordItem[] } {
  const pts = cardioProgressFor(workouts, name)
  const d = units.distance
  const rec = cardioRecords(workouts, name)
  return {
    metrics: [
      {
        id: 'distance',
        label: 'Distance',
        rows: pts.filter((p) => p.distanceKm > 0).map((p) => ({ date: p.date, value: r(fromKm(p.distanceKm, d), 2) })),
        fmt: (v) => `${v} ${d}`,
      },
      {
        id: 'pace',
        label: 'Pace (lower is faster)',
        rows: pts.flatMap((p) =>
          p.paceSecPerKm === undefined ? [] : [{ date: p.date, value: Math.round(paceInUnit(p.paceSecPerKm, d)) }],
        ),
        fmt: (v) => `${formatDuration(v)} /${d}`,
        tick: formatDuration,
      },
      {
        id: 'time',
        label: 'Time',
        rows: pts.map((p) => ({ date: p.date, value: r(p.durationSec / 60, 1) })),
        fmt: (v) => formatDuration(v * 60),
        tick: (v) => `${v} min`,
      },
    ],
    records: [
      {
        label: 'Longest distance',
        value: rec.longestDistance && formatDistance(rec.longestDistance.distanceKm, d),
        detail:
          rec.longestDistance &&
          `in ${formatDuration(rec.longestDistance.durationSec)}, ${formatDate(rec.longestDistance.date)}`,
      },
      {
        label: 'Fastest pace',
        value: rec.fastestPace && formatPace(rec.fastestPace.paceSecPerKm, d),
        detail:
          rec.fastestPace && `${formatDistance(rec.fastestPace.distanceKm, d)}, ${formatDate(rec.fastestPace.date)}`,
      },
      {
        label: 'Longest time',
        value: rec.longestDuration && formatDuration(rec.longestDuration.durationSec),
        detail: rec.longestDuration && formatDate(rec.longestDuration.date),
      },
    ],
  }
}

function bodyWeightView(weighIns: BodyWeight[], units: Units): { metrics: Metric[]; records: RecordItem[] } {
  const list = sortWeighIns(weighIns)
  const w = units.weight
  const first = list[0]
  const last = list[list.length - 1]
  const lowest = list.reduce((a, b) => (b.weightKg < a.weightKg ? b : a), first)
  const change = last.weightKg - first.weightKg
  const changeText = `${change > 0 ? '+' : change < 0 ? '−' : '±'}${formatWeight(Math.abs(change), w)}`
  return {
    metrics: [
      {
        id: 'bodyweight',
        label: 'Body weight',
        rows: list.map((b) => ({ date: b.date, value: r(fromKg(b.weightKg, w), 1) })),
        fmt: (v) => `${v} ${w}`,
      },
    ],
    records: [
      { label: 'Latest', value: formatWeight(last.weightKg, w), detail: formatDate(last.date) },
      { label: 'Change', value: changeText, detail: `since ${formatDate(first.date)}` },
      { label: 'Lowest', value: formatWeight(lowest.weightKg, w), detail: formatDate(lowest.date) },
    ],
  }
}

/** Select value for the body weight chart (can't clash with an exercise key, which always contains "|"). */
const BODY_WEIGHT = 'body-weight'

interface Props {
  workouts: Workout[]
  catalog: CatalogItem[]
  units: Units
  bodyWeights?: BodyWeight[]
}

export function Progress({ workouts, catalog, units, bodyWeights = [] }: Props) {
  const [picked, setPicked] = useState('')
  const [metricId, setMetricId] = useState('')

  const hasWeight = bodyWeights.length > 0
  if (catalog.length === 0 && !hasWeight) {
    return <p className="empty">Log a workout to see progress charts here.</p>
  }
  const item = catalog.find((c) => catalogKey(c) === picked)
  const showWeight = hasWeight && (picked === BODY_WEIGHT || (!item && catalog.length === 0))
  const current = showWeight ? undefined : (item ?? catalog[0])
  const label = current ? exerciseLabel(current.name, current.equipment) : 'Body weight'
  const view = !current
    ? bodyWeightView(bodyWeights, units)
    : current.kind === 'cardio'
      ? cardioView(workouts, current.name, units)
      : strengthView(workouts, current.name, current.equipment, units)
  const metric = view.metrics.find((m) => m.id === metricId) ?? view.metrics[0]
  const data = metric.rows

  return (
    <section>
      <h2>Progress</h2>
      <div className="controls">
        <label className="field">
          Exercise
          <select value={current ? catalogKey(current) : BODY_WEIGHT} onChange={(e) => setPicked(e.target.value)}>
            {hasWeight && <option value={BODY_WEIGHT}>Body weight</option>}
            {catalog.map((c) => (
              <option key={catalogKey(c)} value={catalogKey(c)}>
                {exerciseLabel(c.name, c.equipment)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Show
          <select value={metric.id} onChange={(e) => setMetricId(e.target.value)}>
            {view.metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card chart" aria-label={`${label} progress chart`}>
        {data.length < 2 ? (
          <p className="muted">
            {current ? `Log ${label}` : 'Log your weight'}
            {metric.id === 'distance' || metric.id === 'pace' ? ' with a distance' : ''} on at least two different days
            to see a trend.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} stroke="var(--muted)" fontSize={12} />
              <YAxis
                stroke="var(--muted)"
                fontSize={12}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => (metric.tick ?? metric.fmt)(v)}
                width={70}
              />
              <Tooltip
                labelFormatter={(d) => formatDate(String(d))}
                formatter={(v) => [metric.fmt(Number(v)), metric.label]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <h3>{current ? 'Personal records' : 'Summary'}</h3>
      <dl className="prs">
        {view.records.map((rec) => (
          <div className="card" key={rec.label}>
            <dt>{rec.label}</dt>
            <dd>{rec.value ?? '—'}</dd>
            {rec.detail && <dd className="muted">{rec.detail}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}
