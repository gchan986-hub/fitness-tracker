import { useState } from 'react'
import { exerciseLabel } from '../lib/equipment'
import { validateRoutine } from '../lib/routines'
import type { RoutineExercise, RoutineInput } from '../lib/types'
import { DayPicker } from './DayPicker'

interface Props {
  exercises: RoutineExercise[]
  defaultName: string
  defaultDays: number[]
  /** Resolves true once saved (false if the user backed out of replacing an existing routine). */
  onSave: (input: RoutineInput) => Promise<boolean>
  onCancel: () => void
}

/** Inline panel that names a list of exercises and saves it as a routine. */
export function SaveRoutinePanel({ exercises, defaultName, defaultDays, onSave, onCancel }: Props) {
  const [name, setName] = useState(defaultName)
  const [days, setDays] = useState(defaultDays)
  const [errors, setErrors] = useState<string[]>([])

  const save = async () => {
    const input = { name: name.trim(), days, exercises }
    const problems = validateRoutine(input)
    setErrors(problems)
    if (problems.length === 0) await onSave(input)
  }

  return (
    <div className="card save-routine" role="group" aria-label="Save as routine">
      <h3>Save as routine</h3>
      <label className="field">
        Routine name
        <input value={name} placeholder="e.g. Push day" onChange={(e) => setName(e.target.value)} />
      </label>
      <DayPicker value={days} onChange={setDays} />
      <p className="muted">
        {exercises.length ? exercises.map((e) => exerciseLabel(e.name, e.equipment)).join(', ') : 'No exercises named yet.'}
      </p>
      <p className="muted">Only the exercises are saved. Next time, they’re filled in with your latest numbers.</p>
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
    </div>
  )
}
