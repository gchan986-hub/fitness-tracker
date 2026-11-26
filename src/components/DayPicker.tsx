import { DAYS } from '../lib/routines'

interface Props {
  value: number[]
  onChange: (days: number[]) => void
}

/** Toggle buttons for the days of the week a routine is planned for. */
export function DayPicker({ value, onChange }: Props) {
  return (
    <fieldset className="days">
      <legend>Days (optional)</legend>
      <div className="day-buttons">
        {DAYS.map((x) => (
          <button
            key={x.d}
            type="button"
            aria-label={x.long}
            aria-pressed={value.includes(x.d)}
            onClick={() => onChange(value.includes(x.d) ? value.filter((d) => d !== x.d) : [...value, x.d])}
          >
            {x.short}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
