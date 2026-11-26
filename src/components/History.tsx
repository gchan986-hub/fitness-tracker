import { formatDate } from '../lib/id'
import { isCardio, sortByDateDesc, workoutDistanceKm, workoutVolume } from '../lib/stats'
import type { ExerciseEntry, Units, Workout } from '../lib/types'
import { formatDistance, formatDuration, formatPace, formatWeight } from '../lib/units'

interface Props {
  workouts: Workout[]
  units: Units
  onEdit: (w: Workout) => void
  onDelete: (w: Workout) => void
}

function describe(ex: ExerciseEntry, units: Units): string {
  if (!isCardio(ex)) return ex.sets.map((s) => `${s.reps}×${formatWeight(s.weightKg, units.weight)}`).join(', ')
  const time = formatDuration(ex.durationSec)
  if (!ex.distanceKm) return time
  return `${formatDistance(ex.distanceKm, units.distance)} in ${time} (${formatPace(ex.durationSec / ex.distanceKm, units.distance)})`
}

function summary(w: Workout, units: Units): string {
  const parts: string[] = []
  const vol = workoutVolume(w)
  const dist = workoutDistanceKm(w)
  if (vol > 0) parts.push(`${formatWeight(vol, units.weight)} volume`)
  if (dist > 0) parts.push(formatDistance(dist, units.distance))
  return parts.join(' · ')
}

export function History({ workouts, units, onEdit, onDelete }: Props) {
  if (workouts.length === 0) {
    return <p className="empty">No workouts yet. Log your first one on the Log tab.</p>
  }
  return (
    <section>
      <h2>History</h2>
      <ul className="history">
        {sortByDateDesc(workouts).map((w) => (
          <li key={w.id} className="card">
            <div className="history-head">
              <h3>{formatDate(w.date)}</h3>
              <span className="muted">{summary(w, units)}</span>
            </div>
            <ul className="history-exercises">
              {w.exercises.map((ex, i) => (
                <li key={i}>
                  <strong>{ex.name}</strong> <span className="muted">{describe(ex, units)}</span>
                </li>
              ))}
            </ul>
            {w.notes && <p className="notes">{w.notes}</p>}
            <div className="actions">
              <button type="button" className="secondary" onClick={() => onEdit(w)}>
                Edit
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (confirm(`Delete the workout from ${formatDate(w.date)}?`)) onDelete(w)
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
