import { describe, expect, it } from 'vitest'
import {
  estimateOneRepMax,
  exerciseKey,
  exerciseNames,
  lastSetsFor,
  personalRecords,
  progressFor,
  sortByDateDesc,
  workoutVolume,
} from './stats'
import { sets, workout } from '../test/fixtures'

describe('exerciseKey', () => {
  it('ignores case and extra spaces', () => {
    expect(exerciseKey('  Bench   Press ')).toBe(exerciseKey('bench press'))
  })
})

describe('estimateOneRepMax', () => {
  it('uses the Epley formula', () => {
    expect(estimateOneRepMax({ reps: 5, weightKg: 100 })).toBeCloseTo(116.67, 2)
  })
  it('returns the weight for a single rep and 0 for empty sets', () => {
    expect(estimateOneRepMax({ reps: 1, weightKg: 140 })).toBe(140)
    expect(estimateOneRepMax({ reps: 0, weightKg: 100 })).toBe(0)
    expect(estimateOneRepMax({ reps: 10, weightKg: 0 })).toBe(0)
  })
})

describe('workoutVolume', () => {
  it('sums reps × weight across exercises', () => {
    const w = workout('2026-01-01', [
      { name: 'Squat', sets: sets([5, 100], [5, 100]) },
      { name: 'Row', sets: sets([10, 50]) },
    ])
    expect(workoutVolume(w)).toBe(1500)
  })
})

describe('exerciseNames', () => {
  it('dedupes by key, keeps the most recent spelling, sorts A–Z', () => {
    const ws = [
      workout('2026-01-01', [{ name: 'bench press', sets: sets([5, 60]) }]),
      workout('2026-01-08', [
        { name: 'Bench Press', sets: sets([5, 62.5]) },
        { name: 'Deadlift', sets: sets([5, 120]) },
      ]),
    ]
    expect(exerciseNames(ws)).toEqual(['Bench Press', 'Deadlift'])
  })
})

describe('sortByDateDesc', () => {
  it('orders newest first without mutating the input', () => {
    const ws = [workout('2026-01-01', []), workout('2026-03-01', []), workout('2026-02-01', [])]
    expect(sortByDateDesc(ws).map((w) => w.date)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01'])
    expect(ws[0].date).toBe('2026-01-01')
  })
})

describe('progressFor', () => {
  it('gives one point per date, oldest first, merging same-day workouts', () => {
    const ws = [
      workout('2026-01-08', [{ name: 'Squat', sets: sets([5, 105]) }]),
      workout('2026-01-01', [{ name: 'squat', sets: sets([5, 100], [3, 110]) }]),
      workout('2026-01-08', [{ name: 'Squat', sets: sets([1, 120]) }]),
      workout('2026-01-05', [{ name: 'Bench', sets: sets([5, 80]) }]),
    ]
    const p = progressFor(ws, 'SQUAT')
    expect(p.map((x) => x.date)).toEqual(['2026-01-01', '2026-01-08'])
    expect(p[0]).toMatchObject({ topWeightKg: 110, volumeKg: 830 })
    expect(p[0].est1RmKg).toBeCloseTo(121, 5)
    expect(p[1]).toMatchObject({ topWeightKg: 120, volumeKg: 645 })
  })
  it('is empty for an unknown exercise', () => {
    expect(progressFor([], 'Squat')).toEqual([])
  })
})

describe('personalRecords', () => {
  it('finds heaviest, best e1RM and best day volume', () => {
    const ws = [
      workout('2026-01-01', [{ name: 'Bench', sets: sets([10, 80], [8, 80]) }]),
      workout('2026-01-08', [{ name: 'Bench', sets: sets([1, 100]) }]),
    ]
    const pr = personalRecords(ws, 'bench')
    expect(pr.heaviest).toEqual({ weightKg: 100, reps: 1, date: '2026-01-08' })
    // 80 × (1 + 10/30) = 106.67 beats a 100 kg single
    expect(pr.bestEst1Rm).toMatchObject({ weightKg: 80, reps: 10, date: '2026-01-01' })
    expect(pr.mostVolumeInDay).toEqual({ volumeKg: 1440, date: '2026-01-01' })
  })
  it('credits ties to the date the record was first set', () => {
    const ws = [
      workout('2026-02-01', [{ name: 'Bench', sets: sets([5, 90]) }]),
      workout('2026-01-01', [{ name: 'Bench', sets: sets([5, 90]) }]),
    ]
    expect(personalRecords(ws, 'Bench').heaviest?.date).toBe('2026-01-01')
  })
  it('is empty when there is no data', () => {
    expect(personalRecords([], 'Bench')).toEqual({})
  })
})

describe('lastSetsFor', () => {
  it('returns a copy of the most recent sets', () => {
    const old = workout('2026-01-01', [{ name: 'Row', sets: sets([10, 50]) }])
    const recent = workout('2026-01-08', [{ name: 'row', sets: sets([10, 55], [8, 55]) }])
    const result = lastSetsFor([old, recent], 'Row')
    expect(result).toEqual(sets([10, 55], [8, 55]))
    result![0].reps = 99
    expect(recent.exercises[0].sets[0].reps).toBe(10)
  })
  it('is undefined for a new exercise', () => {
    expect(lastSetsFor([], 'Row')).toBeUndefined()
  })
})
