import { useId, useState } from 'react'
import { newId, todayLocal } from '../lib/id'
import { lastSetsFor } from '../lib/stats'
import type { WeightUnit, Workout } from '../lib/types'
import { fromKg, toKg } from '../lib/units'
import { validateWorkout } from '../lib/validate'

interface SetDraft {
  key: string
  reps: string
  weight: string
}
interface ExerciseDraft {
  key: string
  name: string
  sets: SetDraft[]
}

const blankSet = (): SetDraft => ({ key: newId(), reps: '', weight: '' })
const blankExercise = (): ExerciseDraft => ({ key: newId(), name: '', sets: [blankSet()] })
const round1 = (n: number) => String(Math.round(n * 10) / 10)

function toDraft(w: Workout, unit: WeightUnit): ExerciseDraft[] {
  return w.exercises.map((ex) => ({
    key: newId(),
    name: ex.name,
    sets: ex.sets.map((s) => ({ key: newId(), reps: String(s.reps), weight: round1(fromKg(s.weightKg, unit)) })),
  }))
}

interface Props {
  unit: WeightUnit
  history: Workout[]
  knownExercises: string[]
  /** When set, the form edits this workout instead of creating a new one. */
  editing?: Workout
  onSave: (w: Workout) => Promise<void>
  onCancel?: () => void
}

export function WorkoutForm({ unit, history, knownExercises, editing, onSave, onCancel }: Props) {
  const listId = useId()
  const [date, setDate] = useState(editing?.date ?? todayLocal())
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [exercises, setExercises] = useState<ExerciseDraft[]>(
    editing ? toDraft(editing, unit) : [blankExercise()],
  )
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const updateExercise = (key: string, fn: (e: ExerciseDraft) => ExerciseDraft) =>
    setExercises((xs) => xs.map((x) => (x.key === key ? fn(x) : x)))

  /** When a known exercise is entered into an empty card, pre-fill last time's sets. */
  const prefill = (ex: ExerciseDraft) => {
    const untouched = ex.sets.every((s) => !s.reps && !s.weight)
    if (!untouched || !ex.name.trim()) return
    const last = lastSetsFor(history, ex.name)
    if (!last) return
    updateExercise(ex.key, (e) => ({
      ...e,
      sets: last.map((s) => ({ key: newId(), reps: String(s.reps), weight: round1(fromKg(s.weightKg, unit)) })),
    }))
  }

  const build = (): Workout => ({
    id: editing?.id ?? newId(),
    createdAt: editing?.createdAt ?? new Date().toISOString(),
    date,
    ...(notes.trim() ? { notes: notes.trim() } : {}),
    exercises: exercises.map((ex) => ({
      name: ex.name.trim().replace(/\s+/g, ' '),
      sets: ex.sets.map((s) => ({
        reps: s.reps.trim() === '' ? NaN : Number(s.reps),
        weightKg: s.weight.trim() === '' ? 0 : toKg(Number(s.weight), unit),
      })),
    })),
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const workout = build()
    const problems = validateWorkout(workout)
    setErrors(problems)
    if (problems.length) return
    setSaving(true)
    try {
      await onSave(workout)
      if (!editing) {
        setExercises([blankExercise()])
        setNotes('')
      }
    } catch (err) {
      setErrors([`Could not save: ${(err as Error).message}`])
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="workout-form" onSubmit={submit} noValidate>
      <h2>{editing ? 'Edit workout' : 'Log workout'}</h2>
      <label className="field">
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>

      <datalist id={listId}>
        {knownExercises.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {exercises.map((ex, i) => (
        <fieldset key={ex.key} className="exercise card">
          <legend className="sr-only">Exercise {i + 1}</legend>
          <div className="exercise-head">
            <input
              aria-label={`Exercise ${i + 1} name`}
              placeholder="Exercise, e.g. Bench Press"
              list={listId}
              value={ex.name}
              autoCapitalize="words"
              onChange={(e) => updateExercise(ex.key, (x) => ({ ...x, name: e.target.value }))}
              onBlur={() => prefill(ex)}
            />
            {exercises.length > 1 && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove exercise ${i + 1}`}
                onClick={() => setExercises((xs) => xs.filter((x) => x.key !== ex.key))}
              >
                ✕
              </button>
            )}
          </div>
          <div className="sets">
            <div className="set-row set-head" aria-hidden>
              <span>Set</span>
              <span>Reps</span>
              <span>Weight ({unit})</span>
              <span />
            </div>
            {ex.sets.map((s, j) => (
              <div className="set-row" key={s.key}>
                <span className="set-num">{j + 1}</span>
                <input
                  aria-label={`Exercise ${i + 1} set ${j + 1} reps`}
                  inputMode="numeric"
                  value={s.reps}
                  onChange={(e) =>
                    updateExercise(ex.key, (x) => ({
                      ...x,
                      sets: x.sets.map((y) => (y.key === s.key ? { ...y, reps: e.target.value } : y)),
                    }))
                  }
                />
                <input
                  aria-label={`Exercise ${i + 1} set ${j + 1} weight`}
                  inputMode="decimal"
                  placeholder="0"
                  value={s.weight}
                  onChange={(e) =>
                    updateExercise(ex.key, (x) => ({
                      ...x,
                      sets: x.sets.map((y) => (y.key === s.key ? { ...y, weight: e.target.value } : y)),
                    }))
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove exercise ${i + 1} set ${j + 1}`}
                  disabled={ex.sets.length === 1}
                  onClick={() => updateExercise(ex.key, (x) => ({ ...x, sets: x.sets.filter((y) => y.key !== s.key) }))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              updateExercise(ex.key, (x) => {
                const last = x.sets[x.sets.length - 1]
                return { ...x, sets: [...x.sets, { ...blankSet(), reps: last?.reps ?? '', weight: last?.weight ?? '' }] }
              })
            }
          >
            + Add set
          </button>
        </fieldset>
      ))}

      <button type="button" className="secondary wide" onClick={() => setExercises((xs) => [...xs, blankExercise()])}>
        + Add exercise
      </button>

      <label className="field">
        Notes (optional)
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <div className="actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="primary" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save workout'}
        </button>
      </div>
    </form>
  )
}
