/** A single working set. Weight is always stored in kilograms. */
export interface WorkoutSet {
  reps: number
  weightKg: number
}

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'plate'
  | 'cable'
  | 'kettlebell'
  | 'smith'
  | 'bodyweight'
  | 'band'

/** Weights exercise. `kind` is absent on entries saved before cardio existed. */
export interface StrengthEntry {
  kind?: 'strength'
  /** Exercise name as typed, e.g. "Bench Press". Matched case-insensitively. */
  name: string
  /** Absent on entries saved before equipment existed; the built-in default for the name is assumed. */
  equipment?: Equipment
  /** Rest between sets chosen for this exercise; reused next time. Absent = the default from Settings. */
  restSec?: number
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
  /** Name of the routine this workout was started from, if any. */
  routineName?: string
  /** Length of the session in seconds, from the workout timer or entered when editing. */
  durationSec?: number
}

export interface RoutineExercise {
  name: string
  kind: ExerciseKind
  equipment?: Equipment
}

/** A saved group of exercises (no numbers: loading one fills in last session's numbers). */
export interface Routine {
  id: string
  name: string
  /** Weekdays it's planned for, as Date.getDay() values (0 = Sunday). Empty = any day. */
  days: number[]
  exercises: RoutineExercise[]
  createdAt: string
  updatedAt: string
}

export type RoutineInput = Pick<Routine, 'name' | 'days' | 'exercises'>

export type WeightUnit = 'kg' | 'lb'
export type DistanceUnit = 'km' | 'mi'
export interface Units {
  weight: WeightUnit
  distance: DistanceUnit
}
