import { useRef, useState } from 'react'
import { exportBackup, importBackup } from '../lib/db'
import { todayLocal } from '../lib/id'
import type { Units } from '../lib/types'

interface Props {
  units: Units
  onUnitsChange: (u: Units) => void
  onImported: () => void
}

export function Settings({ units, onUnitsChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

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
      const count = await importBackup(JSON.parse(await file.text()))
      setMessage(`Imported ${count} workout${count === 1 ? '' : 's'}.`)
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
    </section>
  )
}
