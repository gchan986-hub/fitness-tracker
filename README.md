# Fitness Tracker

A mobile-friendly workout log you can install on your phone's home screen (PWA).

- **Log** workouts mixing **weights** (sets, reps, weight) and **cardio** (distance, time, live pace). Each exercise has a Weights/Cardio switch; distance is optional for things like classes. Picking an exercise you've done before switches to its type and pre-fills last session's numbers; “Add set” copies the previous set.
- **History** of every workout, newest first, with total weights volume and cardio distance. Edit or delete any entry.
- **Progress** chart per exercise. Weights: estimated 1-rep max, heaviest set or volume. Cardio: distance, pace or time. Plus personal records for each.
- **Routines**: save a session's exercises as a named routine (e.g. "Push day"), optionally tagged with weekdays. On the Log screen, tap a routine to load its exercises filled in with your latest numbers; routines planned for that day are shown first, marked "Today". Create, edit, reorder and delete routines on the Routines tab, or save any past workout from History as a routine.
- **Adding exercises**: the Log screen starts empty. "+ Add exercise" opens a full-screen list with body-part tabs (All, Yours, Chest, Back, Legs, Shoulders, Arms, Core, Full body, Cardio) and search. Tap an exercise and it's added to the workout with last session's numbers. Your own exercises come first and are sorted into body parts when the name matches the ~75 built-in suggestions (`src/lib/defaultExercises.ts`). Anything not listed can be added as weights or cardio. The routine editor uses the same list.
- **Equipment** for every weights exercise: Barbell, Dumbbell, Machine, Plate-loaded, Cable, Kettlebell, Smith machine, Bodyweight or Band. Built-in exercises come with a usual default you can change. The same lift on different equipment is tracked separately (its own progress chart, records and pre-filled numbers). Dumbbell weight is per dumbbell; bodyweight weight is added weight. Workouts logged before equipment existed take the default for that exercise.
- **Rest timer**: tap ✓ on a set to mark it done and start a countdown. Each weights exercise has its own **Rest** choice (default from Settings); it's saved with the workout and comes back next time you do that exercise. A bar above the tabs shows the time left with −15s / +15s / Skip, with 3-2-1 pips at the end, then a rising three-note chime (repeated twice unless dismissed), a 5-second full-screen green flash (tap to dismiss sooner; can be turned off), and a vibration where supported. Settings has Test sound and Test flash buttons, and shows the app version at the bottom. The app checks for updates whenever it comes back on screen. It keeps the screen awake while counting and survives switching tabs or reopening the app. On iPhone the beep follows the silent switch and needs the app open.
- **Workout timer**: starts when you tick your first set (or tap "Start now"), shows the elapsed time on the Log screen, and is saved as the workout's duration in History. Durations can be set or corrected when editing a workout.
- **Unsaved workout is kept**: the workout you're logging (exercises, sets, ticks, rest choices, notes, date, routine) is saved on the device as you go and restored if the app is closed, with an OK / Discard note. It's cleared when you tap Save workout.
- **Profile**: name, height (cm, or ft/in when using lb) and optional birth year, plus a body weight log (one weigh-in per day) charted in Progress. A first-launch prompt asks a new user to set it up. Each device has its own profile and data, so sharing the link gives someone their own separate app.
- **Settings**: kg or lb, km or mi, and backup export/import as JSON (includes routines).

Data stays on your device in the browser (IndexedDB). There are no accounts and no server. Use **Settings → Download backup** regularly. Clearing the browser's site data deletes your workouts.

## Install on your phone

Open the published URL, then:
- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** menu → *Install app*.

It works offline after the first visit.

## Develop

Requires Node 22+.

```sh
npm install
npm run dev        # local dev server
npm test           # unit + UI tests (Vitest, jsdom, fake-indexeddb)
npm run lint
npm run build      # production build in dist/
```

## Stack

React + TypeScript + Vite, `idb` for IndexedDB, Recharts for charts, `vite-plugin-pwa` for the service worker and manifest, Vitest + Testing Library for tests.

```
src/
  lib/          pure logic and storage (types, stats, units, validation, db)
  components/   WorkoutForm, History, Progress, Routines, Settings and shared pieces
  App.tsx       tabs and app state
```

Weights are always stored in kilograms and distances in kilometres, converted for display. Workouts saved before cardio was added still load unchanged. Estimated 1RM uses the Epley formula: `weight × (1 + reps / 30)`.

## Deploy

`.github/workflows/ci.yml` runs lint, tests and a build on every push and PR, and deploys `main` to GitHub Pages. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Roadmap

- Weekly summary and streaks

### Later: a native iPhone app

The plan is to use this as a home-screen web app first and turn it into a real App Store app later
(likely React Native + Expo), possibly with accounts and cloud sync so other people can use it.
To keep that move cheap, everything in `src/lib/` (data model, stats, units, validation) is plain
TypeScript with no React or browser dependencies except `db.ts`, which is the only file that touches
storage. A native app would reuse `src/lib/` and its tests, and swap `db.ts` for on-device SQLite
or a synced backend. The JSON backup format is the migration path for existing workouts.
