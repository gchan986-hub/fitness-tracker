import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { newId, todayLocal } from '../lib/id'
import { dedupeExercises, sortRoutines, weekdayOf } from '../lib/routines'
import { EQUIPMENT, isEquipment } from '../lib/equipment'
import { catalogKey, equipmentOf, exerciseKey, isCardio, kindOf, lastEntryFor, type CatalogItem } from '../lib/stats'
import type { Equipment, ExerciseEntry, ExerciseKind, Routine, RoutineExercise, RoutineInput, Units, Workout } from '../lib/types'
import { formatPace, fromKg, fromKm, toKg, toKm } from '../lib/units'
import { validateWorkout } from '../lib/validate'
import { ExercisePicker } from './ExercisePicker'
import { SaveRoutinePanel } from './SaveRoutinePanel'

interface SetDraft {
  key: string
  reps: string
  weight: string
}
interface ExerciseDraft {
  key: string
  kind: ExerciseKind
  name: string
  /** Weights only. */
  equipment?: Equipment
  /** True once you've typed numbers in this card; until then it may be re-filled from history. */
  edited?: boolean
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
  const base: ExerciseDraft = { ...blankExercise(kindOf(ex)), name: ex.name }
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
    equipment: equipmentOf(ex),
    sets: ex.sets.map((s) => ({ key: newId(), reps: String(s.reps), weight: round(fromKg(s.weightKg, units.weight)) })),
  }
}

/** Weight column heading: dumbbells are logged per dumbbell, bodyweight as added weight. */
function weightHeading(equipment: Equipment | undefined, unit: string): string {
  if (equipment === 'dumbbell') return `Weight (${unit}, each)`
  if (equipment === 'bodyweight') return `Added (${unit})`
  return `Weight (${unit})`
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
    ...(d.equipment ? { equipment: d.equipment } : {}),
    sets: d.sets.map((s) => ({
      reps: num(s.reps),
      weightKg: s.weight.trim() === '' ? 0 : toKg(num(s.weight), units.weight),
    })),
  }
}

/** No numbers typed by you (numbers filled in from last time don't count). */
const isUntouched = (d: ExerciseDraft) => !d.edited

export interface WorkoutFormHandle {
  /** Replaces the form's exercises with a routine's (asks first if something has been entered). */
  loadRoutine: (r: Routine) => void
}

interface Props {
  units: Units
  history: Workout[]
  catalog: CatalogItem[]
  routines: Routine[]
  /** When set, the form edits this workout instead of creating a new one. */
  editing?: Workout
  onSave: (w: Workout) => Promise<void>
  onSaveRoutine: (input: RoutineInput) => Promise<boolean>
  onCancel?: () => void
  ref?: Ref<WorkoutFormHandle>
}

