import type { CardioEntry, ExerciseEntry, ExerciseKind, StrengthEntry, Workout, WorkoutSet } from './types'

/** Canonical key used to group the same exercise typed with different casing/spacing. */
export function exerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export const isCardio = (e: ExerciseEntry): e is CardioEntry => e.kind === 'cardio'
export const kindOf = (e: ExerciseEntry): ExerciseKind => (isCardio(e) ? 'cardio' : 'strength')

function strengthEntries(w: Workout, key?: string): StrengthEntry[] {
  return w.exercises.filter(
    (e): e is StrengthEntry => !isCardio(e) && (key === undefined || exerciseKey(e.name) === key),
  )
}

function cardioEntries(w: Workout, key?: string): CardioEntry[] {
  return w.exercises.filter(
    (e): e is CardioEntry => isCardio(e) && (key === undefined || exerciseKey(e.name) === key),
  )
}

const oldestFirst = (workouts: Workout[]) =>
  [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))

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
  return strengthEntries(workout).reduce(
    (total, ex) => total + ex.sets.reduce((s, set) => s + setVolume(set), 0),
    0,
  )
}

export function workoutDistanceKm(workout: Workout): number {
  return cardioEntries(workout).reduce((total, ex) => total + (ex.distanceKm ?? 0), 0)
}

export interface CatalogItem {
  name: string
  kind: ExerciseKind
  /** Body area for built-in suggestions; absent for your own exercises. */
  group?: string
}

/** Distinct exercises (spelling and type from the most recent workout), sorted A–Z. */
export function exerciseCatalog(workouts: Workout[]): CatalogItem[] {
  const byKey = new Map<string, CatalogItem>()
  for (const w of sortByDateDesc(workouts)) {
    for (const ex of w.exercises) {
      const key = exerciseKey(ex.name)
      if (key && !byKey.has(key)) byKey.set(key, { name: ex.name.trim(), kind: kindOf(ex) })
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
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

/** One point per date for the given weights exercise, oldest first. */
export function progressFor(workouts: Workout[], exerciseName: string): ProgressPoint[] {
  const key = exerciseKey(exerciseName)
  const byDate = new Map<string, ProgressPoint>()
  for (const w of workouts) {
    for (const ex of strengthEntries(w, key)) {
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

/** All-time bests for a weights exercise. Ties go to the earliest date (when the record was first set). */
export function personalRecords(workouts: Workout[], exerciseName: string): PersonalRecords {
  const key = exerciseKey(exerciseName)
  const prs: PersonalRecords = {}
  for (const w of oldestFirst(workouts)) {
    for (const ex of strengthEntries(w, key)) {
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

export interface CardioPoint {
  date: string
  /** Total distance that day (km); 0 if none recorded. */
  distanceKm: number
  /** Total time that day (seconds). */
  durationSec: number
  /** Average pace over sessions that recorded a distance (seconds per km). */
  paceSecPerKm?: number
}

/** One point per date for the given cardio activity, oldest first. */
export function cardioProgressFor(workouts: Workout[], activity: string): CardioPoint[] {
  const key = exerciseKey(activity)
  const byDate = new Map<string, CardioPoint & { pacedKm: number; pacedSec: number }>()
  for (const w of workouts) {
    for (const ex of cardioEntries(w, key)) {
      const p = byDate.get(w.date) ?? { date: w.date, distanceKm: 0, durationSec: 0, pacedKm: 0, pacedSec: 0 }
      p.durationSec += ex.durationSec
      if (ex.distanceKm) {
        p.distanceKm += ex.distanceKm
        p.pacedKm += ex.distanceKm
        p.pacedSec += ex.durationSec
      }
      byDate.set(w.date, p)
    }
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ pacedKm, pacedSec, ...p }) => (pacedKm > 0 ? { ...p, paceSecPerKm: pacedSec / pacedKm } : p))
}

export interface CardioRecords {
  longestDistance?: { distanceKm: number; durationSec: number; date: string }
  fastestPace?: { paceSecPerKm: number; distanceKm: number; date: string }
  longestDuration?: { durationSec: number; date: string }
}

/** All-time bests for a cardio activity, per session. Ties go to the earliest date. */
export function cardioRecords(workouts: Workout[], activity: string): CardioRecords {
  const key = exerciseKey(activity)
  const r: CardioRecords = {}
  for (const w of oldestFirst(workouts)) {
    for (const ex of cardioEntries(w, key)) {
      if (ex.durationSec <= 0) continue
      if (!r.longestDuration || ex.durationSec > r.longestDuration.durationSec) {
        r.longestDuration = { durationSec: ex.durationSec, date: w.date }
      }
      if (!ex.distanceKm) continue
      if (!r.longestDistance || ex.distanceKm > r.longestDistance.distanceKm) {
        r.longestDistance = { distanceKm: ex.distanceKm, durationSec: ex.durationSec, date: w.date }
      }
      const pace = ex.durationSec / ex.distanceKm
      if (!r.fastestPace || pace < r.fastestPace.paceSecPerKm) {
        r.fastestPace = { paceSecPerKm: pace, distanceKm: ex.distanceKm, date: w.date }
      }
    }
  }
  return r
}

/** Most recent entry for an exercise (a copy), to pre-fill the next session. */
export function lastEntryFor(workouts: Workout[], exerciseName: string): ExerciseEntry | undefined {
  const key = exerciseKey(exerciseName)
  for (const w of sortByDateDesc(workouts)) {
    const ex = w.exercises.find((e) => exerciseKey(e.name) === key && (isCardio(e) || e.sets.length > 0))
    if (ex) return isCardio(ex) ? { ...ex } : { ...ex, sets: ex.sets.map((s) => ({ ...s })) }
  }
  return undefined
}
