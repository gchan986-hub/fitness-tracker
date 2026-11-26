import { useEffect, useState } from 'react'
import { DEFAULT_GROUPS } from '../lib/defaultExercises'
import { equipmentLabel, exerciseLabel } from '../lib/equipment'
import { catalogKey, exerciseKey, type CatalogItem } from '../lib/stats'
import type { ExerciseKind } from '../lib/types'

interface Props {
  catalog: CatalogItem[]
  /** Catalog keys (see catalogKey) already chosen; shown with a check mark. */
  selected: string[]
  onPick: (item: CatalogItem) => void
  onClose: () => void
  /** Panel heading, e.g. "Add exercise". */
  title: string
}

const tagFor = (c: CatalogItem) =>
  c.kind === 'cardio' ? 'Cardio' : c.equipment ? equipmentLabel(c.equipment) : 'Weights'
const ALL = 'All'
const YOURS = 'Yours'

/** Full-screen list of exercises with body-part tabs, search, and a way to add a new exercise. */
export function ExercisePicker({ catalog, selected, onPick, onClose, title }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(ALL)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const key = exerciseKey(query)
  const chosen = new Set(selected)
  const hasOwn = catalog.some((c) => c.own)
  const tabs = [ALL, ...(hasOwn ? [YOURS] : []), ...DEFAULT_GROUPS]
  const inTab = (c: CatalogItem) => filter === ALL || (filter === YOURS ? c.own : c.group === filter)
  const matches = catalog.filter((c) => inTab(c) && exerciseKey(c.name).includes(key))
  const exact = catalog.some((c) => exerciseKey(c.name) === key)

  // Browsing "All" without a search: your exercises, then suggestions by body part. Otherwise one list, yours first.
  const sections: [string, CatalogItem[]][] =
    filter === ALL && !key
      ? [
          ['Your exercises', matches.filter((c) => c.own)],
          ...DEFAULT_GROUPS.map((g): [string, CatalogItem[]] => [g, matches.filter((c) => !c.own && c.group === g)]),
        ].filter(([, items]) => items.length > 0) as [string, CatalogItem[]][]
      : [[filter === ALL ? 'Matches' : filter, [...matches.filter((c) => c.own), ...matches.filter((c) => !c.own)]]]

  const addNew = (kind: ExerciseKind) => {
    onPick({ name: query.trim().replace(/\s+/g, ' '), kind })
    setQuery('')
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-head">
        <h2>{title}</h2>
        <button type="button" className="secondary" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="filter-tabs" role="group" aria-label="Body part">
        {tabs.map((t) => (
          <button key={t} type="button" aria-pressed={filter === t} onClick={() => setFilter(t)}>
            {t}
          </button>
        ))}
      </div>
      <input
        className="sheet-search"
        type="search"
        aria-label="Search exercises"
        placeholder={filter === ALL ? 'Search all exercises' : `Search ${filter.toLowerCase()}`}
        value={query}
        autoCapitalize="words"
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="sheet-list">
        {matches.length === 0 && (
          <p className="muted">{key ? 'No matching exercises.' : 'Nothing here yet.'}</p>
        )}
        {matches.length > 0 &&
          sections.map(([heading, items]) => (
            <section key={heading} aria-label={heading}>
              <h3 className="picker-group">{heading}</h3>
              <ul>
                {items.map((c) => {
                  const isChosen = chosen.has(catalogKey(c))
                  return (
                    <li key={catalogKey(c)}>
                      <button
                        type="button"
                        aria-label={`Add ${exerciseLabel(c.name, c.kind === 'strength' ? c.equipment : undefined)}`}
                        onClick={() => onPick(c)}
                      >
                        <span>{c.name}</span>
                        <span className={isChosen ? 'tag added' : 'tag'}>{isChosen ? '✓ Added' : tagFor(c)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        {key && !exact && (
          <div className="add-new">
            <p className="muted">Not in the list? Add “{query.trim()}” as:</p>
            <div className="add-row">
              <button type="button" className="secondary" onClick={() => addNew('strength')}>
                Add “{query.trim()}” as weights
              </button>
              <button type="button" className="secondary" onClick={() => addNew('cardio')}>
                Add “{query.trim()}” as cardio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
