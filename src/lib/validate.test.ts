import { describe, expect, it } from 'vitest'
import { isWorkout, validateWorkout } from './validate'
import { cardio, sets, workout } from '../test/fixtures'

describe('validateWorkout', () => {
  it('accepts a normal workout, including bodyweight (0 kg) sets', () => {
    expect(validateWorkout(workout('2026-01-01', [{ name: 'Pull-up', sets: sets([8, 0]) }]))).toEqual([])
  })
  it('reports each problem', () => {
    const errs = validateWorkout(
      workout('not-a-date', [
        { name: ' ', sets: [] },
        { name: 'Squat', sets: sets([0, 100], [5, -1]) },
      ]),
    )
    expect(errs).toEqual([
      'Pick a valid date.',
      'Exercise 1 needs a name.',
      'Exercise 1 needs at least one set.',
      'Squat, set 1: reps must be a whole number from 1 to 1000.',
      'Squat, set 2: weight must be 0 or more.',
    ])
  })
  it('requires an exercise', () => {
    expect(validateWorkout(workout('2026-01-01', []))).toContain('Add at least one exercise.')
  })
})

describe('validateWorkout (cardio)', () => {
  it('accepts cardio with or without a distance', () => {
    expect(validateWorkout(workout('2026-01-01', [cardio('Run', 1500, 5), cardio('Spin class', 2700)]))).toEqual([])
  })
  it('requires a time and a positive distance', () => {
    expect(validateWorkout(workout('2026-01-01', [cardio('Run', NaN, 0)]))).toEqual([
      'Run: enter a time (minutes, and seconds 0–59).',
      'Run: distance must be more than 0, or left blank.',
    ])
  })
})

describe('isWorkout', () => {
  it('accepts cardio entries and old entries without a kind', () => {
    expect(isWorkout(workout('2026-01-01', [cardio('Run', 1500, 5), { name: 'Row', sets: sets([5, 50]) }]))).toBe(true)
    expect(isWorkout(workout('2026-01-01', [{ kind: 'cardio', name: 'Run' } as never]))).toBe(false)
    expect(isWorkout(workout('2026-01-01', [{ name: 'Row', equipment: 'cable', sets: sets([5, 50]) }]))).toBe(true)
    expect(isWorkout(workout('2026-01-01', [{ name: 'Row', equipment: 'spoon' as never, sets: [] }]))).toBe(false)
  })
  it('accepts a workout and rejects junk', () => {
    expect(isWorkout(workout('2026-01-01', [{ name: 'Row', sets: sets([5, 50]) }]))).toBe(true)
    expect(isWorkout(null)).toBe(false)
    expect(isWorkout({ id: 'x', date: '2026-01-01', createdAt: 'x', exercises: [{ name: 'Row', sets: [{ reps: '5' }] }] })).toBe(false)
  })
})
