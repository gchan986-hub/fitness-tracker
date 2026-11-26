import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { History } from './components/History'
import { RestTimer } from './components/RestTimer'
import { Routines } from './components/Routines'
import { Settings } from './components/Settings'
import { WorkoutForm, type WorkoutFormHandle } from './components/WorkoutForm'
import { deleteRoutine, deleteWorkout, listRoutines, listWorkouts, saveRoutine, saveWorkout } from './lib/db'
import { newId } from './lib/id'
import {
  readRestSec,
  readRestSound,
  readRestState,
  saveRestSec,
  saveRestSound,
  saveRestState,
  unlockAudio,
  type RestState,
} from './lib/rest'
import { findRoutineByName, fullCatalog } from './lib/routines'
import { exerciseCatalog } from './lib/stats'
import type { Routine, RoutineInput, Units, Workout } from './lib/types'

type Tab = 'log' | 'history' | 'progress' | 'routines' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'history', label: 'History' },
  { id: 'progress', label: 'Progress' },
  { id: 'routines', label: 'Routines' },
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

const loadAll = () => Promise.all([listWorkouts(), listRoutines()])

export default function App() {
  const [tab, setTab] = useState<Tab>('log')
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState<Workout>()
  const [units, setUnits] = useState<Units>(readUnits)
  const [toast, setToast] = useState('')
  const [restSec, setRestSec] = useState(readRestSec)
  const [restSound, setRestSound] = useState(readRestSound)
  const [rest, setRestState] = useState<RestState | null>(() => readRestState())
  const formRef = useRef<WorkoutFormHandle>(null)

  const reload = useCallback(async () => {
    try {
      const [ws, rs] = await loadAll()
      setWorkouts(ws)
      setRoutines(rs)
    } catch (err) {
      setLoadError(`Could not open local storage: ${(err as Error).message}`)
    }
  }, [])

  useEffect(() => {
    let active = true
    loadAll()
      .then(([ws, rs]) => {
        if (!active) return
        setWorkouts(ws)
        setRoutines(rs)
      })
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

  const logged = useMemo(() => exerciseCatalog(workouts), [workouts])
  const catalog = useMemo(() => fullCatalog(workouts, routines), [workouts, routines])

  const changeUnits = (u: Units) => {
    setUnits(u)
    try {
      localStorage.setItem(WEIGHT_UNIT_KEY, u.weight)
      localStorage.setItem(DISTANCE_UNIT_KEY, u.distance)
    } catch {
      /* preference just won't persist */
    }
  }

  const setRest = useCallback((r: RestState | null) => {
    setRestState(r)
    saveRestState(r)
  }, [])
  const startRest = () => {
    unlockAudio()
    setRest({ endAt: Date.now() + restSec * 1000, totalSec: restSec })
  }
  const adjustRest = (delta: number) => {
    if (!rest) return
    const endAt = Math.max(Date.now(), rest.endAt + delta * 1000)
    setRest({ endAt, totalSec: Math.max(rest.totalSec + delta, Math.ceil((endAt - Date.now()) / 1000)) })
  }
  const dismissRest = useCallback(() => setRest(null), [setRest])

  const goTo = (t: Tab) => {
    if (t !== 'log') setEditing(undefined)
    setTab(t)
  }

  const saveNew = async (w: Workout) => {
    await saveWorkout(w)
    await reload()
    setToast('Workout saved')
  }

  const saveEdit = async (w: Workout) => {
    await saveWorkout(w)
    await reload()
    setToast('Workout updated')
    setEditing(undefined)
    setTab('history')
  }

  /**
   * Creates or updates a routine. Saving under the name of another routine replaces that one (after asking).
   * `id` is the routine being edited, if any. Resolves false if the user backs out.
   */
  const saveRoutineInput = async (input: RoutineInput, id?: string): Promise<boolean> => {
    const clash = findRoutineByName(routines, input.name)
    if (clash && clash.id !== id && !confirm(`Replace your existing routine "${clash.name}"?`)) return false
    const targetId = id ?? clash?.id ?? newId()
    if (id && clash && clash.id !== id) await deleteRoutine(clash.id)
    const existing = routines.find((r) => r.id === targetId)
    const now = new Date().toISOString()
    await saveRoutine({ ...input, id: targetId, createdAt: existing?.createdAt ?? now, updatedAt: now })
    await reload()
    setToast('Routine saved')
    return true
  }

  return (
    <div className={rest ? 'app resting' : 'app'}>
      <header className="topbar">
        <h1>Fitness Tracker</h1>
      </header>
      <main>
        {loadError && (
          <p className="errors" role="alert">
            {loadError}
          </p>
        )}
        {!loaded ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            {/* The new-workout form stays mounted so an in-progress session survives switching tabs. */}
            <div hidden={tab !== 'log' || !!editing}>
              <WorkoutForm
                ref={formRef}
                units={units}
                history={workouts}
                catalog={catalog}
                routines={routines}
                onSave={saveNew}
                onSaveRoutine={saveRoutineInput}
                onSetDone={startRest}
              />
            </div>
            {tab === 'log' && editing && (
              <WorkoutForm
                key={editing.id}
                units={units}
                history={workouts}
                catalog={catalog}
                routines={routines}
                editing={editing}
                onSave={saveEdit}
                onSaveRoutine={saveRoutineInput}
                onCancel={() => {
                  setEditing(undefined)
                  setTab('history')
                }}
              />
            )}
            {tab === 'history' && (
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
                onSaveRoutine={saveRoutineInput}
              />
            )}
            {tab === 'progress' && (
              <Suspense fallback={<p className="muted">Loading chart…</p>}>
                <Progress workouts={workouts} catalog={logged} units={units} />
              </Suspense>
            )}
            {tab === 'routines' && (
              <Routines
                routines={routines}
                catalog={catalog}
                onSave={saveRoutineInput}
                onStart={(r) => {
                  goTo('log')
                  formRef.current?.loadRoutine(r)
                }}
                onDelete={async (r) => {
                  await deleteRoutine(r.id)
                  await reload()
                  setToast('Routine deleted')
                }}
              />
            )}
            {tab === 'settings' && (
              <Settings
                units={units}
                onUnitsChange={changeUnits}
                onImported={reload}
                workoutCount={workouts.length}
                routineCount={routines.length}
                restSec={restSec}
                onRestSecChange={(sec) => {
                  setRestSec(sec)
                  saveRestSec(sec)
                }}
                restSound={restSound}
                onRestSoundChange={(on) => {
                  setRestSound(on)
                  saveRestSound(on)
                  if (on) unlockAudio()
                }}
              />
            )}
          </>
        )}
      </main>
      {rest && <RestTimer rest={rest} sound={restSound} onAdjust={adjustRest} onDismiss={dismissRest} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => goTo(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
