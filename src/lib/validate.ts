import { isCardio } from './stats'
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
    if (isCardio(ex)) {
      if (!Number.isFinite(ex.durationSec) || ex.durationSec <= 0 || ex.durationSec > 86400)
        errors.push(`${label}: enter a time (minutes, and seconds 0–59).`)
      if (ex.distanceKm !== undefined && (!Number.isFinite(ex.distanceKm) || ex.distanceKm <= 0 || ex.distanceKm > 1000))
        errors.push(`${label}: distance must be more than 0, or left blank.`)
      return
    }
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

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function isEntry(ex: unknown): boolean {
  if (!isObj(ex) || typeof ex.name !== 'string') return false
  if (ex.kind === 'cardio') {
    return typeof ex.durationSec === 'number' && (ex.distanceKm === undefined || typeof ex.distanceKm === 'number')
  }
  return (
    (ex.kind === undefined || ex.kind === 'strength') &&
    Array.isArray(ex.sets) &&
    ex.sets.every((s) => isObj(s) && typeof s.reps === 'number' && typeof s.weightKg === 'number')
  )
}

/** Type guard used when importing a backup file. */
export function isWorkout(value: unknown): value is Workout {
  return (
    isObj(value) &&
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.notes === undefined || typeof value.notes === 'string') &&
    Array.isArray(value.exercises) &&
    value.exercises.every(isEntry)
  )
}
