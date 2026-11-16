import { formatDate } from '../lib/id'
import { sortByDateDesc, workoutVolume } from '../lib/stats'
import type { WeightUnit, Workout } from '../lib/types'
import { formatWeight } from '../lib/units'

interface Props {
  workouts: Workout[]
  unit: WeightUnit
  onEdit: (w: Workout) => void
  onDelete: (w: Workout) => void
}

export function History({ workouts, unit, onEdit, onDelete }: Props) {
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
              <span className="muted">{formatWeight(workoutVolume(w), unit)} volume</span>
            </div>
            <ul className="history-exercises">
              {w.exercises.map((ex, i) => (
                <li key={i}>
                  <strong>{ex.name}</strong>{' '}
                  <span className="muted">
                    {ex.sets.map((s) => `${s.reps}×${formatWeight(s.weightKg, unit)}`).join(', ')}
                  </span>
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
