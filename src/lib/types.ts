/** A single working set. Weight is always stored in kilograms. */
export interface WorkoutSet {
  reps: number
  weightKg: number
}

/** Weights exercise. `kind` is absent on entries saved before cardio existed. */
export interface StrengthEntry {
  kind?: 'strength'
  /** Exercise name as typed, e.g. "Bench Press". Matched case-insensitively. */
  name: string
  sets: WorkoutSet[]
}

/** Cardio activity. Distance is always stored in kilometres and is optional (e.g. a spin class). */
export interface CardioEntry {
  kind: 'cardio'
  name: string
  durationSec: number
  distanceKm?: number
}

export type ExerciseEntry = StrengthEntry | CardioEntry
export type ExerciseKind = 'strength' | 'cardio'

export interface Workout {
  id: string
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  notes?: string
  exercises: ExerciseEntry[]
  /** ISO timestamp of when the record was created. */
  createdAt: string
}

export type WeightUnit = 'kg' | 'lb'
export type DistanceUnit = 'km' | 'mi'
export interface Units {
  weight: WeightUnit
  distance: DistanceUnit
}
