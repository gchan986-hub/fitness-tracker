import { useRef, useState } from 'react'
import { clearRoutines, clearWorkouts, exportBackup, importBackup } from '../lib/db'
import { todayLocal } from '../lib/id'
import { REST_OPTIONS } from '../lib/rest'
import { formatDuration } from '../lib/units'
import type { Units } from '../lib/types'

interface Props {
  units: Units
  onUnitsChange: (u: Units) => void
  /** Called after data changes here (import or delete) so the app reloads it. */
  onImported: () => void
  workoutCount: number
  routineCount: number
  restSec: number
  onRestSecChange: (sec: number) => void
  restSound: boolean
  onRestSoundChange: (on: boolean) => void
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function Settings({
  units,
  onUnitsChange,
  onImported,
  workoutCount,
  routineCount,
  restSec,
  onRestSecChange,
  restSound,
  onRestSoundChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')

  const deleteAll = async (what: 'workouts' | 'routines') => {
    const count = what === 'workouts' ? plural(workoutCount, 'workout') : plural(routineCount, 'routine')
    const keep = what === 'workouts' ? 'Your routines are kept.' : 'Your logged workouts are kept.'
    if (!confirm(`Delete all ${count}? ${keep} This can't be undone.`)) return
    await (what === 'workouts' ? clearWorkouts() : clearRoutines())
    setDeleteMessage(`Deleted ${count}.`)
    onImported()
  }

  const download = async () => {
    const blob = new Blob([JSON.stringify(await exportBackup(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fitness-backup-${todayLocal()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMessage('Backup downloaded.')
  }

  const upload = async (file: File) => {
    try {
      const { workouts, routines } = await importBackup(JSON.parse(await file.text()))
      setMessage(
        `Imported ${plural(workouts, 'workout')}${routines ? ` and ${plural(routines, 'routine')}` : ''}.`,
      )
      onImported()
    } catch (err) {
      setMessage(err instanceof SyntaxError ? 'That file is not valid JSON.' : (err as Error).message)
    }
  }

  return (
    <section>
      <h2>Settings</h2>
      <fieldset className="card">
        <legend>Weight unit</legend>
        {(['kg', 'lb'] as const).map((u) => (
          <label key={u} className="radio">
            <input
              type="radio"
              name="weight-unit"
              checked={units.weight === u}
              onChange={() => onUnitsChange({ ...units, weight: u })}
            />{' '}
            {u}
          </label>
        ))}
      </fieldset>
      <fieldset className="card">
        <legend>Distance unit</legend>
        {(['km', 'mi'] as const).map((u) => (
          <label key={u} className="radio">
            <input
              type="radio"
              name="distance-unit"
              checked={units.distance === u}
              onChange={() => onUnitsChange({ ...units, distance: u })}
            />{' '}
            {u}
          </label>
        ))}
      </fieldset>
      <fieldset className="card">
        <legend>Rest timer</legend>
        <label className="field">
          Rest between sets
          <select value={restSec} onChange={(e) => onRestSecChange(Number(e.target.value))}>
            {REST_OPTIONS.map((sec) => (
              <option key={sec} value={sec}>
                {sec < 60 ? `${sec} sec` : `${formatDuration(sec)} min`}
              </option>
            ))}
          </select>
        </label>
        <label className="radio">
          <input type="checkbox" checked={restSound} onChange={(e) => onRestSoundChange(e.target.checked)} /> Beep when
          rest is over
        </label>
        <p className="muted">
          Tap ✓ on a set to start the timer. On iPhone the beep is silent when the ring/silent switch is on, and the
          app has to be open.
        </p>
      </fieldset>
      <div className="card">
        <h3>Backup</h3>
        <p className="muted">
          Your workouts are stored only in this browser on this device. Download a backup now and then, and use it to
          move your data to another device.
        </p>
        <div className="actions">
          <button type="button" className="secondary" onClick={download}>
            Download backup
          </button>
          <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Backup file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
              e.target.value = ''
            }}
          />
        </div>
        {message && <p role="status">{message}</p>}
      </div>
      <div className="card">
        <h3>Delete data</h3>
        <p className="muted">
          Clears this device. Download a backup first if you might want it back. Your units and the built-in exercise
          list are not affected.
        </p>
        <div className="actions start">
          <button
            type="button"
            className="danger"
            disabled={workoutCount === 0}
            onClick={() => void deleteAll('workouts')}
          >
            Delete all workouts ({workoutCount})
          </button>
          <button
            type="button"
            className="danger"
            disabled={routineCount === 0}
            onClick={() => void deleteAll('routines')}
          >
            Delete all routines ({routineCount})
          </button>
        </div>
        {deleteMessage && <p role="status">{deleteMessage}</p>}
      </div>
    </section>
  )
}
