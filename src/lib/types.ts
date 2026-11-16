/** A single working set. Weight is always stored in kilograms. */
export interface WorkoutSet {
  reps: number
  weightKg: number
}

export interface ExerciseEntry {
  /** Exercise name as typed, e.g. "Bench Press". Matched case-insensitively. */
  name: string
  sets: WorkoutSet[]
}

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
