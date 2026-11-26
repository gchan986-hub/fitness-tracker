import type { CardioEntry, ExerciseEntry, Workout } from '../lib/types'

let n = 0
export function workout(date: string, exercises: ExerciseEntry[], extra: Partial<Workout> = {}): Workout {
  n += 1
  return { id: `w${n}`, date, createdAt: `${date}T12:00:0${n % 10}.000Z`, exercises, ...extra }
}

export const sets = (...pairs: [reps: number, kg: number][]) =>
  pairs.map(([reps, weightKg]) => ({ reps, weightKg }))

export const cardio = (name: string, durationSec: number, distanceKm?: number): CardioEntry => ({
  kind: 'cardio',
  name,
  durationSec,
  ...(distanceKm === undefined ? {} : { distanceKm }),
})
