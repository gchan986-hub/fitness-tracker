import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../lib/id'
import { personalRecords, progressFor, type ProgressPoint } from '../lib/stats'
import type { WeightUnit, Workout } from '../lib/types'
import { formatWeight, fromKg } from '../lib/units'

type Metric = 'est1RmKg' | 'topWeightKg' | 'volumeKg'
const METRICS: { value: Metric; label: string }[] = [
  { value: 'est1RmKg', label: 'Estimated 1-rep max' },
  { value: 'topWeightKg', label: 'Heaviest set' },
  { value: 'volumeKg', label: 'Volume (reps × weight)' },
]

interface Props {
  workouts: Workout[]
  exercises: string[]
  unit: WeightUnit
}

export function Progress({ workouts, exercises, unit }: Props) {
  const [picked, setPicked] = useState('')
  const [metric, setMetric] = useState<Metric>('est1RmKg')

  if (exercises.length === 0) {
    return <p className="empty">Log a workout to see progress charts here.</p>
  }
  const exercise = exercises.includes(picked) ? picked : exercises[0]
  const points = progressFor(workouts, exercise)
  const data = points.map((p: ProgressPoint) => ({
    date: p.date,
    value: Math.round(fromKg(p[metric], unit) * 10) / 10,
  }))
  const prs = personalRecords(workouts, exercise)

  return (
    <section>
      <h2>Progress</h2>
      <div className="controls">
        <label className="field">
          Exercise
          <select value={exercise} onChange={(e) => setPicked(e.target.value)}>
            {exercises.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Show
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card chart" aria-label={`${exercise} progress chart`}>
        {data.length < 2 ? (
          <p className="muted">Log {exercise} on at least two different days to see a trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} domain={['auto', 'auto']} unit={` ${unit}`} width={70} />
              <Tooltip
                labelFormatter={(d) => formatDate(String(d))}
                formatter={(v) => [`${v} ${unit}`, METRICS.find((m) => m.value === metric)!.label]}
              />
              <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <h3>Personal records</h3>
      <dl className="prs">
        <div className="card">
          <dt>Heaviest set</dt>
          <dd>{prs.heaviest ? `${formatWeight(prs.heaviest.weightKg, unit)} × ${prs.heaviest.reps}` : '—'}</dd>
          {prs.heaviest && <dd className="muted">{formatDate(prs.heaviest.date)}</dd>}
        </div>
        <div className="card">
          <dt>Best est. 1RM</dt>
          <dd>{prs.bestEst1Rm ? formatWeight(prs.bestEst1Rm.est1RmKg, unit) : '—'}</dd>
          {prs.bestEst1Rm && (
            <dd className="muted">
              {formatWeight(prs.bestEst1Rm.weightKg, unit)} × {prs.bestEst1Rm.reps}, {formatDate(prs.bestEst1Rm.date)}
            </dd>
          )}
        </div>
        <div className="card">
          <dt>Most volume in a day</dt>
          <dd>{prs.mostVolumeInDay ? formatWeight(prs.mostVolumeInDay.volumeKg, unit) : '—'}</dd>
          {prs.mostVolumeInDay && <dd className="muted">{formatDate(prs.mostVolumeInDay.date)}</dd>}
        </div>
      </dl>
    </section>
  )
}
