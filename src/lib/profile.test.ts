import { describe, expect, it } from 'vitest'
import { cmToFtIn, formatHeight, ftInToCm, validateBodyWeight, validateProfile } from './profile'

describe('height', () => {
  it('converts between cm and feet/inches', () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, inches: 11 })
    expect(cmToFtIn(182.88)).toEqual({ ft: 6, inches: 0 })
    expect(ftInToCm(5, 10)).toBeCloseTo(177.8, 5)
    expect(formatHeight(177.8, true)).toBe('178 cm')
    expect(formatHeight(177.8, false)).toBe('5′10″')
  })
})

describe('validation', () => {
  it('needs a name; height and birth year are optional but checked', () => {
    expect(validateProfile({ name: 'Sam' }, 2026)).toEqual([])
    expect(validateProfile({ name: ' ', heightCm: 20, birthYear: 2030 }, 2026)).toEqual([
      'Enter a name.',
      'Height looks wrong. Check the numbers.',
      'Birth year must be between 1900 and 2026.',
    ])
  })
  it('checks weigh-ins', () => {
    expect(validateBodyWeight({ date: '2026-01-01', weightKg: 80 })).toEqual([])
    expect(validateBodyWeight({ date: '', weightKg: NaN })).toEqual(['Pick a valid date.', 'Enter a realistic body weight.'])
  })
})
