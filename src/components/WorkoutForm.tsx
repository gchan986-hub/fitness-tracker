import { useId, useState } from 'react'
import { newId, todayLocal } from '../lib/id'
import { isCardio, kindOf, lastEntryFor } from '../lib/stats'
import type { ExerciseEntry, ExerciseKind, Units, Workout } from '../lib/types'
import { formatPace, fromKg, fromKm, toKg, toKm } from '../lib/units'
import { validateWorkout } from '../lib/validate'

interface SetDraft {
  key: string
  reps: string
  weight: string
}
interface ExerciseDraft {
  key: string
  kind: ExerciseKind
  name: string
  sets: SetDraft[]
  distance: string
  minutes: string
  seconds: string
}

const blankSet = (): SetDraft => ({ key: newId(), reps: '', weight: '' })
const blankExercise = (kind: ExerciseKind = 'strength'): ExerciseDraft => ({
  key: newId(),
  kind,
  name: '',
  sets: [blankSet()],
  distance: '',
  minutes: '',
  seconds: '',
})
const round = (n: number, dp = 1) => String(Math.round(n * 10 ** dp) / 10 ** dp)
/** Accepts "7,5" as well as "7.5"; blank or junk becomes NaN. */
const num = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')))

function entryToDraft(ex: ExerciseEntry, units: Units): ExerciseDraft {
  const base = { ...blankExercise(kindOf(ex)), name: ex.name }
  if (isCardio(ex)) {
    return {
      ...base,
      distance: ex.distanceKm === undefined ? '' : round(fromKm(ex.distanceKm, units.distance), 2),
      minutes: String(Math.floor(ex.durationSec / 60)),
      seconds: ex.durationSec % 60 ? String(Math.round(ex.durationSec % 60)) : '',
    }
  }
  return {
    ...base,
    sets: ex.sets.map((s) => ({ key: newId(), reps: String(s.reps), weight: round(fromKg(s.weightKg, units.weight)) })),
  }
}

/** Minutes + seconds fields to seconds; NaN if both blank or invalid. */
function draftDuration(d: ExerciseDraft): number {
  if (!d.minutes.trim() && !d.seconds.trim()) return NaN
  const m = d.minutes.trim() ? Number(d.minutes) : 0
  const s = d.seconds.trim() ? Number(d.seconds) : 0
  if (!Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0 || s > 59) return NaN
  return m * 60 + s
}

function draftToEntry(d: ExerciseDraft, units: Units): ExerciseEntry {
  const name = d.name.trim().replace(/\s+/g, ' ')
  if (d.kind === 'cardio') {
    return {
      kind: 'cardio',
      name,
      durationSec: draftDuration(d),
      ...(d.distance.trim() ? { distanceKm: toKm(num(d.distance), units.distance) } : {}),
    }
  }
  return {
    name,
    sets: d.sets.map((s) => ({
      reps: num(s.reps),
      weightKg: s.weight.trim() === '' ? 0 : toKg(num(s.weight), units.weight),
    })),
  }
}

const isUntouched = (d: ExerciseDraft) =>
  d.sets.every((s) => !s.reps && !s.weight) && !d.distance && !d.minutes && !d.seconds

interface Props {
  units: Units
  history: Workout[]
  knownExercises: string[]
  /** When set, the form edits this workout instead of creating a new one. */
  editing?: Workout
  onSave: (w: Workout) => Promise<void>
  onCancel?: () => void
}

