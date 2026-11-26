import { useEffect, useState } from 'react'
import { formatDuration } from '../lib/units'

interface Props {
  startedAt: number | null
  onStart: () => void
  onReset: () => void
}

/** Elapsed time for the whole workout, shown at the top of the Log screen. */
export function SessionTimer({ startedAt, onStart, onReset }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  if (startedAt === null) {
    return (
      <div className="session-timer idle">
        <span className="muted">Workout timer starts when you tick your first set.</span>
        <button type="button" className="secondary" onClick={onStart}>
          Start now
        </button>
      </div>
    )
  }
  const elapsed = Math.max(0, Math.floor((Math.max(now, startedAt) - startedAt) / 1000))
  return (
    <div className="session-timer" role="timer" aria-label="Workout time">
      <span>
        <span className="muted">Workout time </span>
        <strong>{formatDuration(elapsed)}</strong>
      </span>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          if (confirm('Reset the workout timer?')) onReset()
        }}
      >
        Reset
      </button>
    </div>
  )
}
