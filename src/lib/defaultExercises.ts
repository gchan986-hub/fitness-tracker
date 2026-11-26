import type { ExerciseKind } from './types'

export interface DefaultExercise {
  name: string
  kind: ExerciseKind
  group: string
}

const w = (group: string, names: string[]): DefaultExercise[] =>
  names.map((name) => ({ name, kind: 'strength', group }))

/** Built-in suggestions shown in the exercise list. Groups are listed in display order. */
export const DEFAULT_EXERCISES: DefaultExercise[] = [
  ...w('Chest', [
    'Bench Press',
    'Incline Bench Press',
    'Dumbbell Bench Press',
    'Incline Dumbbell Press',
    'Chest Fly',
    'Cable Crossover',
    'Push-up',
    'Dip',
  ]),
  ...w('Back', [
    'Deadlift',
    'Pull-up',
    'Chin-up',
    'Lat Pulldown',
    'Barbell Row',
    'Dumbbell Row',
    'Seated Cable Row',
    'T-Bar Row',
    'Face Pull',
  ]),
  ...w('Legs', [
    'Squat',
    'Front Squat',
    'Goblet Squat',
    'Leg Press',
    'Romanian Deadlift',
    'Lunge',
    'Bulgarian Split Squat',
    'Leg Extension',
    'Leg Curl',
    'Hip Thrust',
    'Calf Raise',
  ]),
  ...w('Shoulders', [
    'Overhead Press',
    'Dumbbell Shoulder Press',
    'Arnold Press',
    'Lateral Raise',
    'Front Raise',
    'Rear Delt Fly',
    'Upright Row',
    'Shrug',
  ]),
  ...w('Arms', [
    'Barbell Curl',
    'Dumbbell Curl',
    'Hammer Curl',
    'Preacher Curl',
    'Cable Curl',
    'Tricep Pushdown',
    'Skull Crusher',
    'Overhead Tricep Extension',
    'Close-Grip Bench Press',
  ]),
  ...w('Core', ['Crunch', 'Cable Crunch', 'Hanging Leg Raise', 'Russian Twist', 'Ab Wheel Rollout']),
  ...w('Full body', ['Kettlebell Swing', 'Power Clean', 'Thruster']),
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
