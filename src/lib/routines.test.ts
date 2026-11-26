import { describe, expect, it } from 'vitest'
import {
  dedupeExercises,
  findRoutineByName,
  formatDays,
  fullCatalog,
  isRoutine,
  routineExercisesFrom,
  sortRoutines,
  validateRoutine,
  weekdayOf,
} from './routines'
import type { Routine } from './types'
import { cardio, sets, workout } from '../test/fixtures'

const routine = (name: string, days: number[], exercises: Routine['exercises'] = []): Routine => ({
  id: name,
  name,
  days,
  exercises,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('weekdayOf', () => {
  it('uses the local calendar date', () => {
    expect(weekdayOf('2026-11-23')).toBe(1) // Monday
    expect(weekdayOf('2026-11-29')).toBe(0) // Sunday
    expect(weekdayOf('')).toBe(-1)
  })
})

describe('formatDays', () => {
  it('lists days Monday-first', () => {
    expect(formatDays([4, 1])).toBe('Mon, Thu')
    expect(formatDays([0, 6])).toBe('Sat, Sun')
    expect(formatDays([])).toBe('Any day')
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day')
  })
})

describe('dedupeExercises / routineExercisesFrom', () => {
  it('trims, drops blanks and duplicates, keeps order and type', () => {
    expect(
      dedupeExercises([
        { name: ' Bench  Press ', kind: 'strength' },
        { name: '', kind: 'strength' },
        { name: 'bench press', kind: 'strength' },
        { name: 'Run', kind: 'cardio' },
      ]),
    ).toEqual([
      { name: 'Bench Press', kind: 'strength' },
      { name: 'Run', kind: 'cardio' },
    ])
  })
  it('reads exercises from a logged workout', () => {
    const w = workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100]) }, cardio('Run', 600, 2)])
    expect(routineExercisesFrom(w.exercises)).toEqual([
      { name: 'Squat', kind: 'strength' },
      { name: 'Run', kind: 'cardio' },
    ])
  })
})

describe('sortRoutines', () => {
  it("puts the day's routines first, then A–Z", () => {
    const rs = [routine('Legs', [3]), routine('Push', [1, 4]), routine('Arms', []), routine('Pull', [1])]
    expect(sortRoutines(rs, 1).map((r) => r.name)).toEqual(['Pull', 'Push', 'Arms', 'Legs'])
    expect(sortRoutines(rs).map((r) => r.name)).toEqual(['Arms', 'Legs', 'Pull', 'Push'])
  })
})

describe('findRoutineByName', () => {
  it('ignores case and spacing', () => {
    expect(findRoutineByName([routine('Push Day', [])], ' push  day')?.id).toBe('Push Day')
    expect(findRoutineByName([routine('Push Day', [])], 'Pull')).toBeUndefined()
  })
})

describe('validateRoutine / isRoutine', () => {
  it('needs a name and an exercise', () => {
    expect(validateRoutine({ name: ' ', days: [], exercises: [] })).toEqual([
      'Give the routine a name.',
      'Add at least one exercise.',
    ])
    expect(validateRoutine({ name: 'Push', days: [1], exercises: [{ name: 'Bench', kind: 'strength' }] })).toEqual([])
  })
  it('checks imported routines', () => {
    expect(isRoutine(routine('Push', [1], [{ name: 'Bench', kind: 'strength' }]))).toBe(true)
    expect(isRoutine({ ...routine('Push', [9]) })).toBe(false)
    expect(isRoutine({ ...routine('Push', [1]), exercises: [{ name: 'X', kind: 'yoga' }] })).toBe(false)
  })
})

describe('fullCatalog', () => {
  it('merges logged exercises with routine-only ones', () => {
    const ws = [workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100]) }])]
    const rs = [routine('Mix', [], [{ name: 'squat', kind: 'cardio' }, { name: 'Row', kind: 'cardio' }])]
    expect(fullCatalog(ws, rs, false)).toEqual([
      { name: 'Row', kind: 'cardio', own: true, group: 'Cardio' },
      { name: 'Squat', kind: 'strength', own: true, group: 'Legs' },
    ])
  })
  it('appends built-in suggestions you have not used, without duplicating yours', () => {
    const ws = [workout('2026-01-01', [{ name: 'squat', sets: sets([5, 100]) }, cardio('RUN', 1500, 5)])]
    const cat = fullCatalog(ws, [])
    expect(cat.slice(0, 2)).toEqual([
      { name: 'RUN', kind: 'cardio', own: true, group: 'Cardio' },
      { name: 'squat', kind: 'strength', own: true, group: 'Legs' },
    ])
    const names = cat.map((c) => c.name.toLowerCase())
    expect(names.filter((n) => n === 'squat')).toHaveLength(1)
    expect(names.filter((n) => n === 'run')).toHaveLength(1)
    expect(cat.find((c) => c.name === 'Bench Press')).toEqual({ name: 'Bench Press', kind: 'strength', group: 'Chest' })
    expect(cat.find((c) => c.name === 'Swim')).toEqual({ name: 'Swim', kind: 'cardio', group: 'Cardio' })
  })
})
