import { useState } from 'react'
import { DEFAULT_GROUPS } from '../lib/defaultExercises'
import { exerciseKey, type CatalogItem } from '../lib/stats'
import type { ExerciseKind } from '../lib/types'

interface Props {
  catalog: CatalogItem[]
  /** Names already chosen; shown with a check mark. */
  selected: string[]
  onPick: (item: CatalogItem) => void
  onClose: () => void
}

const KIND_LABEL: Record<ExerciseKind, string> = { strength: 'Weights', cardio: 'Cardio' }
const OWN = 'Your exercises'

/** Your own exercises first, then built-in suggestions by body area; empty sections are dropped. */
function sections(items: CatalogItem[]): [string, CatalogItem[]][] {
  const order = [OWN, ...DEFAULT_GROUPS]
  const byGroup = new Map<string, CatalogItem[]>()
  for (const item of items) {
    const g = item.group ?? OWN
    byGroup.set(g, [...(byGroup.get(g) ?? []), item])
  }
  return order.filter((g) => byGroup.has(g)).map((g) => [g, byGroup.get(g)!])
}

/** Searchable list of every known exercise, with a way to add a new one. */
export function ExercisePicker({ catalog, selected, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const key = exerciseKey(query)
  const chosen = new Set(selected.map(exerciseKey))
  const matches = catalog.filter((c) => exerciseKey(c.name).includes(key))
  const exact = catalog.some((c) => exerciseKey(c.name) === key)
  const addNew = (kind: ExerciseKind) => {
    onPick({ name: query.trim().replace(/\s+/g, ' '), kind })
    setQuery('')
  }

  return (
    <div className="card picker" role="group" aria-label="Exercise list">
      <div className="picker-head">
        <input
          aria-label="Search exercises"
          placeholder="Search, or type a new exercise"
          value={query}
          autoCapitalize="words"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="secondary" onClick={onClose}>
          Done
        </button>
      </div>
      {matches.length > 0 && (
        <div className="picker-list">
          {sections(matches).map(([title, items]) => (
            <section key={title} aria-label={title}>
              <h4 className="picker-group">{title}</h4>
              <ul>
                {items.map((c) => {
                  const isChosen = chosen.has(exerciseKey(c.name))
                  return (
                    <li key={c.name}>
                      <button type="button" aria-label={`Add ${c.name}`} onClick={() => onPick(c)}>
                        <span>{c.name}</span>
                        <span className={isChosen ? 'tag added' : 'tag'}>
                          {isChosen ? '✓ Added' : KIND_LABEL[c.kind]}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {key && !exact && (
        <div className="actions start">
          <button type="button" className="secondary" onClick={() => addNew('strength')}>
            Add “{query.trim()}” as weights
          </button>
          <button type="button" className="secondary" onClick={() => addNew('cardio')}>
            Add “{query.trim()}” as cardio
          </button>
        </div>
      )}
    </div>
  )
}
