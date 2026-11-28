import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { _resetForTests, getProfile, listBodyWeights, listRoutines, saveBodyWeight, saveProfile, saveRoutine, saveWorkout } from './lib/db'
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

  describe('rest timer', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    })
    afterEach(() => vi.useRealTimers())
    const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
    const timer = () => screen.queryByRole('timer', { name: 'Rest timer' })

    it('starts when a set is ticked, counts down, adjusts and can be skipped', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await addExercise(user, 'Squat')
      await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '5')
      expect(timer()).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      expect(screen.getByRole('button', { name: 'Exercise 1 set 1 done' })).toHaveAttribute('aria-pressed', 'true')
      expect(timer()).toHaveTextContent('Rest 1:30')

      await advance(15_000)
      expect(timer()).toHaveTextContent('Rest 1:15')
      await user.click(screen.getByRole('button', { name: '15 seconds more' }))
      expect(timer()).toHaveTextContent(/Rest 1:(30|29)/)
      await user.click(screen.getByRole('button', { name: '15 seconds less' }))
      await user.click(screen.getByRole('button', { name: '15 seconds less' }))
      expect(timer()).toHaveTextContent(/Rest 1:0[01]/)

      // Keeps running on other tabs
      await user.click(tab('History'))
      expect(timer()).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Skip' }))
      expect(timer()).not.toBeInTheDocument()

      // Unticking doesn't start a new rest
      await user.click(tab('Log'))
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      expect(timer()).not.toBeInTheDocument()
    })

    it('says when rest is over, vibrates, then hides', async () => {
      const vibrate = vi.fn()
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await addExercise(user, 'Squat')
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      await advance(90_000)
      expect(timer()).toHaveTextContent('Rest over · next set')
      expect(vibrate).toHaveBeenCalledTimes(1)
      await advance(5_000)
      expect(vibrate).toHaveBeenCalledTimes(1)
      await advance(15_000)
      expect(timer()).not.toBeInTheDocument()
    })

    it('uses the rest length chosen in Settings', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Settings' }))
      await user.selectOptions(screen.getByLabelText('Rest between sets'), '60')
      await user.click(screen.getByRole('checkbox', { name: /Beep when rest is over/ }))
      expect(localStorage.getItem('fitness-tracker:rest-sec')).toBe('60')
      expect(localStorage.getItem('fitness-tracker:rest-sound')).toBe('off')
      await user.click(tab('Log'))
      await addExercise(user, 'Run')
      expect(screen.queryByRole('button', { name: /done$/ })).not.toBeInTheDocument() // no ✓ on cardio
      await addExercise(user, 'Squat')
      await user.click(screen.getByRole('button', { name: '+ Add set' }))
      await user.click(screen.getByRole('button', { name: 'Exercise 2 set 2 done' }))
      expect(timer()).toHaveTextContent('Rest 1:00')
      expect(screen.getByRole('button', { name: 'Exercise 2 set 1 done' })).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('per-exercise rest and workout timer', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    })
    afterEach(() => vi.useRealTimers())
    const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
    const restTimer = () => screen.queryByRole('timer', { name: 'Rest timer' })

    it('uses and remembers a rest time per exercise', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await addExercise(user, 'Squat')
      await addExercise(user, 'Lateral Raise')
      expect(screen.getByLabelText('Exercise 1 rest')).toHaveDisplayValue('Default (1:30)')
      await user.selectOptions(screen.getByLabelText('Exercise 1 rest'), '180')
      await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '5')
      await user.type(screen.getByLabelText('Exercise 1 set 1 weight'), '100')
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      expect(restTimer()).toHaveTextContent('Rest 3:00')
      await user.click(screen.getByRole('button', { name: 'Skip' }))
      await user.click(screen.getByRole('button', { name: 'Exercise 2 set 1 done' }))
      expect(restTimer()).toHaveTextContent('Rest 1:30')
      await user.click(screen.getByRole('button', { name: 'Skip' }))
      await user.type(screen.getByLabelText('Exercise 2 set 1 reps'), '12')
      await user.click(screen.getByRole('button', { name: 'Save workout' }))
      expect(await screen.findByText('Workout saved')).toBeInTheDocument()

      // Next workout: Squat comes back with its 3:00 rest
      await addExercise(user, 'Squat')
      expect(screen.getByLabelText('Exercise 1 rest')).toHaveValue('180')
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      expect(restTimer()).toHaveTextContent('Rest 3:00')
    })

    it('times the workout from the first ticked set and records it in history', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await addExercise(user, 'Squat')
      expect(screen.getByRole('button', { name: 'Start now' })).toBeInTheDocument()
      await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '5')
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      expect(screen.getByRole('timer', { name: 'Workout time' })).toHaveTextContent('0:00')

      await advance(25 * 60_000)
      expect(screen.getByRole('timer', { name: 'Workout time' })).toHaveTextContent('25:00')
      // Survives switching tabs
      await user.click(tab('History'))
      await user.click(tab('Log'))
      await advance(20 * 60_000)
      expect(screen.getByRole('timer', { name: 'Workout time' })).toHaveTextContent('45:0')

      await user.click(screen.getByRole('button', { name: 'Save workout' }))
      expect(await screen.findByText('Workout saved')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Start now' })).toBeInTheDocument()
      await user.click(tab('History'))
      expect(await screen.findByText('45 min')).toBeInTheDocument() // bodyweight-free set at 0 kg: no volume shown
    })

    it('can be started by hand and reset', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Start now' }))
      await advance(65_000)
      expect(screen.getByRole('timer', { name: 'Workout time' })).toHaveTextContent('1:05')
      expect(localStorage.getItem('fitness-tracker:session-start')).not.toBeNull()
      await user.click(screen.getByRole('button', { name: 'Reset' }))
      expect(screen.getByRole('button', { name: 'Start now' })).toBeInTheDocument()
      expect(localStorage.getItem('fitness-tracker:session-start')).toBeNull()
    })
  })

  it('lets you set or fix the duration when editing a workout', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Row', sets: sets([10, 50]) }]))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'History' }))
    expect(screen.getByText('500 kg volume')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const form = within(screen.getByRole('form', { name: 'Edit workout' }))
    expect(form.queryByRole('timer')).not.toBeInTheDocument()
    await user.type(form.getByLabelText('Duration (minutes, optional)'), 'abc')
    await user.click(form.getByRole('button', { name: 'Save changes' }))
    expect(form.getByRole('alert')).toHaveTextContent('Duration must be a number of minutes')
    await user.clear(form.getByLabelText('Duration (minutes, optional)'))
    await user.type(form.getByLabelText('Duration (minutes, optional)'), '75')
    await user.click(form.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('1 h 15 min · 500 kg volume')).toBeInTheDocument()
  })

  it('keeps an unsaved workout when the app is closed and reopened', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await addExercise(user, 'Squat')
    await user.selectOptions(screen.getByLabelText('Exercise 1 rest'), '180')
    await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '5')
    await user.type(screen.getByLabelText('Exercise 1 set 1 weight'), '100')
    await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await addExercise(user, 'Run')
    await user.type(screen.getByLabelText('Exercise 2 minutes'), '10')
    await user.type(screen.getByLabelText('Notes (optional)'), 'felt strong')
    first.unmount() // the phone closes the app

    render(<App />)
    expect(await screen.findByText('Picked up your unsaved workout where you left off.')).toBeInTheDocument()
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Squat')
    expect(screen.getByLabelText('Exercise 1 set 1 weight')).toHaveValue('100')
    expect(screen.getByLabelText('Exercise 1 rest')).toHaveValue('180')
    expect(screen.getByRole('button', { name: 'Exercise 1 set 1 done' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Exercise 2 minutes')).toHaveValue('10')
    expect(screen.getByLabelText('Notes (optional)')).toHaveValue('felt strong')
    expect(screen.getByRole('timer', { name: 'Workout time' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.queryByText(/Picked up your unsaved workout/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(await screen.findByText('Workout saved')).toBeInTheDocument()
    expect(localStorage.getItem('fitness-tracker:draft')).toBeNull()
  })

  it('lets you discard a restored workout', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    const first = render(<App />)
    await addExercise(user, 'Squat')
    await user.click(screen.getByRole('button', { name: 'Start now' }))
    first.unmount()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(screen.queryByLabelText('Exercise 1 name')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start now' })).toBeInTheDocument()
    expect(localStorage.getItem('fitness-tracker:draft')).toBeNull()
  })

  it('does not show a restore note when there is nothing to restore, or when editing', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Row', sets: sets([10, 50]) }]))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Log workout' })
    expect(screen.queryByText(/Picked up your unsaved workout/)).not.toBeInTheDocument()
    await addExercise(user, 'Squat') // in-progress new workout
    await user.click(tab('History'))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const form = within(screen.getByRole('form', { name: 'Edit workout' }))
    expect(form.queryByText(/Picked up your unsaved workout/)).not.toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Save changes' }))
    // The new workout in progress is untouched by editing an old one
    await user.click(tab('Log'))
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Squat')
    expect(JSON.parse(localStorage.getItem('fitness-tracker:draft')!).exercises[0].name).toBe('Squat')
  })

  describe('profile', () => {
    it('welcomes a new user and sets up a profile with height and body weight', async () => {
      const user = userEvent.setup()
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Set up profile' }))
      await user.click(screen.getByRole('button', { name: 'Save profile' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.')

      await user.type(screen.getByLabelText('Name'), 'Sam')
      await user.type(screen.getByLabelText('Height (cm)'), '175')
      await user.type(screen.getByLabelText('Birth year (optional)'), '2008')
      await user.click(screen.getByRole('button', { name: 'Save profile' }))
      expect(await screen.findByText('Profile saved')).toBeInTheDocument()
      expect(await getProfile()).toMatchObject({ name: 'Sam', heightCm: 175, birthYear: 2008 })
      expect(screen.getByRole('button', { name: 'Profile' })).toHaveTextContent('Sam')

      await user.type(screen.getByLabelText('Weight (kg)'), '70.5')
      await user.click(screen.getByRole('button', { name: 'Log weight' }))
      expect(await screen.findByText('Weight logged')).toBeInTheDocument()
      expect(screen.getByText('70.5 kg', { selector: 'strong' })).toBeInTheDocument()

      await user.click(tab('Log'))
      expect(screen.queryByRole('button', { name: 'Set up profile' })).not.toBeInTheDocument()
    })

    it('uses feet and inches with pounds, and keeps the profile across restarts', async () => {
      localStorage.setItem('fitness-tracker:unit', 'lb')
      const user = userEvent.setup()
      const first = render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Settings' }))
      await user.type(screen.getByLabelText('Name'), 'Dad')
      await user.type(screen.getByLabelText('Height feet'), '5')
      await user.type(screen.getByLabelText('Height inches'), '10')
      await user.click(screen.getByRole('button', { name: 'Save profile' }))
      expect(await screen.findByText('Profile saved')).toBeInTheDocument()
      expect((await getProfile())?.heightCm).toBeCloseTo(177.8, 5)
      await user.type(screen.getByLabelText('Weight (lb)'), '180')
      await user.click(screen.getByRole('button', { name: 'Log weight' }))
      expect((await listBodyWeights())[0].weightKg).toBeCloseTo(81.65, 2)
      first.unmount()

      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Settings' }))
      expect(screen.getByLabelText('Name')).toHaveValue('Dad')
      expect(screen.getByLabelText('Height feet')).toHaveValue('5')
      expect(screen.getByLabelText('Height inches')).toHaveValue('10')
      expect(screen.getByText('180 lb', { selector: 'strong' })).toBeInTheDocument()
    })

    it('charts body weight in Progress', async () => {
      await saveProfile({ name: 'Sam', updatedAt: 'x' })
      await saveBodyWeight({ date: '2026-01-01', weightKg: 72 })
      await saveBodyWeight({ date: '2026-01-15', weightKg: 70.5 })
      await saveBodyWeight({ date: '2026-02-01', weightKg: 71 })
      const user = userEvent.setup()
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Progress' }))
      expect(await screen.findByRole('heading', { name: 'Summary' })).toBeInTheDocument()
      expect(screen.getByText('−1 kg')).toBeInTheDocument()
      expect(screen.getByText('70.5 kg')).toBeInTheDocument()
    })

    it('deletes a weigh-in, and the whole profile from Delete data', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      await saveProfile({ name: 'Sam', updatedAt: 'x' })
      await saveBodyWeight({ date: '2026-01-01', weightKg: 72 })
      await saveBodyWeight({ date: '2026-01-15', weightKg: 70.5 })
      await saveWorkout(workout('2026-01-01', [{ name: 'Row', sets: sets([10, 50]) }]))
      const user = userEvent.setup()
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Settings' }))
      await user.click(screen.getByRole('button', { name: /Delete weigh-in on .*Jan 15, 2026/ }))
      expect(await screen.findByText('72 kg', { selector: 'strong' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Delete profile & weigh-ins' }))
      expect(await screen.findByText('Deleted profile and weigh-ins.')).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveValue('')
      expect(await listBodyWeights()).toEqual([])
      expect(screen.getByRole('button', { name: 'Delete all workouts (1)' })).toBeInTheDocument()
    })
  })

  describe('rest alert sound', () => {
    /** Records every tone played instead of making sound. */
    let tones: { freq: number; type: string }[]
    class FakeAudioContext {
      state = 'running'
      currentTime = 0
      destination = {}
      resume() {
        return Promise.resolve()
      }
      createDynamicsCompressor() {
        return { threshold: { value: 0 }, ratio: { value: 0 }, connect: () => {} }
      }
      createGain() {
        const param = { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }
        return { gain: param, connect: (n: unknown) => n }
      }
      createOscillator() {
        const osc = { type: 'sine', frequency: { value: 0 }, connect: (n: unknown) => n, stop: () => {}, start: () => tones.push({ freq: osc.frequency.value, type: osc.type }) }
        return osc
      }
    }

    beforeEach(() => {
      tones = []
      vi.stubGlobal('AudioContext', FakeAudioContext)
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    })
    /** Moves the clock forward a second at a time, letting the screen update in between like the real app. */
    const advance = async (ms: number) => {
      for (let t = 0; t < ms; t += 1000) await act(() => vi.advanceTimersByTime(Math.min(1000, ms - t)))
    }

    it('pips 3-2-1, then plays a loud alert that repeats twice', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await addExercise(user, 'Squat')
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      await advance(86_000)
      expect(tones).toEqual([])
      await advance(3_000) // 3, 2, 1
      expect(tones.map((t) => t.freq)).toEqual([1568, 1568, 1568])
      await advance(1_000) // rest over
      expect(tones.slice(3).map((t) => t.freq)).toEqual([2093, 2093, 2637])
      expect(tones.every((t) => t.type === 'square')).toBe(true)
      await advance(4_500)
      expect(tones).toHaveLength(3 + 9)
      await advance(10_000)
      expect(tones).toHaveLength(3 + 9) // no more after the two repeats
    })

    it('stops repeating when dismissed, and stays quiet with sound off', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await addExercise(user, 'Squat')
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      await advance(90_500)
      expect(tones).toHaveLength(6)
      await user.click(screen.getByRole('button', { name: 'Dismiss' }))
      await advance(5_000)
      expect(tones).toHaveLength(6)

      await user.click(tab('Settings'))
      await user.click(screen.getByRole('checkbox', { name: /Beep when rest is over/ }))
      await user.click(tab('Log'))
      await user.click(screen.getByRole('button', { name: '+ Add set' }))
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 2 done' }))
      await advance(95_000)
      expect(tones).toHaveLength(6)
    })

    it('has a Test sound button in Settings', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Settings' }))
      await user.click(screen.getByRole('button', { name: 'Test sound' }))
      expect(tones.map((t) => t.freq)).toEqual([2093, 2093, 2637])
    })
  })

  describe('rest over flash', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    })
    afterEach(() => vi.useRealTimers())
    const advance = async (ms: number) => {
      for (let t = 0; t < ms; t += 1000) await act(() => vi.advanceTimersByTime(Math.min(1000, ms - t)))
    }
    const flash = () => screen.queryByRole('button', { name: 'Rest over. Tap to continue' })

    it('fills the screen when rest is over; tapping it dismisses the timer', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await addExercise(user, 'Squat')
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      await advance(89_000)
      expect(flash()).not.toBeInTheDocument()
      await advance(1_000)
      expect(flash()).toHaveTextContent('REST OVER')
      await user.click(flash()!)
      expect(flash()).not.toBeInTheDocument()
      expect(screen.queryByRole('timer', { name: 'Rest timer' })).not.toBeInTheDocument()
    })

    it('can be turned off in Settings', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<App />)
      await user.click(await screen.findByRole('button', { name: 'Settings' }))
      await user.click(screen.getByRole('checkbox', { name: /Flash the screen/ }))
      expect(localStorage.getItem('fitness-tracker:rest-flash')).toBe('off')
      await user.click(tab('Log'))
      await addExercise(user, 'Squat')
      await user.click(screen.getByRole('button', { name: 'Exercise 1 set 1 done' }))
      await advance(91_000)
      expect(screen.getByRole('timer', { name: 'Rest timer' })).toHaveTextContent('Rest over')
      expect(flash()).not.toBeInTheDocument()
    })
  })
})
