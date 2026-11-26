import type { Equipment } from './types'

/** Display order for pickers. */
export const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'plate', label: 'Plate-loaded' },
  { value: 'cable', label: 'Cable' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'smith', label: 'Smith machine' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'band', label: 'Band' },
]

const LABELS = new Map(EQUIPMENT.map((e) => [e.value, e.label]))

export const equipmentLabel = (e: Equipment): string => LABELS.get(e) ?? e

export const isEquipment = (v: unknown): v is Equipment => typeof v === 'string' && LABELS.has(v as Equipment)

/** "Bench Press · Dumbbell", or just the name when no equipment is set. */
export function exerciseLabel(name: string, equipment?: Equipment): string {
  return equipment ? `${name} · ${equipmentLabel(equipment)}` : name
}
