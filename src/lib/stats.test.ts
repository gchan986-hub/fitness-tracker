import { describe, expect, it } from 'vitest'
import {
  cardioProgressFor,
  cardioRecords,
  equipmentOf,
  estimateOneRepMax,
  exerciseCatalog,
  exerciseKey,
  lastEntryFor,
  personalRecords,
  progressFor,
  sortByDateDesc,
  workoutDistanceKm,
  workoutVolume,
} from './stats'
import type { CardioEntry, StrengthEntry } from './types'
import { cardio, sets, workout } from '../test/fixtures'

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

describe('exerciseCatalog', () => {
  it('dedupes by key, keeps the most recent spelling and type, sorts A–Z', () => {
    const ws = [
      workout('2026-01-01', [{ name: 'bench press', sets: sets([5, 60]) }]),
      workout('2026-01-08', [
        { name: 'Bench Press', sets: sets([5, 62.5]) },
        { name: 'Deadlift', sets: sets([5, 120]) },
        cardio('Run', 1500, 5),
      ]),
    ]
    expect(exerciseCatalog(ws)).toEqual([
      { name: 'Bench Press', kind: 'strength', equipment: 'barbell' },
      { name: 'Deadlift', kind: 'strength', equipment: 'barbell' },
      { name: 'Run', kind: 'cardio' },
    ])
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

describe('lastEntryFor', () => {
  it('returns a copy of the most recent entry', () => {
    const old = workout('2026-01-01', [{ name: 'Row', sets: sets([10, 50]) }])
    const recent = workout('2026-01-08', [{ name: 'row', sets: sets([10, 55], [8, 55]) }])
    const result = lastEntryFor([old, recent], 'Row') as StrengthEntry
    expect(result.sets).toEqual(sets([10, 55], [8, 55]))
    result.sets[0].reps = 99
    expect((recent.exercises[0] as StrengthEntry).sets[0].reps).toBe(10)
  })
  it('returns cardio entries too', () => {
    const ws = [workout('2026-01-01', [cardio('Run', 1500, 5)])]
    expect(lastEntryFor(ws, 'run')).toEqual(cardio('Run', 1500, 5))
  })
  it('is undefined for a new exercise', () => {
    expect(lastEntryFor([], 'Row')).toBeUndefined()
  })
})

describe('cardio', () => {
  const ws = [
    workout('2026-01-01', [cardio('Run', 1800, 5), { name: 'Squat', sets: sets([5, 100]) }]),
    workout('2026-01-01', [cardio('run', 660, 2)]),
    workout('2026-01-05', [cardio('Run', 2400)]), // treadmill, no distance
    workout('2026-01-08', [cardio('Run', 1500, 5), cardio('Bike', 3600, 30)]),
  ]

  it('ignores cardio in weights volume and sums distance', () => {
    expect(workoutVolume(ws[0])).toBe(500)
    expect(workoutDistanceKm(ws[3])).toBe(35)
  })

  it('gives one point per day with average pace over entries that had a distance', () => {
    expect(cardioProgressFor(ws, 'Run')).toEqual([
      { date: '2026-01-01', distanceKm: 7, durationSec: 2460, paceSecPerKm: 2460 / 7 },
      { date: '2026-01-05', distanceKm: 0, durationSec: 2400 },
      { date: '2026-01-08', distanceKm: 5, durationSec: 1500, paceSecPerKm: 300 },
    ])
  })

  it('finds longest distance, fastest pace and longest time', () => {
    expect(cardioRecords(ws, 'Run')).toEqual({
      longestDistance: { distanceKm: 5, durationSec: 1800, date: '2026-01-01' },
      fastestPace: { paceSecPerKm: 300, distanceKm: 5, date: '2026-01-08' },
      longestDuration: { durationSec: 2400, date: '2026-01-05' },
    })
    expect(cardioRecords([], 'Run')).toEqual({})
  })

  it('keeps weights stats free of cardio entries with the same name', () => {
    const mixed = [workout('2026-01-01', [cardio('Row', 600, 2) as CardioEntry, { name: 'Row', sets: sets([10, 50]) }])]
    expect(progressFor(mixed, 'Row')).toHaveLength(1)
    expect(personalRecords(mixed, 'Row').heaviest?.weightKg).toBe(50)
  })
})

describe('equipment', () => {
  const ws = [
    workout('2026-01-01', [{ name: 'Bench Press', sets: sets([5, 80]) }]), // saved before equipment: barbell
    workout('2026-01-02', [{ name: 'Bench Press', equipment: 'dumbbell', sets: sets([10, 30]) }]),
    workout('2026-01-03', [{ name: 'Bench Press', equipment: 'barbell', sets: sets([5, 85]) }]),
    workout('2026-01-04', [{ name: 'Sled Push', sets: sets([1, 100]) }]), // no default equipment
  ]

  it('treats old entries as the default equipment for the name', () => {
    expect(equipmentOf({ name: 'Lateral Raise', sets: [] })).toBe('dumbbell')
    expect(equipmentOf({ name: 'Lateral Raise', equipment: 'cable', sets: [] })).toBe('cable')
    expect(equipmentOf({ name: 'Sled Push', sets: [] })).toBeUndefined()
  })

  it('keeps progress and records separate per equipment', () => {
    expect(progressFor(ws, 'Bench Press').map((p) => p.topWeightKg)).toEqual([80, 85])
    expect(progressFor(ws, 'Bench Press', 'barbell').map((p) => p.topWeightKg)).toEqual([80, 85])
    expect(progressFor(ws, 'Bench Press', 'dumbbell').map((p) => p.topWeightKg)).toEqual([30])
    expect(personalRecords(ws, 'Bench Press', 'dumbbell').heaviest?.weightKg).toBe(30)
    expect(progressFor(ws, 'Sled Push')).toHaveLength(1)
  })

  it('pre-fills from the matching equipment, or the latest on any equipment', () => {
    expect((lastEntryFor(ws, 'Bench Press', 'dumbbell') as StrengthEntry).sets[0].weightKg).toBe(30)
    expect((lastEntryFor(ws, 'Bench Press', 'barbell') as StrengthEntry).sets[0].weightKg).toBe(85)
    expect((lastEntryFor(ws, 'Bench Press') as StrengthEntry).sets[0].weightKg).toBe(85)
    expect(lastEntryFor(ws, 'Bench Press', 'cable')).toBeUndefined()
  })

  it('lists each equipment as its own catalog entry', () => {
    expect(exerciseCatalog(ws).map((c) => `${c.name}/${c.equipment ?? '-'}`)).toEqual([
      'Bench Press/barbell',
      'Bench Press/dumbbell',
      'Sled Push/-',
    ])
  })
})
