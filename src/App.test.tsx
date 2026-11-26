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
})

const tab = (name: string) => screen.getByRole('button', { name })

describe('App', () => {
  it('logs a workout and shows it in history', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Log workout' })

    await user.type(screen.getByLabelText('Exercise 1 name'), 'Bench Press')
    await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '5')
    await user.type(screen.getByLabelText('Exercise 1 set 1 weight'), '80')
    await user.click(screen.getByRole('button', { name: '+ Add set' }))
    // New set copies the previous one
    expect(screen.getByLabelText('Exercise 1 set 2 weight')).toHaveValue('80')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    expect(await screen.findByText('Workout saved')).toBeInTheDocument()
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('')

    await user.click(tab('History'))
    expect(await screen.findByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('5×80 kg, 5×80 kg')).toBeInTheDocument()
    expect(screen.getByText('800 kg volume')).toBeInTheDocument()
  })

  it('shows validation errors instead of saving bad input', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Save workout' }))
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('Exercise 1 needs a name.')).toBeInTheDocument()
    expect(within(alert).getByText(/reps must be a whole number/)).toBeInTheDocument()
  })

  it('pre-fills last session’s sets for a known exercise', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100], [5, 102.5]) }]))
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Exercise 1 name'), 'squat')
    await user.tab()
    expect(screen.getByLabelText('Exercise 1 set 2 weight')).toHaveValue('102.5')
  })

  it('edits and deletes a workout from history', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Row', sets: sets([10, 50]) }]))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'History' }))
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    const form = within(screen.getByRole('form', { name: 'Edit workout' }))
    const reps = form.getByLabelText('Exercise 1 set 1 reps')
    await user.clear(reps)
    await user.type(reps, '12')
    await user.click(form.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('12×50 kg')).toBeInTheDocument()

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
    await user.click(await screen.findByRole('button', { name: 'Cardio' }))
    await user.type(screen.getByLabelText('Exercise 1 name'), 'Run')
    await user.type(screen.getByLabelText('Exercise 1 distance'), '5')
    await user.type(screen.getByLabelText('Exercise 1 minutes'), '25')
    expect(screen.getByText('Pace 5:00 /km')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Add exercise' }))
    await user.type(screen.getByLabelText('Exercise 2 name'), 'Squat')
    await user.type(screen.getByLabelText('Exercise 2 set 1 reps'), '5')
    await user.type(screen.getByLabelText('Exercise 2 set 1 weight'), '100')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(await screen.findByText('Workout saved')).toBeInTheDocument()

    await user.click(tab('History'))
    expect(await screen.findByText('5 km in 25:00 (5:00 /km)')).toBeInTheDocument()
    expect(screen.getByText('500 kg volume · 5 km')).toBeInTheDocument()
  })

  it('switches to cardio and pre-fills last time when a known activity is typed', async () => {
    await saveWorkout(workout('2026-01-01', [cardio('Run', 1530, 5)]))
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Exercise 1 name'), 'run')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cardio' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Exercise 1 minutes')).toHaveValue('25')
    expect(screen.getByLabelText('Exercise 1 seconds')).toHaveValue('30')
  })

  it('rejects cardio without a time', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Cardio' }))
    await user.type(screen.getByLabelText('Exercise 1 name'), 'Run')
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

  it('leaves the tapped field empty and focused when pre-filling', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Squat', sets: sets([5, 100], [5, 100]) }]))
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Exercise 1 name'), 'Squat')
    await user.click(screen.getByLabelText('Exercise 1 set 1 reps'))
    await user.keyboard('3')
    expect(screen.getByLabelText('Exercise 1 set 1 reps')).toHaveValue('3')
    expect(screen.getByLabelText('Exercise 1 set 1 reps')).toHaveFocus()
    expect(screen.getByLabelText('Exercise 1 set 1 weight')).toHaveValue('100')
    expect(screen.getByLabelText('Exercise 1 set 2 reps')).toHaveValue('5')
  })

  it('keeps an in-progress workout when switching tabs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByLabelText('Exercise 1 name'), 'Deadlift')
    await user.click(tab('History'))
    await user.click(tab('Log'))
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Deadlift')
  })

  it('saves a session as a routine and recalls it with the latest numbers', async () => {
    const user = userEvent.setup()
    render(<App />)
    const date = await screen.findByLabelText('Date')
    await user.clear(date)
    await user.type(date, '2026-11-23') // a Monday
    await user.type(screen.getByLabelText('Exercise 1 name'), 'Bench Press')
    await user.type(screen.getByLabelText('Exercise 1 set 1 reps'), '5')
    await user.type(screen.getByLabelText('Exercise 1 set 1 weight'), '80')
    await user.click(screen.getByRole('button', { name: '+ Add exercise' }))
    await user.click(screen.getAllByRole('button', { name: 'Cardio' })[1])
    await user.type(screen.getByLabelText('Exercise 2 name'), 'Run')
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
    await user.type(await screen.findByLabelText('Exercise 1 name'), 'Curl')
    await user.click(screen.getByRole('button', { name: 'Legs' }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Curl')
  })

  it('picks exercises from the catalog', async () => {
    await saveWorkout(workout('2026-01-01', [{ name: 'Row', sets: sets([10, 50]) }, cardio('Bike', 1800, 15)]))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Pick from list' }))
    await user.click(screen.getByRole('button', { name: 'Add Bike' }))
    await user.click(screen.getByRole('button', { name: 'Add Row' }))
    // The empty starting card is replaced, and numbers come from last time
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Bike')
    expect(screen.getByLabelText('Exercise 1 distance')).toHaveValue('15')
    expect(screen.getByLabelText('Exercise 2 set 1 weight')).toHaveValue('50')
    expect(screen.getByRole('button', { name: 'Add Row' })).toHaveTextContent('✓ Added')

    await user.type(screen.getByLabelText('Search exercises'), 'face pull')
    await user.click(screen.getByRole('button', { name: 'Add “face pull” as weights' }))
    expect(screen.getByLabelText('Exercise 3 name')).toHaveValue('face pull')
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
    await user.click(screen.getByRole('button', { name: 'Add Squat' }))
    await user.type(screen.getByLabelText('Search exercises'), 'Lunge')
    await user.click(screen.getByRole('button', { name: 'Add “Lunge” as weights' }))
    await user.click(screen.getByRole('button', { name: 'Move Lunge up' }))
    await user.click(screen.getByRole('button', { name: 'Save routine' }))

    expect(await screen.findByRole('heading', { name: 'Leg day' })).toBeInTheDocument()
    expect(screen.getByText('Lunge · Squat')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Lunge')
    expect(screen.getByLabelText('Exercise 2 set 1 weight')).toHaveValue('120')
    expect(screen.getByText('Leg day', { selector: 'strong' })).toBeInTheDocument()

    await user.click(tab('Routines'))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Remove Lunge' }))
    await user.click(screen.getByRole('button', { name: 'Save routine' }))
    expect(await screen.findByText('Squat')).toBeInTheDocument()

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
})
