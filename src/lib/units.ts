import type { WeightUnit } from './types'

export const KG_PER_LB = 0.45359237

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB
}

/** Rounds to at most one decimal place and drops a trailing ".0". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const v = Math.round(fromKg(kg, unit) * 10) / 10
  return `${v} ${unit}`
}
