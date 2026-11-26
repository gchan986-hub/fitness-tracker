import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { _resetForTests, saveWorkout } from './lib/db'
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

    const reps = screen.getByLabelText('Exercise 1 set 1 reps')
    await user.clear(reps)
    await user.type(reps, '12')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
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
})
