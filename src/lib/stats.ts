import type { Workout, WorkoutSet } from './types'

/** Canonical key used to group the same exercise typed with different casing/spacing. */
export function exerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Estimated one-rep max using the Epley formula. A single rep returns the weight itself. */
export function estimateOneRepMax({ reps, weightKg }: WorkoutSet): number {
  if (reps <= 0 || weightKg <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function setVolume({ reps, weightKg }: WorkoutSet): number {
  return reps * weightKg
}

export function workoutVolume(workout: Workout): number {
  return workout.exercises.reduce(
    (total, ex) => total + ex.sets.reduce((s, set) => s + setVolume(set), 0),
    0,
  )
}

/** Distinct exercise names (first-seen spelling, most recent workout first), sorted A–Z. */
export function exerciseNames(workouts: Workout[]): string[] {
  const byKey = new Map<string, string>()
  for (const w of sortByDateDesc(workouts)) {
    for (const ex of w.exercises) {
      const key = exerciseKey(ex.name)
      if (key && !byKey.has(key)) byKey.set(key, ex.name.trim())
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

export function sortByDateDesc(workouts: Workout[]): Workout[] {
  return [...workouts].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}

export interface ProgressPoint {
  date: string
  /** Heaviest weight lifted that day (kg). */
  topWeightKg: number
  /** Best estimated 1RM that day (kg). */
  est1RmKg: number
  /** Total reps × weight that day (kg). */
  volumeKg: number
}

/** One point per date for the given exercise, oldest first. */
export function progressFor(workouts: Workout[], exerciseName: string): ProgressPoint[] {
  const key = exerciseKey(exerciseName)
  const byDate = new Map<string, ProgressPoint>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (exerciseKey(ex.name) !== key) continue
      for (const set of ex.sets) {
        const p = byDate.get(w.date) ?? { date: w.date, topWeightKg: 0, est1RmKg: 0, volumeKg: 0 }
        p.topWeightKg = Math.max(p.topWeightKg, set.weightKg)
        p.est1RmKg = Math.max(p.est1RmKg, estimateOneRepMax(set))
        p.volumeKg += setVolume(set)
        byDate.set(w.date, p)
      }
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface PersonalRecords {
  heaviest?: { weightKg: number; reps: number; date: string }
  bestEst1Rm?: { est1RmKg: number; weightKg: number; reps: number; date: string }
  mostVolumeInDay?: { volumeKg: number; date: string }
}

/** All-time bests for an exercise. Ties go to the earliest date (when the record was first set). */
export function personalRecords(workouts: Workout[], exerciseName: string): PersonalRecords {
  const key = exerciseKey(exerciseName)
  const prs: PersonalRecords = {}
  const ordered = [...workouts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  )
  for (const w of ordered) {
    for (const ex of w.exercises) {
      if (exerciseKey(ex.name) !== key) continue
      for (const set of ex.sets) {
        if (set.reps <= 0 || set.weightKg <= 0) continue
        if (!prs.heaviest || set.weightKg > prs.heaviest.weightKg) {
          prs.heaviest = { weightKg: set.weightKg, reps: set.reps, date: w.date }
        }
        const e = estimateOneRepMax(set)
        if (!prs.bestEst1Rm || e > prs.bestEst1Rm.est1RmKg) {
          prs.bestEst1Rm = { est1RmKg: e, weightKg: set.weightKg, reps: set.reps, date: w.date }
        }
      }
    }
  }
  for (const p of progressFor(workouts, exerciseName)) {
    if (p.volumeKg > 0 && (!prs.mostVolumeInDay || p.volumeKg > prs.mostVolumeInDay.volumeKg)) {
      prs.mostVolumeInDay = { volumeKg: p.volumeKg, date: p.date }
    }
  }
  return prs
}

/** Most recent sets logged for an exercise, to pre-fill the next session. */
export function lastSetsFor(workouts: Workout[], exerciseName: string): WorkoutSet[] | undefined {
  const key = exerciseKey(exerciseName)
  for (const w of sortByDateDesc(workouts)) {
    const ex = w.exercises.find((e) => exerciseKey(e.name) === key)
    if (ex && ex.sets.length) return ex.sets.map((s) => ({ ...s }))
  }
  return undefined
}
