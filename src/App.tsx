import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { History } from './components/History'
import { Settings } from './components/Settings'
import { WorkoutForm } from './components/WorkoutForm'
import { deleteWorkout, listWorkouts, saveWorkout } from './lib/db'
import { exerciseCatalog } from './lib/stats'
import type { Units, Workout } from './lib/types'

type Tab = 'log' | 'history' | 'progress' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'history', label: 'History' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
]
const Progress = lazy(() => import('./components/Progress').then((m) => ({ default: m.Progress })))
const WEIGHT_UNIT_KEY = 'fitness-tracker:unit'
const DISTANCE_UNIT_KEY = 'fitness-tracker:distance-unit'

function readUnits(): Units {
  try {
    return {
      weight: localStorage.getItem(WEIGHT_UNIT_KEY) === 'lb' ? 'lb' : 'kg',
      distance: localStorage.getItem(DISTANCE_UNIT_KEY) === 'mi' ? 'mi' : 'km',
    }
  } catch {
    return { weight: 'kg', distance: 'km' }
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('log')
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<Workout>()
  const [units, setUnits] = useState<Units>(readUnits)
  const [toast, setToast] = useState('')

  const reload = useCallback(async () => {
    try {
      setWorkouts(await listWorkouts())
    } catch (err) {
      setLoadError(`Could not open local storage: ${(err as Error).message}`)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    let active = true
    listWorkouts()
      .then((ws) => active && setWorkouts(ws))
      .catch((err: Error) => active && setLoadError(`Could not open local storage: ${err.message}`))
      .finally(() => active && setLoaded(true))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const catalog = useMemo(() => exerciseCatalog(workouts), [workouts])
  const names = useMemo(() => catalog.map((c) => c.name), [catalog])

  const changeUnits = (u: Units) => {
    setUnits(u)
    try {
      localStorage.setItem(WEIGHT_UNIT_KEY, u.weight)
      localStorage.setItem(DISTANCE_UNIT_KEY, u.distance)
    } catch {
      /* preference just won't persist */
    }
  }

  const save = async (w: Workout) => {
    await saveWorkout(w)
    await reload()
    setToast(editing ? 'Workout updated' : 'Workout saved')
    if (editing) {
      setEditing(undefined)
      setTab('history')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Fitness Tracker</h1>
      </header>
      <main>
        {loadError && <p className="errors" role="alert">{loadError}</p>}
        {!loaded ? (
          <p className="muted">Loading…</p>
        ) : tab === 'log' ? (
          <WorkoutForm
            key={editing?.id ?? 'new'}
            units={units}
            history={workouts}
            knownExercises={names}
            editing={editing}
            onSave={save}
            onCancel={
              editing
                ? () => {
                    setEditing(undefined)
                    setTab('history')
                  }
                : undefined
            }
          />
        ) : tab === 'history' ? (
          <History
            workouts={workouts}
            units={units}
            onEdit={(w) => {
              setEditing(w)
              setTab('log')
            }}
            onDelete={async (w) => {
              await deleteWorkout(w.id)
              await reload()
              setToast('Workout deleted')
            }}
          />
        ) : tab === 'progress' ? (
          <Suspense fallback={<p className="muted">Loading chart…</p>}>
            <Progress workouts={workouts} catalog={catalog} units={units} />
          </Suspense>
        ) : (
          <Settings units={units} onUnitsChange={changeUnits} onImported={reload} />
        )}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              if (t.id !== 'log') setEditing(undefined)
              setTab(t.id)
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
