# Fitness Tracker

A mobile-friendly workout log you can install on your phone's home screen (PWA).

- **Log** workouts: exercises with sets, reps and weight. Picking an exercise you've done before pre-fills last session's sets; “Add set” copies the previous set.
- **History** of every workout, newest first, with total volume. Edit or delete any entry.
- **Progress** chart per exercise (estimated 1-rep max, heaviest set, or volume) plus personal records.
- **Settings**: kg or lb, and backup export/import as JSON.

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
  components/   WorkoutForm, History, Progress, Settings
  App.tsx       tabs and app state
```

Weights are always stored in kilograms and converted for display. Estimated 1RM uses the Epley formula: `weight × (1 + reps / 30)`.

## Deploy

`.github/workflows/ci.yml` runs lint, tests and a build on every push and PR, and deploys `main` to GitHub Pages. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Roadmap

- Cardio (distance / time / pace)
- Saved routines and a rest timer
- Weekly summary and streaks

### Later: a native iPhone app

The plan is to use this as a home-screen web app first and turn it into a real App Store app later
(likely React Native + Expo), possibly with accounts and cloud sync so other people can use it.
To keep that move cheap, everything in `src/lib/` (data model, stats, units, validation) is plain
TypeScript with no React or browser dependencies except `db.ts`, which is the only file that touches
storage. A native app would reuse `src/lib/` and its tests, and swap `db.ts` for on-device SQLite
or a synced backend. The JSON backup format is the migration path for existing workouts.
