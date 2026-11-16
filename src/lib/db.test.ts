import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { _resetForTests, deleteWorkout, exportBackup, importBackup, listWorkouts, saveWorkout } from './db'
import { sets, workout } from '../test/fixtures'

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

  it('exports and re-imports a backup', async () => {
    const a = workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100]) }])
    const b = workout('2026-01-02', [{ name: 'Bench', sets: sets([5, 70]) }])
    await saveWorkout(a)
    await saveWorkout(b)
    const backup = JSON.parse(JSON.stringify(await exportBackup()))

    await _resetForTests()
    globalThis.indexedDB = new IDBFactory()
    expect(await importBackup(backup)).toBe(2)
    expect((await listWorkouts()).map((w) => w.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('rejects invalid backups without writing anything', async () => {
    await expect(importBackup({ foo: 1 })).rejects.toThrow('not a Fitness Tracker backup')
    await expect(
      importBackup({ app: 'fitness-tracker', version: 1, workouts: [workout('2026-01-01', []), { bad: true }] }),
    ).rejects.toThrow('Workout #2')
    expect(await listWorkouts()).toEqual([])
  })
})
