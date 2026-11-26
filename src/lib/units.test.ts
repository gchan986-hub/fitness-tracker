import { describe, expect, it } from 'vitest'
import { formatDistance, formatDuration, formatPace, formatWeight, fromKg, fromKm, toKg, toKm } from './units'

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

describe('distance and time', () => {
  it('round-trips miles and formats distance to two decimals', () => {
    expect(fromKm(toKm(3.1, 'mi'), 'mi')).toBeCloseTo(3.1, 10)
    expect(formatDistance(5, 'km')).toBe('5 km')
    expect(formatDistance(5, 'mi')).toBe('3.11 mi')
  })
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(1505)).toBe('25:05')
    expect(formatDuration(3900)).toBe('1:05:00')
  })
  it('formats pace per unit', () => {
    expect(formatPace(300, 'km')).toBe('5:00 /km')
    expect(formatPace(300, 'mi')).toBe('8:03 /mi')
  })
})
