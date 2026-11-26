/** Workout (session) timer: when the current session started, kept across reloads. */

const KEY = 'fitness-tracker:session-start'

export function readSessionStart(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY))
    return n > 0 ? n : null
  } catch {
    return null
  }
}

export function saveSessionStart(at: number | null): void {
  try {
    if (at === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, String(at))
  } catch {
    /* timer just won't survive a reload */
  }
}

/** 2700 → "45 min", 3900 → "1 h 5 min", 30 → "1 min". */
export function formatSessionLength(sec: number): string {
  const mins = Math.max(1, Math.round(sec / 60))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}
