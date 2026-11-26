import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { isBodyWeight, isProfile } from './profile'
import { isRoutine } from './routines'
import type { BodyWeight, Profile, Routine, Workout } from './types'
import { isWorkout } from './validate'

interface FitnessDB extends DBSchema {
  workouts: { key: string; value: Workout; indexes: { byDate: string } }
  routines: { key: string; value: Routine }
  /** A single record under the key "me". */
  profile: { key: string; value: Profile }
  bodyWeights: { key: string; value: BodyWeight }
}

const DB_NAME = 'fitness-tracker'
/** v1: workouts. v2: routines. v3: profile and body weights. */
const DB_VERSION = 3
const PROFILE_KEY = 'me'

let dbPromise: Promise<IDBPDatabase<FitnessDB>> | undefined

function db(): Promise<IDBPDatabase<FitnessDB>> {
  dbPromise ??= openDB<FitnessDB>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore('workouts', { keyPath: 'id' })
        store.createIndex('byDate', 'date')
      }
      if (oldVersion < 2) database.createObjectStore('routines', { keyPath: 'id' })
      if (oldVersion < 3) {
        database.createObjectStore('profile')
        database.createObjectStore('bodyWeights', { keyPath: 'date' })
      }
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

/** Deletes every logged workout (routines are kept). */
export async function clearWorkouts(): Promise<void> {
  await (await db()).clear('workouts')
}

/** Deletes every routine (logged workouts are kept). */
export async function clearRoutines(): Promise<void> {
  await (await db()).clear('routines')
}

export async function getProfile(): Promise<Profile | undefined> {
  return (await db()).get('profile', PROFILE_KEY)
}

export async function saveProfile(profile: Profile): Promise<void> {
  await (await db()).put('profile', profile, PROFILE_KEY)
}

export async function listBodyWeights(): Promise<BodyWeight[]> {
  return (await db()).getAll('bodyWeights')
}

/** Adds a weigh-in, replacing any for the same day. */
export async function saveBodyWeight(entry: BodyWeight): Promise<void> {
  await (await db()).put('bodyWeights', entry)
}

export async function deleteBodyWeight(date: string): Promise<void> {
  await (await db()).delete('bodyWeights', date)
}

/** Deletes the profile and all weigh-ins (workouts and routines are kept). */
export async function clearProfile(): Promise<void> {
  const tx = (await db()).transaction(['profile', 'bodyWeights'], 'readwrite')
  await Promise.all([tx.objectStore('profile').clear(), tx.objectStore('bodyWeights').clear(), tx.done])
}

export async function listRoutines(): Promise<Routine[]> {
  return (await db()).getAll('routines')
}

export async function saveRoutine(routine: Routine): Promise<void> {
  await (await db()).put('routines', routine)
}

export async function deleteRoutine(id: string): Promise<void> {
  await (await db()).delete('routines', id)
}

export interface Backup {
  app: 'fitness-tracker'
  version: 1
  exportedAt: string
  workouts: Workout[]
  /** Absent in backups made before routines existed. */
  routines?: Routine[]
  /** Absent in backups made before profiles existed. */
  profile?: Profile
  bodyWeights?: BodyWeight[]
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'fitness-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: await listWorkouts(),
    routines: await listRoutines(),
    ...(await getProfile().then((profile) => (profile ? { profile } : {}))),
    bodyWeights: await listBodyWeights(),
  }
}

/**
 * Merges workouts and routines from a backup into the database (same id = replaced).
 * Throws if the file is not a valid backup; nothing is written in that case.
 */
export async function importBackup(
  data: unknown,
): Promise<{ workouts: number; routines: number; bodyWeights: number; profile: boolean }> {
  const b = data as Partial<Backup> | null
  if (!b || b.app !== 'fitness-tracker' || !Array.isArray(b.workouts)) {
    throw new Error('This file is not a Fitness Tracker backup.')
  }
  const bad = b.workouts.findIndex((w) => !isWorkout(w))
  if (bad !== -1) throw new Error(`Workout #${bad + 1} in the backup is malformed.`)
  const routines = b.routines ?? []
  if (!Array.isArray(routines)) throw new Error('The routines in the backup are malformed.')
  const badR = routines.findIndex((r) => !isRoutine(r))
  if (badR !== -1) throw new Error(`Routine #${badR + 1} in the backup is malformed.`)
  if (b.profile !== undefined && !isProfile(b.profile)) throw new Error('The profile in the backup is malformed.')
  const weights = b.bodyWeights ?? []
  if (!Array.isArray(weights) || !weights.every(isBodyWeight))
    throw new Error('The body weights in the backup are malformed.')

  const tx = (await db()).transaction(['workouts', 'routines', 'profile', 'bodyWeights'], 'readwrite')
  await Promise.all([
    ...b.workouts.map((w) => tx.objectStore('workouts').put(w)),
    ...routines.map((r) => tx.objectStore('routines').put(r)),
    ...(b.profile ? [tx.objectStore('profile').put(b.profile, PROFILE_KEY)] : []),
    ...weights.map((w) => tx.objectStore('bodyWeights').put(w)),
    tx.done,
  ])
  return { workouts: b.workouts.length, routines: routines.length, bodyWeights: weights.length, profile: !!b.profile }
}
