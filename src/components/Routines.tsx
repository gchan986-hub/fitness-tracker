import { useState } from 'react'
import { todayLocal } from '../lib/id'
import { exerciseLabel } from '../lib/equipment'
import { formatDays, sortRoutines, weekdayOf } from '../lib/routines'
import type { CatalogItem } from '../lib/stats'
import type { Routine, RoutineInput } from '../lib/types'
import { RoutineEditor } from './RoutineEditor'

interface Props {
  routines: Routine[]
  catalog: CatalogItem[]
  onStart: (r: Routine) => void
  onSave: (input: RoutineInput, id?: string) => Promise<boolean>
  onDelete: (r: Routine) => void
}

export function Routines({ routines, catalog, onStart, onSave, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)

  if (editingId) {
    const routine = routines.find((r) => r.id === editingId)
    return (
      <RoutineEditor
        key={editingId}
        routine={routine}
        catalog={catalog}
        onCancel={() => setEditingId(null)}
        onSave={async (input) => {
          const saved = await onSave(input, routine?.id)
          if (saved) setEditingId(null)
          return saved
        }}
      />
    )
  }

  const today = weekdayOf(todayLocal())
  return (
    <section>
      <div className="section-head">
        <h2>Routines</h2>
        <button type="button" className="primary" onClick={() => setEditingId('new')}>
          + New routine
        </button>
      </div>
      {routines.length === 0 ? (
        <p className="empty">
          No routines yet. Create one here, or log a workout and tap “Save as routine” to reuse it next time.
        </p>
      ) : (
        <ul className="history">
          {sortRoutines(routines, today).map((r) => (
            <li key={r.id} className="card">
              <div className="history-head">
                <h3>{r.name}</h3>
                <span className={r.days.includes(today) ? 'tag today' : 'muted'}>
                  {r.days.includes(today) ? `Today · ${formatDays(r.days)}` : formatDays(r.days)}
                </span>
              </div>
              <p className="muted">{r.exercises.map((e) => exerciseLabel(e.name, e.equipment)).join(', ')}</p>
              <div className="actions">
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm(`Delete the routine "${r.name}"? Your logged workouts are kept.`)) onDelete(r)
                  }}
                >
                  Delete
                </button>
                <button type="button" className="secondary" onClick={() => setEditingId(r.id)}>
                  Edit
                </button>
                <button type="button" className="primary" onClick={() => onStart(r)}>
                  Start
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
