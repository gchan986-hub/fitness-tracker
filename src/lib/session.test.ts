import { beforeEach, describe, expect, it } from 'vitest'
import { formatSessionLength, readSessionStart, saveSessionStart } from './session'

beforeEach(() => localStorage.clear())

describe('session timer storage', () => {
  it('remembers and clears the start time', () => {
    expect(readSessionStart()).toBeNull()
    saveSessionStart(1_700_000_000_000)
    expect(readSessionStart()).toBe(1_700_000_000_000)
    saveSessionStart(null)
    expect(readSessionStart()).toBeNull()
  })
  it('formats session lengths', () => {
    expect(formatSessionLength(30)).toBe('1 min')
    expect(formatSessionLength(2700)).toBe('45 min')
    expect(formatSessionLength(3600)).toBe('1 h')
    expect(formatSessionLength(3900)).toBe('1 h 5 min')
  })
})
