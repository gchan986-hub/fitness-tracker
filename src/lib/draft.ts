/** The workout being logged, saved on the device as you go so it survives the app being closed. */

const KEY = 'fitness-tracker:draft'

export interface SavedDraft<E> {
  date: string
  notes: string
  routineName: string
  exercises: E[]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Shape check only: enough to be safe to render. */
function looksLikeExercise(e: unknown): boolean {
  return (
    isObj(e) &&
    typeof e.key === 'string' &&
    (e.kind === 'strength' || e.kind === 'cardio') &&
    typeof e.name === 'string' &&
    Array.isArray(e.sets) &&
    e.sets.every((s) => isObj(s) && typeof s.key === 'string' && typeof s.reps === 'string' && typeof s.weight === 'string') &&
    ['distance', 'minutes', 'seconds'].every((k) => typeof e[k] === 'string')
  )
}

export function readDraft<E>(): SavedDraft<E> | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (
      isObj(v) &&
      typeof v.date === 'string' &&
      typeof v.notes === 'string' &&
      typeof v.routineName === 'string' &&
      Array.isArray(v.exercises) &&
      v.exercises.every(looksLikeExercise)
    ) {
      return v as unknown as SavedDraft<E>
    }
  } catch {
    /* unreadable: start fresh */
  }
  return null
}

/** Saves the draft, or removes it when there's nothing worth keeping. */
export function saveDraft<E>(draft: SavedDraft<E>): void {
  try {
    if (draft.exercises.length === 0 && !draft.notes.trim() && !draft.routineName) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    /* storage full or blocked: the draft just won't survive a reload */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
