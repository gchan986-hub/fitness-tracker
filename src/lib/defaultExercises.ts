import type { Equipment, ExerciseKind } from './types'

export interface DefaultExercise {
  name: string
  kind: ExerciseKind
  group: string
  /** Usual equipment for a weights exercise; it can be changed when logging. */
  equipment?: Equipment
}

const w = (group: string, list: [string, Equipment][]): DefaultExercise[] =>
  list.map(([name, equipment]) => ({ name, kind: 'strength', group, equipment }))

/** Built-in suggestions shown in the exercise list. Groups are listed in display order. */
export const DEFAULT_EXERCISES: DefaultExercise[] = [
  ...w('Chest', [
    ['Bench Press', 'barbell'],
    ['Incline Bench Press', 'barbell'],
    ['Decline Bench Press', 'barbell'],
    ['Chest Press', 'machine'],
    ['Chest Fly', 'dumbbell'],
    ['Pec Deck', 'machine'],
    ['Cable Crossover', 'cable'],
    ['Push-up', 'bodyweight'],
    ['Dip', 'bodyweight'],
  ]),
  ...w('Back', [
    ['Deadlift', 'barbell'],
    ['Pull-up', 'bodyweight'],
    ['Chin-up', 'bodyweight'],
    ['Lat Pulldown', 'cable'],
    ['Bent-over Row', 'barbell'],
    ['One-arm Row', 'dumbbell'],
    ['Seated Cable Row', 'cable'],
    ['T-Bar Row', 'plate'],
    ['Chest-supported Row', 'machine'],
    ['Face Pull', 'cable'],
    ['Back Extension', 'bodyweight'],
  ]),
  ...w('Legs', [
    ['Squat', 'barbell'],
    ['Front Squat', 'barbell'],
    ['Goblet Squat', 'dumbbell'],
    ['Hack Squat', 'plate'],
    ['Leg Press', 'plate'],
    ['Romanian Deadlift', 'barbell'],
    ['Lunge', 'dumbbell'],
    ['Bulgarian Split Squat', 'dumbbell'],
    ['Leg Extension', 'machine'],
    ['Leg Curl', 'machine'],
    ['Hip Thrust', 'barbell'],
    ['Calf Raise', 'machine'],
  ]),
  ...w('Shoulders', [
    ['Overhead Press', 'barbell'],
    ['Shoulder Press', 'machine'],
    ['Arnold Press', 'dumbbell'],
    ['Lateral Raise', 'dumbbell'],
    ['Front Raise', 'dumbbell'],
    ['Rear Delt Fly', 'dumbbell'],
    ['Upright Row', 'barbell'],
    ['Shrug', 'dumbbell'],
  ]),
  ...w('Arms', [
    ['Bicep Curl', 'dumbbell'],
    ['Hammer Curl', 'dumbbell'],
    ['Preacher Curl', 'barbell'],
    ['Concentration Curl', 'dumbbell'],
    ['Tricep Pushdown', 'cable'],
    ['Skull Crusher', 'barbell'],
    ['Overhead Tricep Extension', 'dumbbell'],
    ['Close-Grip Bench Press', 'barbell'],
  ]),
  ...w('Core', [
    ['Crunch', 'bodyweight'],
    ['Cable Crunch', 'cable'],
    ['Hanging Leg Raise', 'bodyweight'],
    ['Russian Twist', 'bodyweight'],
    ['Ab Wheel Rollout', 'bodyweight'],
  ]),
  ...w('Full body', [
    ['Kettlebell Swing', 'kettlebell'],
    ['Turkish Get-up', 'kettlebell'],
    ['Power Clean', 'barbell'],
    ['Thruster', 'barbell'],
  ]),
  ...[
    'Run',
    'Treadmill',
    'Walk',
    'Hike',
    'Cycling',
    'Stationary Bike',
    'Spin Class',
    'Rowing Machine',
    'Elliptical',
    'Stair Climber',
    'Swim',
    'Jump Rope',
    'HIIT Class',
  ].map((name): DefaultExercise => ({ name, kind: 'cardio', group: 'Cardio' })),
]

export const DEFAULT_GROUPS = [...new Set(DEFAULT_EXERCISES.map((e) => e.group))]

const norm = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()
const DEFAULT_EQUIPMENT = new Map(
  DEFAULT_EXERCISES.flatMap((d) => (d.equipment ? [[norm(d.name), d.equipment] as const] : [])),
)

/** Usual equipment for a built-in exercise name, if any. */
export function defaultEquipmentFor(name: string): Equipment | undefined {
  return DEFAULT_EQUIPMENT.get(norm(name))
}
