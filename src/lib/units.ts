import type { DistanceUnit, WeightUnit } from './types'

export const KG_PER_LB = 0.45359237
export const KM_PER_MI = 1.609344

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

export function toKm(value: number, unit: DistanceUnit): number {
  return unit === 'km' ? value : value * KM_PER_MI
}

export function fromKm(km: number, unit: DistanceUnit): number {
  return unit === 'km' ? km : km / KM_PER_MI
}

/** Rounds to at most two decimal places. */
export function formatDistance(km: number, unit: DistanceUnit): string {
  const v = Math.round(fromKm(km, unit) * 100) / 100
  return `${v} ${unit}`
}

/** 1500 → "25:00", 3900 → "1:05:00". */
export function formatDuration(totalSec: number): string {
  const t = Math.round(totalSec)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = String(t % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Seconds per km converted to seconds per chosen unit. */
export function paceInUnit(secPerKm: number, unit: DistanceUnit): number {
  return unit === 'km' ? secPerKm : secPerKm * KM_PER_MI
}

/** 300 s/km → "5:00 /km". */
export function formatPace(secPerKm: number, unit: DistanceUnit): string {
  return `${formatDuration(paceInUnit(secPerKm, unit))} /${unit}`
}
