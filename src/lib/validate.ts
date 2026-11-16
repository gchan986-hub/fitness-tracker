import type { Workout } from './types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Returns a list of problems; an empty list means the workout is valid. */
export function validateWorkout(w: Workout): string[] {
  const errors: string[] = []
  if (!DATE_RE.test(w.date) || Number.isNaN(Date.parse(w.date))) errors.push('Pick a valid date.')
  if (w.exercises.length === 0) errors.push('Add at least one exercise.')
  w.exercises.forEach((ex, i) => {
    const label = ex.name.trim() || `Exercise ${i + 1}`
    if (!ex.name.trim()) errors.push(`Exercise ${i + 1} needs a name.`)
    if (ex.sets.length === 0) errors.push(`${label} needs at least one set.`)
    ex.sets.forEach((s, j) => {
      if (!Number.isInteger(s.reps) || s.reps < 1 || s.reps > 1000)
        errors.push(`${label}, set ${j + 1}: reps must be a whole number from 1 to 1000.`)
      if (!Number.isFinite(s.weightKg) || s.weightKg < 0 || s.weightKg > 2000)
        errors.push(`${label}, set ${j + 1}: weight must be 0 or more.`)
    })
  })
  return errors
}

/** Type guard used when importing a backup file. */
export function isWorkout(value: unknown): value is Workout {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.date === 'string' &&
    typeof v.createdAt === 'string' &&
    (v.notes === undefined || typeof v.notes === 'string') &&
    Array.isArray(v.exercises) &&
    v.exercises.every(
      (ex: unknown) =>
        typeof ex === 'object' &&
        ex !== null &&
        typeof (ex as Record<string, unknown>).name === 'string' &&
        Array.isArray((ex as Record<string, unknown>).sets) &&
        ((ex as { sets: unknown[] }).sets).every(
          (s: unknown) =>
            typeof s === 'object' &&
            s !== null &&
            typeof (s as Record<string, unknown>).reps === 'number' &&
            typeof (s as Record<string, unknown>).weightKg === 'number',
        ),
    )
  )
}
