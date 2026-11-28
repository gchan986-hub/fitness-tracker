import { useRef, useState } from 'react'
import { clearProfile, clearRoutines, clearWorkouts, exportBackup, importBackup } from '../lib/db'
import { todayLocal } from '../lib/id'
import { REST_OPTIONS, testRestAlert } from '../lib/rest'
import { formatDuration } from '../lib/units'
import type { BodyWeight, Profile, Units } from '../lib/types'
import { ProfileCard } from './ProfileCard'

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
  restFlash: boolean
  onRestFlashChange: (on: boolean) => void
  profile?: Profile
  bodyWeights: BodyWeight[]
  onSaveProfile: (p: Profile) => Promise<void>
  onAddWeight: (b: BodyWeight) => Promise<void>
  onDeleteWeight: (b: BodyWeight) => Promise<void>
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
  restFlash,
  onRestFlashChange,
  profile,
  bodyWeights,
  onSaveProfile,
  onAddWeight,
  onDeleteWeight,
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

  const deleteProfile = async () => {
    if (!confirm("Delete your profile and all weigh-ins? Workouts and routines are kept. This can't be undone.")) return
    await clearProfile()
    setDeleteMessage('Deleted profile and weigh-ins.')
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
      const r = await importBackup(JSON.parse(await file.text()))
      const parts = [plural(r.workouts, 'workout')]
      if (r.routines) parts.push(plural(r.routines, 'routine'))
      if (r.bodyWeights) parts.push(plural(r.bodyWeights, 'weigh-in'))
      if (r.profile) parts.push('your profile')
      setMessage(`Imported ${parts.join(', ')}.`)
      onImported()
    } catch (err) {
      setMessage(err instanceof SyntaxError ? 'That file is not valid JSON.' : (err as Error).message)
    }
  }

  return (
    <section>
      <h2>Settings</h2>
      <ProfileCard
        key={`${profile?.updatedAt ?? 'none'}-${units.weight}`}
        profile={profile}
        bodyWeights={bodyWeights}
        units={units}
        onSaveProfile={onSaveProfile}
        onAddWeight={onAddWeight}
        onDeleteWeight={onDeleteWeight}
      />
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
        <div className="sound-row">
          <label className="radio">
            <input type="checkbox" checked={restSound} onChange={(e) => onRestSoundChange(e.target.checked)} /> Beep
            when rest is over
          </label>
          <button type="button" className="secondary" onClick={testRestAlert}>
            Test sound
          </button>
        </div>
        <label className="radio">
          <input type="checkbox" checked={restFlash} onChange={(e) => onRestFlashChange(e.target.checked)} /> Flash the
          screen when rest is over
        </label>
        <p className="muted">
          Tap ✓ on a set to start the timer. You'll hear pips in the last 3 seconds, then the alert (repeated twice).
        </p>
        <p className="muted">
          <strong>Can't hear it on iPhone?</strong> Turn off silent mode (the switch or Action button on the side). The
          beep uses the <em>media</em> volume, not the ringer: tap Test sound and press volume up while it plays. With
          headphones in, it plays through them. The app has to be open on screen.
        </p>
      </fieldset>
      <div className="card">
        <h3>Backup</h3>
        <p className="muted">
          Your profile and workouts are stored only in this app on this device. Download a backup now and then, and use it to
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
          <button
            type="button"
            className="danger"
            disabled={!profile && bodyWeights.length === 0}
            onClick={() => void deleteProfile()}
          >
            Delete profile &amp; weigh-ins
          </button>
        </div>
        {deleteMessage && <p role="status">{deleteMessage}</p>}
      </div>
    </section>
  )
}
