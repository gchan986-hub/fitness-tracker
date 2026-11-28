import { useEffect, useRef, useState } from 'react'
import { countdownPip, restOverAlert, type RestState } from '../lib/rest'
import { formatDuration } from '../lib/units'

interface Props {
  rest: RestState
  sound: boolean
  /** Full-screen flash when rest is over. */
  flash?: boolean
  onAdjust: (deltaSec: number) => void
  onDismiss: () => void
}

/** Countdown bar shown above the tab bar between sets. */
export function RestTimer({ rest, sound, flash = true, onAdjust, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const alertedFor = useRef<number | null>(null)
  const pippedAt = useRef<string | null>(null)
  const repeats = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.ceil((rest.endAt - now) / 1000))
  const over = remaining === 0

  // 3-2-1 pips before the end (skipped for very short rests).
  useEffect(() => {
    const id = `${rest.endAt}:${remaining}`
    if (remaining >= 1 && remaining <= 3 && rest.totalSec > 5 && pippedAt.current !== id) {
      pippedAt.current = id
      countdownPip(sound)
    }
  }, [remaining, rest.endAt, rest.totalSec, sound])

  // Alert once per rest period, then repeat twice (sound only) unless dismissed.
  useEffect(() => {
    if (!over || alertedFor.current === rest.endAt) return
    alertedFor.current = rest.endAt
    repeats.current.forEach(clearTimeout)
    restOverAlert(sound)
    repeats.current = [2000, 4000].map((ms) => setTimeout(() => restOverAlert(sound, false), ms))
  }, [over, rest.endAt, sound])
  useEffect(() => () => repeats.current.forEach(clearTimeout), [])

  // Hide the "rest over" message after a while.
  useEffect(() => {
    if (!over) return
    const t = setTimeout(onDismiss, 15_000)
    return () => clearTimeout(t)
  }, [over, onDismiss])

  // Keep the screen on while counting down so the phone doesn't lock and silence the alert.
  useEffect(() => {
    if (over || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    let cancelled = false
    navigator.wakeLock
      .request('screen')
      .then((l) => (cancelled ? void l.release() : (lock = l)))
      .catch(() => {})
    return () => {
      cancelled = true
      void lock?.release()
    }
  }, [over])

  const pct = rest.totalSec > 0 ? Math.min(100, (remaining / rest.totalSec) * 100) : 0

  return (
    <>
      {over && flash && (
        <button type="button" className="rest-flash" aria-label="Rest over. Tap to continue" onClick={onDismiss}>
          <span className="rest-flash-title">REST OVER</span>
          <span className="rest-flash-sub">Next set · tap anywhere</span>
        </button>
      )}
      <div className={over ? 'rest-bar over' : 'rest-bar'} role="timer" aria-label="Rest timer">
        <div className="rest-progress" style={{ width: `${pct}%` }} />
        <span className="rest-time">{over ? 'Rest over · next set' : `Rest ${formatDuration(remaining)}`}</span>
        <span className="rest-actions">
          {over ? (
            <button type="button" onClick={onDismiss}>
              Dismiss
            </button>
          ) : (
            <>
              <button type="button" aria-label="15 seconds less" onClick={() => onAdjust(-15)}>
                −15s
              </button>
              <button type="button" aria-label="15 seconds more" onClick={() => onAdjust(15)}>
                +15s
              </button>
              <button type="button" onClick={onDismiss}>
                Skip
              </button>
            </>
          )}
        </span>
      </div>
    </>
  )
}
