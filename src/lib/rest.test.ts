import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_REST_SEC, readRestSec, readRestSound, readRestState, saveRestSec, saveRestSound, saveRestState } from './rest'

beforeEach(() => localStorage.clear())

describe('rest settings', () => {
  it('defaults to 90 seconds with sound on', () => {
    expect(readRestSec()).toBe(DEFAULT_REST_SEC)
    expect(readRestSound()).toBe(true)
  })
  it('remembers choices and ignores junk', () => {
    saveRestSec(120)
    saveRestSound(false)
    expect(readRestSec()).toBe(120)
    expect(readRestSound()).toBe(false)
    localStorage.setItem('fitness-tracker:rest-sec', '7')
    expect(readRestSec()).toBe(DEFAULT_REST_SEC)
  })
  it('restores a running timer but drops one that finished long ago', () => {
    saveRestState({ endAt: 100_000, totalSec: 90 })
    expect(readRestState(50_000)).toEqual({ endAt: 100_000, totalSec: 90 })
    expect(readRestState(200_000)).toBeNull()
    saveRestState(null)
    expect(readRestState(50_000)).toBeNull()
  })
})
