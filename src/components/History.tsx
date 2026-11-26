import { useState } from 'react'
import { formatDate } from '../lib/id'
import { routineExercisesFrom, weekdayOf } from '../lib/routines'
import { exerciseLabel } from '../lib/equipment'
import { equipmentOf, isCardio, sortByDateDesc, workoutDistanceKm, workoutVolume } from '../lib/stats'
import type { ExerciseEntry, RoutineInput, Units, Workout } from '../lib/types'
import { formatDistance, formatDuration, formatPace, formatWeight } from '../lib/units'
import { SaveRoutinePanel } from './SaveRoutinePanel'

interface Props {
  workouts: Workout[]
  units: Units
  onEdit: (w: Workout) => void
  onDelete: (w: Workout) => void
  onSaveRoutine: (input: RoutineInput) => Promise<boolean>
}

function describe(ex: ExerciseEntry, units: Units): string {
  if (!isCardio(ex)) {
    const bodyweight = equipmentOf(ex) === 'bodyweight'
    return ex.sets
      .map((s) =>
        bodyweight
          ? s.weightKg > 0
            ? `${s.reps} × +${formatWeight(s.weightKg, units.weight)}`
            : `${s.reps} reps`
          : `${s.reps}×${formatWeight(s.weightKg, units.weight)}`,
      )
      .join(', ')
  }
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

export function History({ workouts, units, onEdit, onDelete, onSaveRoutine }: Props) {
  const [savingFrom, setSavingFrom] = useState<string>()
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
              <h3>
                {formatDate(w.date)}
                {w.routineName && <span className="tag routine-tag">{w.routineName}</span>}
              </h3>
              <span className="muted">{summary(w, units)}</span>
            </div>
            <ul className="history-exercises">
              {w.exercises.map((ex, i) => (
                <li key={i}>
                  <strong>{isCardio(ex) ? ex.name : exerciseLabel(ex.name, equipmentOf(ex))}</strong>{' '}
                  <span className="muted">{describe(ex, units)}</span>
                </li>
              ))}
            </ul>
            {w.notes && <p className="notes">{w.notes}</p>}
            {savingFrom === w.id && (
              <SaveRoutinePanel
                exercises={routineExercisesFrom(w.exercises)}
                defaultName={w.routineName ?? ''}
                defaultDays={[weekdayOf(w.date)]}
                onCancel={() => setSavingFrom(undefined)}
                onSave={async (input) => {
                  const saved = await onSaveRoutine(input)
                  if (saved) setSavingFrom(undefined)
                  return saved
                }}
              />
            )}
            <div className="actions">
              {savingFrom !== w.id && (
                <button type="button" className="secondary push-left" onClick={() => setSavingFrom(w.id)}>
                  Save as routine
                </button>
              )}
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