export function WorkoutForm({ units, history, knownExercises, editing, onSave, onCancel }: Props) {
  const listId = useId()
  const [date, setDate] = useState(editing?.date ?? todayLocal())
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [exercises, setExercises] = useState<ExerciseDraft[]>(
    editing ? editing.exercises.map((ex) => entryToDraft(ex, units)) : [blankExercise()],
  )
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const updateExercise = (key: string, fn: (e: ExerciseDraft) => ExerciseDraft) =>
    setExercises((xs) => xs.map((x) => (x.key === key ? fn(x) : x)))

  const updateSet = (exKey: string, setKey: string, patch: Partial<SetDraft>) =>
    updateExercise(exKey, (x) => ({ ...x, sets: x.sets.map((y) => (y.key === setKey ? { ...y, ...patch } : y)) }))

  /**
   * When a known exercise is entered into an empty card, switch to its type and pre-fill last time's numbers.
   * Runs on blur, so `nextFocus` is the field being tapped: that field is left as it is (so typing into it doesn't
   * append to a pre-filled value) and inputs keep their identity (so the keyboard stays open).
   */
  const prefill = (ex: ExerciseDraft, nextFocus: EventTarget | null) => {
    if (!isUntouched(ex) || !ex.name.trim()) return
    const last = lastEntryFor(history, ex.name)
    if (!last) return
    const el = nextFocus instanceof HTMLElement ? nextFocus : null
    const field = el?.closest('[data-exercise]')?.getAttribute('data-exercise') === ex.key ? el?.dataset.field : undefined
    updateExercise(ex.key, (e) => {
      const next: ExerciseDraft = { ...entryToDraft(last, units), key: e.key, name: e.name }
      next.sets = next.sets.map((s, i) => ({ ...s, key: e.sets[i]?.key ?? s.key }))
      if (field === 'distance' || field === 'minutes' || field === 'seconds') next[field] = e[field]
      const m = field?.match(/^(reps|weight):(\d+)$/)
      if (m) {
        const [, prop, idx] = m as unknown as [string, 'reps' | 'weight', string]
        const i = Number(idx)
        if (next.sets[i]) next.sets[i] = { ...next.sets[i], [prop]: e.sets[i]?.[prop] ?? '' }
      }
      return next
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const workout: Workout = {
      id: editing?.id ?? newId(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      date,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      exercises: exercises.map((d) => draftToEntry(d, units)),
    }
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

      {exercises.map((ex, i) => {
        const n = i + 1
        const durationSec = draftDuration(ex)
        const distKm = toKm(num(ex.distance), units.distance)
        const pace = ex.kind === 'cardio' && durationSec > 0 && distKm > 0 ? formatPace(durationSec / distKm, units.distance) : ''
        return (
          <fieldset key={ex.key} className="exercise card" data-exercise={ex.key}>
            <legend className="sr-only">Exercise {n}</legend>
            <div className="kind-toggle" role="group" aria-label={`Exercise ${n} type`}>
              {(['strength', 'cardio'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={ex.kind === k}
                  onClick={() => updateExercise(ex.key, (x) => ({ ...x, kind: k }))}
                >
                  {k === 'strength' ? 'Weights' : 'Cardio'}
                </button>
              ))}
            </div>
            <div className="exercise-head">
              <input
                aria-label={`Exercise ${n} name`}
                placeholder={ex.kind === 'cardio' ? 'Activity, e.g. Run' : 'Exercise, e.g. Bench Press'}
                list={listId}
                value={ex.name}
                autoCapitalize="words"
                onChange={(e) => updateExercise(ex.key, (x) => ({ ...x, name: e.target.value }))}
                onBlur={(e) => prefill(ex, e.relatedTarget)}
              />
              {exercises.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove exercise ${n}`}
                  onClick={() => setExercises((xs) => xs.filter((x) => x.key !== ex.key))}
                >
                  ✕
                </button>
              )}
            </div>

            {ex.kind === 'cardio' ? (
              <>
                <div className="cardio-row set-head" aria-hidden>
                  <span>Distance ({units.distance})</span>
                  <span>Min</span>
                  <span>Sec</span>
                </div>
                <div className="cardio-row">
                  <input
                    aria-label={`Exercise ${n} distance`}
                    data-field="distance"
                    inputMode="decimal"
                    placeholder="optional"
                    value={ex.distance}
                    onChange={(e) => updateExercise(ex.key, (x) => ({ ...x, distance: e.target.value }))}
                  />
                  <input
                    aria-label={`Exercise ${n} minutes`}
                    data-field="minutes"
                    inputMode="numeric"
                    value={ex.minutes}
                    onChange={(e) => updateExercise(ex.key, (x) => ({ ...x, minutes: e.target.value }))}
                  />
                  <input
                    aria-label={`Exercise ${n} seconds`}
                    data-field="seconds"
                    inputMode="numeric"
                    placeholder="0"
                    value={ex.seconds}
                    onChange={(e) => updateExercise(ex.key, (x) => ({ ...x, seconds: e.target.value }))}
                  />
                </div>
                {pace && <p className="muted pace">Pace {pace}</p>}
              </>
            ) : (
              <>
                <div className="sets">
                  <div className="set-row set-head" aria-hidden>
                    <span>Set</span>
                    <span>Reps</span>
                    <span>Weight ({units.weight})</span>
                    <span />
                  </div>
                  {ex.sets.map((s, j) => (
                    <div className="set-row" key={s.key}>
                      <span className="set-num">{j + 1}</span>
                      <input
                        aria-label={`Exercise ${n} set ${j + 1} reps`}
                        data-field={`reps:${j}`}
                        inputMode="numeric"
                        value={s.reps}
                        onChange={(e) => updateSet(ex.key, s.key, { reps: e.target.value })}
                      />
                      <input
                        aria-label={`Exercise ${n} set ${j + 1} weight`}
                        data-field={`weight:${j}`}
                        inputMode="decimal"
                        placeholder="0"
                        value={s.weight}
                        onChange={(e) => updateSet(ex.key, s.key, { weight: e.target.value })}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove exercise ${n} set ${j + 1}`}
                        disabled={ex.sets.length === 1}
                        onClick={() =>
                          updateExercise(ex.key, (x) => ({ ...x, sets: x.sets.filter((y) => y.key !== s.key) }))
                        }
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
              </>
            )}
          </fieldset>
        )
      })}

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
