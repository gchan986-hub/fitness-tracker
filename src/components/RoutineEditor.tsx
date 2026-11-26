import { useState } from 'react'
import { dedupeExercises, validateRoutine } from '../lib/routines'
import type { CatalogItem } from '../lib/stats'
import type { Routine, RoutineExercise, RoutineInput } from '../lib/types'
import { DayPicker } from './DayPicker'
import { ExercisePicker } from './ExercisePicker'

interface Props {
  routine?: Routine
  catalog: CatalogItem[]
  onSave: (input: RoutineInput) => Promise<boolean>
  onCancel: () => void
}

export function RoutineEditor({ routine, catalog, onSave, onCancel }: Props) {
  const [name, setName] = useState(routine?.name ?? '')
  const [days, setDays] = useState<number[]>(routine?.days ?? [])
  const [exercises, setExercises] = useState<RoutineExercise[]>(routine?.exercises ?? [])
  const [picking, setPicking] = useState(!routine)
  const [errors, setErrors] = useState<string[]>([])

  const move = (i: number, by: number) =>
    setExercises((xs) => {
      const next = [...xs]
      const [item] = next.splice(i, 1)
      next.splice(i + by, 0, item)
      return next
    })

  const save = async () => {
    const input = { name: name.trim(), days, exercises }
    const problems = validateRoutine(input)
    setErrors(problems)
    if (problems.length === 0) await onSave(input)
  }

  return (
    <section>
      <h2>{routine ? 'Edit routine' : 'New routine'}</h2>
      <label className="field">
        Routine name
        <input value={name} placeholder="e.g. Push day" onChange={(e) => setName(e.target.value)} />
      </label>
      <DayPicker value={days} onChange={setDays} />

      <h3>Exercises</h3>
      {exercises.length === 0 ? (
        <p className="muted">No exercises yet. Add some from the list below.</p>
      ) : (
        <ol className="routine-exercises">
          {exercises.map((ex, i) => (
            <li key={ex.name} className="card">
              <span>
                {ex.name} <span className="tag">{ex.kind === 'cardio' ? 'Cardio' : 'Weights'}</span>
              </span>
              <span className="row-actions">
                <button type="button" className="icon-btn" aria-label={`Move ${ex.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${ex.name} down`}
                  disabled={i === exercises.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${ex.name}`}
                  onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {picking ? (
        <ExercisePicker
          catalog={catalog}
          selected={exercises.map((e) => e.name)}
          onPick={(item) => setExercises((xs) => dedupeExercises([...xs, item]))}
          onClose={() => setPicking(false)}
        />
      ) : (
        <button type="button" className="secondary wide" onClick={() => setPicking(true)}>
          + Add exercises
        </button>
      )}

      {errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={save}>
          Save routine
        </button>
      </div>
    </section>
  )
}
