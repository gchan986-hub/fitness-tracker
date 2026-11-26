import { useEffect, useRef, useState } from 'react'
import { restOverAlert, type RestState } from '../lib/rest'
import { formatDuration } from '../lib/units'

interface Props {
  rest: RestState
  sound: boolean
  onAdjust: (deltaSec: number) => void
  onDismiss: () => void
}

/** Countdown bar shown above the tab bar between sets. */
export function RestTimer({ rest, sound, onAdjust, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const alertedFor = useRef<number | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const remaining = Math.max(0, Math.ceil((rest.endAt - now) / 1000))
  const over = remaining === 0

  // Alert once per rest period.
  useEffect(() => {
    if (over && alertedFor.current !== rest.endAt) {
      alertedFor.current = rest.endAt
      restOverAlert(sound)
    }
  }, [over, rest.endAt, sound])

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
  )
}