export function WorkoutForm({ units, history, catalog, routines, editing, onSave, onSaveRoutine, onCancel, ref }: Props) {
  const listId = useId()
  const [date, setDate] = useState(editing?.date ?? todayLocal())
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [exercises, setExercises] = useState<ExerciseDraft[]>(
    editing ? editing.exercises.map((ex) => ({ ...entryToDraft(ex, units), edited: true })) : [],
  )
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [routineName, setRoutineName] = useState(editing?.routineName ?? '')
  const [picking, setPicking] = useState(false)
  const [savingRoutine, setSavingRoutine] = useState(false)
  const day = weekdayOf(date)

  /** A card for a routine/catalog exercise, filled in with last session's numbers when the type matches. */
  const draftFor = (rx: RoutineExercise): ExerciseDraft => {
    const equipment = rx.kind === 'strength' ? rx.equipment : undefined
    const last = lastEntryFor(history, rx.name, equipment)
    if (last && kindOf(last) === rx.kind) return { ...entryToDraft(last, units), name: rx.name, equipment }
    return { ...blankExercise(rx.kind), name: rx.name, equipment }
  }

  /** Changing equipment on a card with no numbers yet fills in what you last did on that equipment. */
  const changeEquipment = (ex: ExerciseDraft, equipment: Equipment | undefined) => {
    const last = isUntouched(ex) && ex.name.trim() && equipment ? lastEntryFor(history, ex.name, equipment) : undefined
    updateExercise(ex.key, (e) =>
      last && !isCardio(last) ? { ...entryToDraft(last, units), key: e.key, name: e.name, equipment } : { ...e, equipment },
    )
  }

  const loadRoutine = (r: Routine) => {
    const dirty = exercises.some((x) => x.name.trim() || !isUntouched(x))
    if (dirty && !confirm(`Replace the exercises you've entered with "${r.name}"?`)) return
    setExercises(r.exercises.map(draftFor))
    setRoutineName(r.name)
    setErrors([])
    setPicking(false)
  }
  useImperativeHandle(ref, () => ({ loadRoutine }))

  /** Card to bring into view after the next render (a freshly added exercise). */
  const scrollTo = useRef<string | null>(null)
  useEffect(() => {
    if (!scrollTo.current) return
    document.querySelector(`[data-exercise="${scrollTo.current}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    scrollTo.current = null
  }, [exercises])

  /** Adds a picked exercise to the workout and closes the list. */
  const addFromCatalog = (item: CatalogItem) => {
    const d = draftFor(item)
    scrollTo.current = d.key
    setExercises((xs) => [...xs, d])
    setPicking(false)
  }

  const namedExercises = (): RoutineExercise[] =>
    dedupeExercises(exercises.map((x) => ({ name: x.name, kind: x.kind, equipment: x.equipment })))

  const updateExercise = (key: string, fn: (e: ExerciseDraft) => ExerciseDraft) =>
    setExercises((xs) => xs.map((x) => (x.key === key ? fn(x) : x)))

  const updateSet = (exKey: string, setKey: string, patch: Partial<SetDraft>) =>
    updateExercise(exKey, (x) => ({
      ...x,
      edited: true,
      sets: x.sets.map((y) => (y.key === setKey ? { ...y, ...patch } : y)),
    }))

  /**
   * When a known exercise is entered into an empty card, switch to its type and pre-fill last time's numbers.
   * Runs on blur, so `nextFocus` is the field being tapped: that field is left as it is (so typing into it doesn't
   * append to a pre-filled value) and inputs keep their identity (so the keyboard stays open).
   */
  const prefill = (ex: ExerciseDraft, nextFocus: EventTarget | null) => {
    if (!isUntouched(ex) || !ex.name.trim()) return
    const last = lastEntryFor(history, ex.name)
    if (!last) {
      // Never logged: just match the type of a known exercise (e.g. "Swim" switches to cardio).
      const known = catalog.find((c) => exerciseKey(c.name) === exerciseKey(ex.name))
      if (known) updateExercise(ex.key, (e) => ({ ...e, kind: known.kind, equipment: known.equipment }))
      return
    }
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
      ...(routineName ? { routineName } : {}),
      exercises: exercises.map((d) => draftToEntry(d, units)),
    }
    const problems = validateWorkout(workout)
    setErrors(problems)
    if (problems.length) return
    setSaving(true)
    try {
      await onSave(workout)
      if (!editing) {
        setExercises([])
        setNotes('')
        setRoutineName('')
        setSavingRoutine(false)
        setPicking(false)
      }
    } catch (err) {
      setErrors([`Could not save: ${(err as Error).message}`])
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="workout-form" onSubmit={submit} noValidate aria-label={editing ? 'Edit workout' : 'Log workout'}>
      <h2>{editing ? 'Edit workout' : 'Log workout'}</h2>
      <label className="field">
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>

      {!editing && routines.length > 0 && (
        <div className="routine-picker">
          <span className="muted">Start from a routine</span>
          <div className="chips">
            {sortRoutines(routines, day).map((r) => (
              <button
                key={r.id}
                type="button"
                className={r.days.includes(day) ? 'chip today' : 'chip'}
                onClick={() => loadRoutine(r)}
              >
                {r.name}
                {r.days.includes(day) && (
                  <>
                    {' '}
                    <span className="chip-tag">· Today</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {routineName && (
        <p className="routine-badge">
          <span>
            Routine: <strong>{routineName}</strong>
          </span>
          <button type="button" className="icon-btn" aria-label="Unlink routine" onClick={() => setRoutineName('')}>
            ✕
          </button>
        </p>
      )}

      <datalist id={listId}>
        {[...new Set(catalog.map((c) => c.name))].map((name) => (
          <option key={name} value={name} />
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
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove exercise ${n}`}
                onClick={() => setExercises((xs) => xs.filter((x) => x.key !== ex.key))}
              >
                ✕
              </button>
            </div>

            {ex.kind === 'strength' && (
              <label className="equipment-field">
                <span>Equipment</span>
                <select
                  aria-label={`Exercise ${n} equipment`}
                  value={ex.equipment ?? ''}
                  onChange={(e) => changeEquipment(ex, isEquipment(e.target.value) ? e.target.value : undefined)}
                >
                  <option value="">Not set</option>
                  {EQUIPMENT.map((q) => (
                    <option key={q.value} value={q.value}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
                    onChange={(e) => updateExercise(ex.key, (x) => ({ ...x, edited: true, distance: e.target.value }))}
                  />
                  <input
                    aria-label={`Exercise ${n} minutes`}
                    data-field="minutes"
                    inputMode="numeric"
                    value={ex.minutes}
                    onChange={(e) => updateExercise(ex.key, (x) => ({ ...x, edited: true, minutes: e.target.value }))}
                  />
                  <input
                    aria-label={`Exercise ${n} seconds`}
                    data-field="seconds"
                    inputMode="numeric"
                    placeholder="0"
                    value={ex.seconds}
                    onChange={(e) => updateExercise(ex.key, (x) => ({ ...x, edited: true, seconds: e.target.value }))}
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
                    <span>{weightHeading(ex.equipment, units.weight)}</span>
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
                          updateExercise(ex.key, (x) => ({ ...x, edited: true, sets: x.sets.filter((y) => y.key !== s.key) }))
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

      {exercises.length === 0 && (
        <p className="empty-log muted">
          {routines.length && !editing ? 'Start from a routine above, or add exercises one by one.' : 'No exercises yet.'}
        </p>
      )}
      <button type="button" className="add-exercise wide" onClick={() => setPicking(true)}>
        + Add exercise
      </button>
      {picking && (
        <ExercisePicker
          title="Add exercise"
          catalog={catalog}
          selected={exercises.map(catalogKey)}
          onPick={addFromCatalog}
          onClose={() => setPicking(false)}
        />
      )}

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

      {savingRoutine && (
        <SaveRoutinePanel
          exercises={namedExercises()}
          defaultName={routineName}
          defaultDays={day >= 0 ? [day] : []}
          onCancel={() => setSavingRoutine(false)}
          onSave={async (input) => {
            const saved = await onSaveRoutine(input)
            if (saved) {
              setSavingRoutine(false)
              setRoutineName(input.name)
            }
            return saved
          }}
        />
      )}

      <div className="actions">
        {!editing && !savingRoutine && (
          <button type="button" className="secondary push-left" onClick={() => setSavingRoutine(true)}>
            Save as routine
          </button>
        )}
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
