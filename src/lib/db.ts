import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Workout } from './types'
import { isWorkout } from './validate'

interface FitnessDB extends DBSchema {
  workouts: { key: string; value: Workout; indexes: { byDate: string } }
}

const DB_NAME = 'fitness-tracker'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<FitnessDB>> | undefined

function db(): Promise<IDBPDatabase<FitnessDB>> {
  dbPromise ??= openDB<FitnessDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore('workouts', { keyPath: 'id' })
      store.createIndex('byDate', 'date')
    },
  })
  return dbPromise
}

/** Test helper: forget the cached connection so a fresh fake database can be used. */
export async function _resetForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close()
  dbPromise = undefined
}

export async function listWorkouts(): Promise<Workout[]> {
  return (await db()).getAll('workouts')
}

export async function saveWorkout(workout: Workout): Promise<void> {
  await (await db()).put('workouts', workout)
}

export async function deleteWorkout(id: string): Promise<void> {
  await (await db()).delete('workouts', id)
}

export interface Backup {
  app: 'fitness-tracker'
  version: 1
  exportedAt: string
  workouts: Workout[]
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'fitness-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: await listWorkouts(),
  }
}

/**
 * Merges workouts from a backup into the database (same id = replaced).
 * Throws if the file is not a valid backup; nothing is written in that case.
 */
export async function importBackup(data: unknown): Promise<number> {
  const b = data as Partial<Backup> | null
  if (!b || b.app !== 'fitness-tracker' || !Array.isArray(b.workouts)) {
    throw new Error('This file is not a Fitness Tracker backup.')
  }
  const bad = b.workouts.findIndex((w) => !isWorkout(w))
  if (bad !== -1) throw new Error(`Workout #${bad + 1} in the backup is malformed.`)
  const tx = (await db()).transaction('workouts', 'readwrite')
  await Promise.all([...b.workouts.map((w) => tx.store.put(w)), tx.done])
  return b.workouts.length
}
