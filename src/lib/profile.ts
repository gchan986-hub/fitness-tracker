import type { BodyWeight, Profile } from './types'

const CM_PER_IN = 2.54

export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const total = Math.round(cm / CM_PER_IN)
  return { ft: Math.floor(total / 12), inches: total % 12 }
}

export const ftInToCm = (ft: number, inches: number) => (ft * 12 + inches) * CM_PER_IN

export function formatHeight(cm: number, metric: boolean): string {
  if (metric) return `${Math.round(cm)} cm`
  const { ft, inches } = cmToFtIn(cm)
  return `${ft}′${inches}″`
}

export function validateProfile(p: Omit<Profile, 'updatedAt'>, thisYear = new Date().getFullYear()): string[] {
  const errors: string[] = []
  if (!p.name.trim()) errors.push('Enter a name.')
  if (p.name.trim().length > 40) errors.push('Keep the name under 40 characters.')
  if (p.heightCm !== undefined && (!Number.isFinite(p.heightCm) || p.heightCm < 50 || p.heightCm > 250))
    errors.push('Height looks wrong. Check the numbers.')
  if (p.birthYear !== undefined && (!Number.isInteger(p.birthYear) || p.birthYear < 1900 || p.birthYear > thisYear))
    errors.push(`Birth year must be between 1900 and ${thisYear}.`)
  return errors
}

export function validateBodyWeight(b: BodyWeight): string[] {
  const errors: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) errors.push('Pick a valid date.')
  if (!Number.isFinite(b.weightKg) || b.weightKg < 20 || b.weightKg > 400) errors.push('Enter a realistic body weight.')
  return errors
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const optNum = (v: unknown) => v === undefined || typeof v === 'number'

export function isProfile(v: unknown): v is Profile {
  return isObj(v) && typeof v.name === 'string' && typeof v.updatedAt === 'string' && optNum(v.heightCm) && optNum(v.birthYear)
}

export function isBodyWeight(v: unknown): v is BodyWeight {
  return isObj(v) && typeof v.date === 'string' && typeof v.weightKg === 'number'
}

/** Oldest first. */
export const sortWeighIns = (list: BodyWeight[]) => [...list].sort((a, b) => a.date.localeCompare(b.date))
