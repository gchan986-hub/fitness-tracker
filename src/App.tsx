import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { History } from './components/History'
import { Settings } from './components/Settings'
import { WorkoutForm } from './components/WorkoutForm'
import { deleteWorkout, listWorkouts, saveWorkout } from './lib/db'
import { exerciseNames } from './lib/stats'
import type { WeightUnit, Workout } from './lib/types'

type Tab = 'log' | 'history' | 'progress' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'history', label: 'History' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
]
const Progress = lazy(() => import('./components/Progress').then((m) => ({ default: m.Progress })))
const UNIT_KEY = 'fitness-tracker:unit'

function readUnit(): WeightUnit {
  try {
    return localStorage.getItem(UNIT_KEY) === 'lb' ? 'lb' : 'kg'
  } catch {
    return 'kg'
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('log')
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<Workout>()
  const [unit, setUnit] = useState<WeightUnit>(readUnit)
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

  const names = useMemo(() => exerciseNames(workouts), [workouts])

  const changeUnit = (u: WeightUnit) => {
    setUnit(u)
    try {
      localStorage.setItem(UNIT_KEY, u)
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
            unit={unit}
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
            unit={unit}
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
            <Progress workouts={workouts} exercises={names} unit={unit} />
          </Suspense>
        ) : (
          <Settings unit={unit} onUnitChange={changeUnit} onImported={reload} />
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
