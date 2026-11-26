import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { _resetForTests, listRoutines, saveRoutine, saveWorkout } from './lib/db'
import { cardio, sets, workout } from './test/fixtures'

beforeEach(async () => {
  await _resetForTests()
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  vi.restoreAllMocks()
})

type User = ReturnType<typeof userEvent.setup>
const tab = (name: string) => screen.getByRole('button', { name })
const dialog = () => within(screen.getByRole('dialog'))

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Matches a list button for `name`, whatever its equipment ("Add Bench Press · Barbell"). */
const addButton = (name: string) => new RegExp(`^Add ${escape(name)}( · .+)?$`)

/** Taps "+ Add exercise", searches, and picks the exercise (adding it as new if it isn't listed). */
async function addExercise(user: User, name: string, asNew?: 'weights' | 'cardio') {
  await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
  await user.type(dialog().getByLabelText('Search exercises'), name)
  await user.click(
    asNew
      ? dialog().getByRole('button', { name: `Add “${name}” as ${asNew}` })
      : dialog().getAllByRole('button', { name: addButton(name) })[0],
  )
}

describe('App', () => {
  it('starts empty and logs a workout picked from the list', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Log workout' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Exercise 1 name')).not.toBeInTheDocument()

    await addExercise(user, 'Bench Press')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Bench Press')
    await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '5')
    await user.type(screen.getByLabelText('Exercise 1 set 1 weight'), '80')
    await user.click(screen.getByRole('button', { name: '+ Add set' }))
    expect(screen.getByLabelText('Exercise 1 set 2 weight')).toHaveValue('80')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    expect(await screen.findByText('Workout saved')).toBeInTheDocument()
    expect(screen.queryByLabelText('Exercise 1 name')).not.toBeInTheDocument()

    await user.click(tab('History'))
    expect(await screen.findByText('5×80 kg, 5×80 kg')).toBeInTheDocument()
    expect(screen.getByText('800 kg volume')).toBeInTheDocument()
  })

  it('shows validation errors instead of saving bad input', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Save workout' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one exercise.')

    await addExercise(user, 'Squat')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/reps must be a whole number/)
  })

  it('filters the list by body part and searches within it', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'bench press', sets: sets([5, 60]) }, { name: 'Zercher Squat', sets: sets([5, 80]) }]))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    const d = dialog()
    const tabs = within(d.getByRole('group', { name: 'Body part' }))
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(tabs).toEqual(['All', 'Yours', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full body', 'Cardio'])
    // Browsing "All": your exercises first, then suggestions by body part
    expect(d.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)[0]).toBe('Your exercises')

    await user.click(d.getByRole('button', { name: 'Chest' }))
    const chest = d.getAllByRole('button', { name: /^Add / }).map((b) => b.getAttribute('aria-label'))
    expect(chest[0]).toBe('Add bench press · Barbell') // yours first, recognised as chest
    expect(chest).toContain('Add Chest Fly · Dumbbell')
    expect(chest).not.toContain('Add Squat · Barbell')

    await user.click(d.getByRole('button', { name: 'Yours' }))
    expect(d.getAllByRole('button', { name: /^Add / }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Add bench press · Barbell',
      'Add Zercher Squat',
    ])

    await user.click(d.getByRole('button', { name: 'Arms' }))
    await user.type(d.getByLabelText('Search exercises'), 'curl')
    const arms = within(d.getByRole('region', { name: 'Arms' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
    expect(arms).toEqual([
      'Add Bicep Curl · Dumbbell',
      'Add Hammer Curl · Dumbbell',
      'Add Preacher Curl · Barbell',
      'Add Concentration Curl · Dumbbell',
    ])
    // "curl" alone isn't an exercise, so it can also be added as a new one
    expect(d.getByRole('button', { name: 'Add “curl” as weights' })).toBeInTheDocument()
    await user.click(d.getByRole('button', { name: 'Add Hammer Curl · Dumbbell' }))
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Hammer Curl')
  })

  it('adds a new exercise that is not in the list, and closes with Done', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addExercise(user, 'Sled Push', 'weights')
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Sled Push')
    await user.click(screen.getByRole('button', { name: '+ Add exercise' }))
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/Exercise \d name/)).toHaveLength(1)
  })

  it('pre-fills last session’s numbers when an exercise is picked', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100], [5, 102.5]) }, cardio('Bike', 1800, 15)]))
    const user = userEvent.setup()
    render(<App />)
    await addExercise(user, 'Squat')
    await addExercise(user, 'Bike')
    expect(screen.getByLabelText('Exercise 1 set 2 weight')).toHaveValue('102.5')
    expect(screen.getByRole('group', { name: 'Exercise 2 type' })).toHaveTextContent('Cardio')
    expect(screen.getByLabelText('Exercise 2 distance')).toHaveValue('15')
    expect(screen.getByLabelText('Exercise 2 minutes')).toHaveValue('30')
  })

  it('pre-fills when a card is renamed, leaving the tapped field for typing', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100], [5, 100]) }]))
    const user = userEvent.setup()
    render(<App />)
    await addExercise(user, 'Mystery Lift', 'weights')
    const name = screen.getByLabelText('Exercise 1 name')
    await user.clear(name)
    await user.type(name, 'Squat')
    await user.click(screen.getByLabelText('Exercise 1 set 1 reps'))
    await user.keyboard('3')
    expect(screen.getByLabelText('Exercise 1 set 1 reps')).toHaveValue('3')
    expect(screen.getByLabelText('Exercise 1 set 1 reps')).toHaveFocus()
    expect(screen.getByLabelText('Exercise 1 set 1 weight')).toHaveValue('100')
    expect(screen.getByLabelText('Exercise 1 set 2 reps')).toHaveValue('5')
  })

  it('switches a renamed card to cardio for a built-in cardio name', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addExercise(user, 'Mystery', 'weights')
    const name = screen.getByLabelText('Exercise 1 name')
    await user.clear(name)
    await user.type(name, 'rowing machine')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cardio' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('edits and deletes a workout from history', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Row', sets: sets([10, 50]) }]))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'History' }))
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    const form = within(screen.getByRole('form', { name: 'Edit workout' }))
    // Changing equipment keeps the workout's own numbers
    await user.selectOptions(form.getByLabelText('Exercise 1 equipment'), 'cable')
    expect(form.getByLabelText('Exercise 1 set 1 weight')).toHaveValue('50')
    const reps = form.getByLabelText('Exercise 1 set 1 reps')
    await user.clear(reps)
    await user.type(reps, '12')
    await user.click(form.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('12×50 kg')).toBeInTheDocument()
    expect(screen.getByText('Row · Cable')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/No workouts yet/)).toBeInTheDocument()
  })

  it('shows personal records and switches units', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Deadlift', sets: sets([5, 140]) }]))
    await saveWorkout(workout('2026-01-08', [{ name: 'Deadlift', sets: sets([3, 150]) }]))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    expect(await screen.findByText('150 kg × 3')).toBeInTheDocument()

    await user.click(tab('Settings'))
    await user.click(screen.getByRole('radio', { name: 'lb' }))
    expect(localStorage.getItem('fitness-tracker:unit')).toBe('lb')
    await user.click(tab('Progress'))
    expect(await screen.findByText('330.7 lb × 3')).toBeInTheDocument()
  })

  it('logs cardio with pace and mixes it with weights', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addExercise(user, 'Run')
    await user.type(screen.getByLabelText('Exercise 1 distance'), '5')
    await user.type(screen.getByLabelText('Exercise 1 minutes'), '25')
    expect(screen.getByText('Pace 5:00 /km')).toBeInTheDocument()

    await addExercise(user, 'Squat')
    await user.type(screen.getByLabelText('Exercise 2 set 1 reps'), '5')
    await user.type(screen.getByLabelText('Exercise 2 set 1 weight'), '100')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(await screen.findByText('Workout saved')).toBeInTheDocument()

    await user.click(tab('History'))
    expect(await screen.findByText('5 km in 25:00 (5:00 /km)')).toBeInTheDocument()
    expect(screen.getByText('500 kg volume · 5 km')).toBeInTheDocument()
  })

  it('rejects cardio without a time', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addExercise(user, 'Run')
    await user.type(screen.getByLabelText('Exercise 1 seconds'), '75')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Run: enter a time')
  })

  it('shows cardio records and switches to miles', async () => {
    await saveWorkout(workout('2026-01-01', [cardio('Run', 1800, 5)]))
    await saveWorkout(workout('2026-01-08', [cardio('Run', 1500, 5)]))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Progress' }))
    expect(await screen.findByText('5:00 /km')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pace (lower is faster)' })).toBeInTheDocument()

    await user.click(tab('Settings'))
    await user.click(screen.getByRole('radio', { name: 'mi' }))
    await user.click(tab('Progress'))
    expect(await screen.findByText('8:03 /mi')).toBeInTheDocument()
    expect(screen.getByText('3.11 mi')).toBeInTheDocument()
  })

  it('keeps an in-progress workout when switching tabs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addExercise(user, 'Deadlift')
    await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '5')
    await user.click(tab('History'))
    await user.click(tab('Log'))
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Deadlift')
    expect(screen.getByLabelText('Exercise 1 set 1 reps')).toHaveValue('5')
  })

  it('saves a session as a routine and recalls it with the latest numbers', async () => {
    const user = userEvent.setup()
    render(<App />)
    const date = await screen.findByLabelText('Date')
    await user.clear(date)
    await user.type(date, '2026-11-23') // a Monday
    await addExercise(user, 'Bench Press')
    await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '5')
    await user.type(screen.getByLabelText('Exercise 1 set 1 weight'), '80')
    await addExercise(user, 'Run')
    await user.type(screen.getByLabelText('Exercise 2 distance'), '3')
    await user.type(screen.getByLabelText('Exercise 2 minutes'), '15')

    await user.click(screen.getByRole('button', { name: 'Save as routine' }))
    const panel = within(screen.getByRole('group', { name: 'Save as routine' }))
    expect(panel.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(panel.getByRole('button', { name: 'Thursday' }))
    await user.type(panel.getByLabelText('Routine name'), 'Push day')
    await user.click(panel.getByRole('button', { name: 'Save routine' }))
    expect(await screen.findByText('Routine saved')).toBeInTheDocument()
    expect(await listRoutines()).toMatchObject([
      {
        name: 'Push day',
        days: [1, 4],
        exercises: [
          { name: 'Bench Press', kind: 'strength' },
          { name: 'Run', kind: 'cardio' },
        ],
      },
    ])
    await user.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(await screen.findByText('Workout saved')).toBeInTheDocument()

    // Next session: the routine is suggested for Monday and loads last time's numbers
    await user.clear(screen.getByLabelText('Date'))
    await user.type(screen.getByLabelText('Date'), '2026-11-30')
    await user.click(screen.getByRole('button', { name: 'Push day · Today' }))
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Bench Press')
    expect(screen.getByLabelText('Exercise 1 set 1 weight')).toHaveValue('80')
    expect(screen.getByLabelText('Exercise 2 distance')).toHaveValue('3')
    expect(screen.getByLabelText('Exercise 2 minutes')).toHaveValue('15')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))
    await user.click(tab('History'))
    expect(await screen.findAllByText('Push day', { selector: '.routine-tag' })).toHaveLength(2)
  })

  it('asks before replacing exercises already entered', async () => {
    await saveRoutine({
      id: 'r1',
      name: 'Legs',
      days: [],
      exercises: [{ name: 'Squat', kind: 'strength' }],
      createdAt: 'x',
      updatedAt: 'x',
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)
    await addExercise(user, 'Bicep Curl')
    await user.click(screen.getByRole('button', { name: 'Legs' }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Bicep Curl')
  })

  it('creates, starts, edits and deletes a routine from the Routines tab', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 120]) }]))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Routines' }))
    expect(screen.getByText(/No routines yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ New routine' }))
    await user.type(screen.getByLabelText('Routine name'), 'Leg day')
    await user.click(screen.getByRole('button', { name: 'Wednesday' }))
    await user.click(screen.getByRole('button', { name: '+ Add exercises' }))
    // The list stays open in the routine editor so several can be added
    await user.click(dialog().getByRole('button', { name: 'Legs' }))
    await user.click(dialog().getByRole('button', { name: 'Add Squat · Barbell' }))
    await user.click(dialog().getByRole('button', { name: 'Add Lunge · Dumbbell' }))
    expect(dialog().getByRole('button', { name: 'Add Lunge · Dumbbell' })).toHaveTextContent('✓ Added')
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('button', { name: 'Move Lunge · Dumbbell up' }))
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(await screen.findByRole('heading', { name: 'Leg day' })).toBeInTheDocument()
    expect(screen.getByText('Lunge · Dumbbell, Squat · Barbell')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Lunge')
    expect(screen.getByLabelText('Exercise 2 set 1 weight')).toHaveValue('120')
    expect(screen.getByText('Leg day', { selector: 'strong' })).toBeInTheDocument()

    await user.click(tab('Routines'))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Remove Lunge · Dumbbell' }))
    await user.click(screen.getByRole('button', { name: 'Save routine' }))
    expect(await screen.findByText('Squat · Barbell')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/No routines yet/)).toBeInTheDocument()
  })

  it('saves a past workout as a routine from History', async () => {
    await saveWorkout(workout('2026-11-26', [{ name: 'Row', sets: sets([10, 50]) }])) // a Thursday
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: 'Save as routine' }))
    const panel = within(screen.getByRole('group', { name: 'Save as routine' }))
    expect(panel.getByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true')
    await user.type(panel.getByLabelText('Routine name'), 'Pull')
    await user.click(panel.getByRole('button', { name: 'Save routine' }))
    expect(await screen.findByText('Routine saved')).toBeInTheDocument()
    expect(await listRoutines()).toMatchObject([{ name: 'Pull', days: [4], exercises: [{ name: 'Row' }] }])
  })

  it('logs equipment per weights exercise and keeps numbers separate per equipment', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Bench Press', sets: sets([5, 80]) }])) // old entry: barbell
    await saveWorkout(workout('2026-01-02', [{ name: 'Bench Press', equipment: 'dumbbell', sets: sets([10, 30]) }]))
    const user = userEvent.setup()
    render(<App />)

    // Your own entries are listed per equipment
    await user.click(await screen.findByRole('button', { name: '+ Add exercise' }))
    await user.click(dialog().getByRole('button', { name: 'Yours' }))
    expect(dialog().getByRole('button', { name: 'Add Bench Press · Barbell' })).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Add Bench Press · Dumbbell' }))
    expect(screen.getByLabelText('Exercise 1 equipment')).toHaveValue('dumbbell')
    expect(screen.getByLabelText('Exercise 1 set 1 weight')).toHaveValue('30')
    expect(screen.getByText('Weight (kg, each)')).toBeInTheDocument()

    // Switching equipment on an untouched card loads that equipment's last numbers
    await addExercise(user, 'Lateral Raise')
    expect(screen.getByLabelText('Exercise 2 equipment')).toHaveValue('dumbbell')
    await user.selectOptions(screen.getByLabelText('Exercise 1 equipment'), 'barbell')
    expect(screen.getByLabelText('Exercise 1 set 1 weight')).toHaveValue('80')
    await user.selectOptions(screen.getByLabelText('Exercise 2 equipment'), 'cable')
    await user.type(screen.getByLabelText('Exercise 2 set 1 reps'), '12')
    await user.type(screen.getByLabelText('Exercise 2 set 1 weight'), '10')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(await screen.findByText('Workout saved')).toBeInTheDocument()

    await user.click(tab('History'))
    expect(await screen.findByText('Lateral Raise · Cable')).toBeInTheDocument()
    expect(screen.getAllByText('Bench Press · Barbell')).toHaveLength(2)

    await user.click(tab('Progress'))
    const picker = await screen.findByLabelText('Exercise')
    expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Bench Press · Barbell',
      'Bench Press · Dumbbell',
      'Lateral Raise · Cable',
    ])
  })

  it('shows "added weight" for bodyweight exercises', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addExercise(user, 'Pull-up')
    expect(screen.getByLabelText('Exercise 1 equipment')).toHaveValue('bodyweight')
    expect(screen.getByText('Added (kg)')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '8')
    await user.click(screen.getByRole('button', { name: '+ Add set' }))
    await user.type(screen.getByLabelText('Exercise 1 set 2 weight'), '10')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))
    await user.click(await screen.findByRole('button', { name: 'History' }))
    expect(await screen.findByText('8 reps, 8 × +10 kg')).toBeInTheDocument()
  })

  it('sets equipment per exercise in the routine editor', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Routines' }))
    await user.click(screen.getByRole('button', { name: '+ New routine' }))
    await user.type(screen.getByLabelText('Routine name'), 'Pull')
    await user.click(screen.getByRole('button', { name: '+ Add exercises' }))
    await user.type(dialog().getByLabelText('Search exercises'), 'face pull')
    await user.click(dialog().getByRole('button', { name: 'Add Face Pull · Cable' }))
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    await user.selectOptions(screen.getByLabelText('Face Pull equipment'), 'band')
    await user.click(screen.getByRole('button', { name: 'Save routine' }))
    expect(await listRoutines()).toMatchObject([
      { name: 'Pull', exercises: [{ name: 'Face Pull', kind: 'strength', equipment: 'band' }] },
    ])
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByLabelText('Exercise 1 equipment')).toHaveValue('band')
  })

  it('deletes all workouts or all routines from Settings after confirming', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Row', sets: sets([10, 50]) }]))
    await saveWorkout(workout('2026-01-02', [cardio('Run', 1500, 5)]))
    await saveRoutine({ id: 'r1', name: 'Pull', days: [], exercises: [{ name: 'Row', kind: 'strength' }], createdAt: 'x', updatedAt: 'x' })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))

    // Cancelling keeps everything
    await user.click(screen.getByRole('button', { name: 'Delete all workouts (2)' }))
    expect(confirmSpy).toHaveBeenLastCalledWith("Delete all 2 workouts? Your routines are kept. This can't be undone.")
    expect(screen.getByRole('button', { name: 'Delete all workouts (2)' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete all workouts (2)' }))
    expect(await screen.findByRole('button', { name: 'Delete all workouts (0)' })).toBeDisabled()
    expect(screen.getByText('Deleted 2 workouts.')).toBeInTheDocument()
    await user.click(tab('History'))
    expect(await screen.findByText(/No workouts yet/)).toBeInTheDocument()
    await user.click(tab('Routines'))
    expect(screen.getByRole('heading', { name: 'Pull' })).toBeInTheDocument()

    await user.click(tab('Settings'))
    await user.click(screen.getByRole('button', { name: 'Delete all routines (1)' }))
    expect(await screen.findByRole('button', { name: 'Delete all routines (0)' })).toBeDisabled()
    expect(await listRoutines()).toEqual([])
  })
})
