import { describe, expect, it } from 'vitest'
import { formatWeight, fromKg, toKg } from './units'

describe('units', () => {
  it('round-trips pounds', () => {
    expect(fromKg(toKg(225, 'lb'), 'lb')).toBeCloseTo(225, 10)
    expect(toKg(100, 'kg')).toBe(100)
  })
  it('formats to one decimal', () => {
    expect(formatWeight(100, 'kg')).toBe('100 kg')
    expect(formatWeight(100, 'lb')).toBe('220.5 lb')
  })
})
