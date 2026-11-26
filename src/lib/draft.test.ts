import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, readDraft, saveDraft } from './draft'

beforeEach(() => localStorage.clear())

const exercise = {
  key: 'k1',
  kind: 'strength',
  name: 'Squat',
  sets: [{ key: 's1', reps: '5', weight: '100', done: true }],
  distance: '',
  minutes: '',
  seconds: '',
}

describe('workout draft', () => {
  it('round-trips a draft', () => {
    const d = { date: '2026-11-26', notes: 'heavy', routineName: 'Legs', exercises: [exercise] }
    saveDraft(d)
    expect(readDraft()).toEqual(d)
    clearDraft()
    expect(readDraft()).toBeNull()
  })
  it('does not keep an empty draft', () => {
    saveDraft({ date: '2026-11-26', notes: 'x', routineName: '', exercises: [] })
    saveDraft({ date: '2026-11-26', notes: ' ', routineName: '', exercises: [] })
    expect(localStorage.getItem('fitness-tracker:draft')).toBeNull()
  })
  it('ignores corrupt or unexpected data', () => {
    localStorage.setItem('fitness-tracker:draft', '{not json')
    expect(readDraft()).toBeNull()
    localStorage.setItem(
      'fitness-tracker:draft',
      JSON.stringify({ date: '2026-11-26', notes: '', routineName: '', exercises: [{ ...exercise, sets: 'nope' }] }),
    )
    expect(readDraft()).toBeNull()
  })
})
