import { DEFAULT_EXERCISES } from './defaultExercises'
import { isEquipment } from './equipment'
import { catalogKey, equipmentOf, exerciseCatalog, exerciseKey, isCardio, kindOf, type CatalogItem } from './stats'
import type { ExerciseEntry, Routine, RoutineExercise, RoutineInput, Workout } from './types'

/** Monday-first display order; `d` is the Date.getDay() value. */
export const DAYS = [
  { d: 1, short: 'Mon', long: 'Monday' },
  { d: 2, short: 'Tue', long: 'Tuesday' },
  { d: 3, short: 'Wed', long: 'Wednesday' },
  { d: 4, short: 'Thu', long: 'Thursday' },
  { d: 5, short: 'Fri', long: 'Friday' },
  { d: 6, short: 'Sat', long: 'Saturday' },
  { d: 0, short: 'Sun', long: 'Sunday' },
] as const

/** Weekday (0 = Sunday) of a YYYY-MM-DD date, or -1 if it isn't a valid date. */
export function weekdayOf(isoDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return -1
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()
  return Number.isNaN(day) ? -1 : day
}

export function formatDays(days: number[]): string {
  if (days.length === 0) return 'Any day'
  if (days.length === 7) return 'Every day'
  return DAYS.filter((x) => days.includes(x.d))
    .map((x) => x.short)
    .join(', ')
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ')

/** Trims names, drops blanks and keeps the first of any duplicates (same name, any casing, and equipment). */
export function dedupeExercises(items: RoutineExercise[]): RoutineExercise[] {
  const seen = new Set<string>()
  const out: RoutineExercise[] = []
  for (const item of items) {
    const name = cleanName(item.name)
    if (!exerciseKey(name)) continue
    const clean: RoutineExercise = {
      name,
      kind: item.kind,
      ...(item.kind === 'strength' && item.equipment ? { equipment: item.equipment } : {}),
    }
    const key = catalogKey(clean)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(clean)
  }
  return out
}

export function routineExercisesFrom(entries: ExerciseEntry[]): RoutineExercise[] {
  return dedupeExercises(
    entries.map((e) => {
      const equipment = isCardio(e) ? undefined : equipmentOf(e)
      return { name: e.name, kind: kindOf(e), ...(equipment ? { equipment } : {}) }
    }),
  )
}

/** Routines planned for `day` first, then the rest; A–Z within each group. */
export function sortRoutines(routines: Routine[], day = -1): Routine[] {
  return [...routines].sort(
    (a, b) =>
      Number(b.days.includes(day)) - Number(a.days.includes(day)) || a.name.localeCompare(b.name),
  )
}

export function findRoutineByName(routines: Routine[], name: string): Routine | undefined {
  const key = exerciseKey(name)
  return routines.find((r) => exerciseKey(r.name) === key)
}

export function validateRoutine(r: RoutineInput): string[] {
  const errors: string[] = []
  if (!r.name.trim()) errors.push('Give the routine a name.')
  if (r.exercises.length === 0) errors.push('Add at least one exercise.')
  if (r.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errors.push('Pick valid days.')
  return errors
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

export function isRoutine(v: unknown): v is Routine {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string' &&
    Array.isArray(v.days) &&
    v.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    Array.isArray(v.exercises) &&
    v.exercises.every(
      (e) =>
        isObj(e) &&
        typeof e.name === 'string' &&
        (e.kind === 'strength' || e.kind === 'cardio') &&
        (e.equipment === undefined || isEquipment(e.equipment)),
    )
  )
}

const DEFAULT_GROUP_BY_KEY = new Map(DEFAULT_EXERCISES.map((d) => [exerciseKey(d.name), d.group]))

/** Body part for an exercise: from the built-in list when the name matches, "Cardio" for any cardio. */
export function groupFor(item: CatalogItem): string | undefined {
  return DEFAULT_GROUP_BY_KEY.get(exerciseKey(item.name)) ?? (item.kind === 'cardio' ? 'Cardio' : undefined)
}

/**
 * Every exercise you've logged or put in a routine (`own`, sorted A–Z, logged history decides the type),
 * followed by built-in suggestions you haven't used yet. Each carries its body part when known.
 */
export function fullCatalog(workouts: Workout[], routines: Routine[], includeDefaults = true): CatalogItem[] {
  const items = exerciseCatalog(workouts)
  const keys = new Set(items.map(catalogKey))
  // Logged history decides whether a name is weights or cardio.
  const loggedKind = new Map(items.map((c) => [exerciseKey(c.name), c.kind]))
  for (const r of routines) {
    for (const e of dedupeExercises(r.exercises)) {
      const key = catalogKey(e)
      const kind = loggedKind.get(exerciseKey(e.name))
      if (!keys.has(key) && (kind === undefined || kind === e.kind)) {
        keys.add(key)
        items.push(e)
      }
    }
  }
  items.sort((a, b) => a.name.localeCompare(b.name))
  for (const [i, item] of items.entries()) {
    const group = groupFor(item)
    items[i] = { ...item, own: true, ...(group ? { group } : {}) }
  }
  if (includeDefaults) {
    for (const d of DEFAULT_EXERCISES) {
      if (!keys.has(catalogKey(d))) items.push({ ...d })
    }
  }
  return items
}
