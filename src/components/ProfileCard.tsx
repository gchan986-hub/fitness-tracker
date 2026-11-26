import { useState } from 'react'
import { formatDate, todayLocal } from '../lib/id'
import { cmToFtIn, ftInToCm, formatHeight, sortWeighIns, validateBodyWeight, validateProfile } from '../lib/profile'
import type { BodyWeight, Profile, Units } from '../lib/types'
import { formatWeight, fromKg, toKg } from '../lib/units'

interface Props {
  profile?: Profile
  bodyWeights: BodyWeight[]
  units: Units
  onSaveProfile: (p: Profile) => Promise<void>
  onAddWeight: (b: BodyWeight) => Promise<void>
  onDeleteWeight: (b: BodyWeight) => Promise<void>
}

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.trim().replace(',', '.')))

/** Name, height, birth year and body weight log for whoever uses the app on this device. */
export function ProfileCard({ profile, bodyWeights, units, onSaveProfile, onAddWeight, onDeleteWeight }: Props) {
  const metric = units.weight === 'kg'
  const ftIn = profile?.heightCm ? cmToFtIn(profile.heightCm) : undefined
  const [name, setName] = useState(profile?.name ?? '')
  const [cm, setCm] = useState(profile?.heightCm ? String(Math.round(profile.heightCm)) : '')
  const [ft, setFt] = useState(ftIn ? String(ftIn.ft) : '')
  const [inches, setInches] = useState(ftIn ? String(ftIn.inches) : '')
  const [birthYear, setBirthYear] = useState(profile?.birthYear ? String(profile.birthYear) : '')
  const [profileErrors, setProfileErrors] = useState<string[]>([])

  const [weight, setWeight] = useState('')
  const [weightDate, setWeightDate] = useState(todayLocal())
  const [weightErrors, setWeightErrors] = useState<string[]>([])

  const heightCm = (): number | undefined => {
    if (metric) return num(cm)
    const f = num(ft)
    const i = num(inches)
    return f === undefined && i === undefined ? undefined : ftInToCm(f ?? NaN, i ?? 0)
  }

  const save = async () => {
    const h = heightCm()
    const y = num(birthYear)
    const input = { name: name.trim(), ...(h !== undefined ? { heightCm: h } : {}), ...(y !== undefined ? { birthYear: y } : {}) }
    const problems = validateProfile(input)
    setProfileErrors(problems)
    if (problems.length) return
    await onSaveProfile({ ...input, updatedAt: new Date().toISOString() })
  }

  const addWeight = async () => {
    const w = num(weight)
    const entry = { date: weightDate, weightKg: w === undefined ? NaN : toKg(w, units.weight) }
    const problems = validateBodyWeight(entry)
    setWeightErrors(problems)
    if (problems.length) return
    await onAddWeight(entry)
    setWeight('')
    setWeightDate(todayLocal())
  }

  const recent = sortWeighIns(bodyWeights).reverse()
  const latest = recent[0]

  return (
    <div className="card profile-card">
      <h3>Profile</h3>
      <p className="muted">Workouts, routines and weigh-ins on this device belong to this profile.</p>
      <label className="field">
        Name
        <input value={name} autoCapitalize="words" autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="profile-row">
        {metric ? (
          <label className="field">
            Height (cm)
            <input inputMode="numeric" value={cm} onChange={(e) => setCm(e.target.value)} />
          </label>
        ) : (
          <div className="field">
            Height
            <div className="ft-in">
              <input aria-label="Height feet" inputMode="numeric" placeholder="ft" value={ft} onChange={(e) => setFt(e.target.value)} />
              <input
                aria-label="Height inches"
                inputMode="numeric"
                placeholder="in"
                value={inches}
                onChange={(e) => setInches(e.target.value)}
              />
            </div>
          </div>
        )}
        <label className="field">
          Birth year (optional)
          <input inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
        </label>
      </div>
      {profileErrors.length > 0 && (
        <ul className="errors" role="alert">
          {profileErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="primary" onClick={save}>
          Save profile
        </button>
      </div>

      <h3>Body weight</h3>
      {latest ? (
        <p>
          <strong>{formatWeight(latest.weightKg, units.weight)}</strong>{' '}
          <span className="muted">on {formatDate(latest.date)}</span>
          {profile?.heightCm && <span className="muted"> · height {formatHeight(profile.heightCm, metric)}</span>}
        </p>
      ) : (
        <p className="muted">Log your weight now and then to see it as a chart in Progress.</p>
      )}
      <div className="profile-row">
        <label className="field">
          Weight ({units.weight})
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="field">
          Date
          <input type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value)} />
        </label>
      </div>
      {weightErrors.length > 0 && (
        <ul className="errors" role="alert">
          {weightErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="secondary" onClick={addWeight}>
          Log weight
        </button>
      </div>
      {recent.length > 0 && (
        <ul className="weigh-ins">
          {recent.slice(0, 5).map((b) => (
            <li key={b.date}>
              <span>{formatDate(b.date)}</span>
              <span>
                {Math.round(fromKg(b.weightKg, units.weight) * 10) / 10} {units.weight}
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete weigh-in on ${formatDate(b.date)}`}
                onClick={() => void onDeleteWeight(b)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
