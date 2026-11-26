import { openDB } from 'idb'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetForTests,
  clearProfile,
  deleteBodyWeight,
  deleteRoutine,
  deleteWorkout,
  exportBackup,
  importBackup,
  getProfile,
  listBodyWeights,
  listRoutines,
  listWorkouts,
  saveBodyWeight,
  saveProfile,
  saveRoutine,
  saveWorkout,
} from './db'
import type { Routine } from './types'
import { sets, workout } from '../test/fixtures'

const push: Routine = {
  id: 'r1',
  name: 'Push day',
  days: [1, 4],
  exercises: [{ name: 'Bench Press', kind: 'strength' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const me = { name: 'Alex', heightCm: 180, updatedAt: '2026-01-01T00:00:00.000Z' }

beforeEach(async () => {
  await _resetForTests()
  globalThis.indexedDB = new IDBFactory()
})

describe('db', () => {
  it('saves, updates, lists and deletes workouts', async () => {
    const w = workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100]) }])
    await saveWorkout(w)
    await saveWorkout({ ...w, notes: 'felt good' })
    expect(await listWorkouts()).toEqual([{ ...w, notes: 'felt good' }])
    await deleteWorkout(w.id)
    expect(await listWorkouts()).toEqual([])
  })

  it('saves, lists and deletes routines', async () => {
    await saveRoutine(push)
    expect(await listRoutines()).toEqual([push])
    await deleteRoutine(push.id)
    expect(await listRoutines()).toEqual([])
  })

  it('upgrades a version-1 database without losing workouts', async () => {
    const w = workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100]) }])
    const v1 = await openDB('fitness-tracker', 1, {
      upgrade(d) {
        d.createObjectStore('workouts', { keyPath: 'id' }).createIndex('byDate', 'date')
      },
    })
    await v1.put('workouts', w)
    v1.close()

    expect(await listWorkouts()).toEqual([w])
    expect(await listRoutines()).toEqual([])
    await saveRoutine(push)
    expect(await listRoutines()).toEqual([push])
  })

  it('exports and re-imports a backup, including routines', async () => {
    const a = workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100]) }])
    const b = workout('2026-01-02', [{ name: 'Bench', sets: sets([5, 70]) }])
    await saveWorkout(a)
    await saveWorkout(b)
    await saveRoutine(push)
    await saveProfile(me)
    await saveBodyWeight({ date: '2026-01-01', weightKg: 80 })
    const backup = JSON.parse(JSON.stringify(await exportBackup()))

    await _resetForTests()
    globalThis.indexedDB = new IDBFactory()
    expect(await importBackup(backup)).toEqual({ workouts: 2, routines: 1, bodyWeights: 1, profile: true })
    expect((await listWorkouts()).map((w) => w.id).sort()).toEqual([a.id, b.id].sort())
    expect(await listRoutines()).toEqual([push])
    expect(await getProfile()).toEqual(me)
    expect(await listBodyWeights()).toEqual([{ date: '2026-01-01', weightKg: 80 }])
  })

  it('imports older backups that have no routines', async () => {
    const backup = { app: 'fitness-tracker', version: 1, workouts: [workout('2026-01-01', [])] }
    expect(await importBackup(backup)).toEqual({ workouts: 1, routines: 0, bodyWeights: 0, profile: false })
  })

  it('rejects invalid backups without writing anything', async () => {
    await expect(importBackup({ foo: 1 })).rejects.toThrow('not a Fitness Tracker backup')
    await expect(
      importBackup({ app: 'fitness-tracker', version: 1, workouts: [workout('2026-01-01', []), { bad: true }] }),
    ).rejects.toThrow('Workout #2')
    await expect(
      importBackup({ app: 'fitness-tracker', version: 1, workouts: [], routines: [{ ...push, days: 'Mon' }] }),
    ).rejects.toThrow('Routine #1')
    expect(await listWorkouts()).toEqual([])
    expect(await listRoutines()).toEqual([])
  })

  it('stores one profile and one weigh-in per day', async () => {
    expect(await getProfile()).toBeUndefined()
    await saveProfile(me)
    await saveProfile({ ...me, name: 'Alexander' })
    expect(await getProfile()).toEqual({ ...me, name: 'Alexander' })
    await saveBodyWeight({ date: '2026-01-02', weightKg: 81 })
    await saveBodyWeight({ date: '2026-01-02', weightKg: 80.5 })
    await saveBodyWeight({ date: '2026-01-09', weightKg: 80 })
    expect(await listBodyWeights()).toEqual([
      { date: '2026-01-02', weightKg: 80.5 },
      { date: '2026-01-09', weightKg: 80 },
    ])
    await deleteBodyWeight('2026-01-09')
    expect(await listBodyWeights()).toHaveLength(1)
    await saveWorkout(workout('2026-01-01', []))
    await clearProfile()
    expect(await getProfile()).toBeUndefined()
    expect(await listBodyWeights()).toEqual([])
    expect(await listWorkouts()).toHaveLength(1)
  })

  it('upgrades a version-2 database without losing workouts or routines', async () => {
    const w = workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100]) }])
    const v2 = await openDB('fitness-tracker', 2, {
      upgrade(d) {
        d.createObjectStore('workouts', { keyPath: 'id' }).createIndex('byDate', 'date')
        d.createObjectStore('routines', { keyPath: 'id' })
      },
    })
    await v2.put('workouts', w)
    await v2.put('routines', push)
    v2.close()
    expect(await listWorkouts()).toEqual([w])
    expect(await listRoutines()).toEqual([push])
    expect(await getProfile()).toBeUndefined()
    await saveProfile(me)
    expect(await getProfile()).toEqual(me)
  })

  it('rejects a malformed profile in a backup', async () => {
    await expect(
      importBackup({ app: 'fitness-tracker', version: 1, workouts: [], profile: { name: 3 } }),
    ).rejects.toThrow('profile')
    await expect(
      importBackup({ app: 'fitness-tracker', version: 1, workouts: [], bodyWeights: [{ date: 'x' }] }),
    ).rejects.toThrow('body weights')
  })
})
