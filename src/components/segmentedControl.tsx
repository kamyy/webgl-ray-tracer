/**
 * A choice between a few options, drawn as one button split into equal parts.
 *
 * Each part is an invisible radio button that fills its part, so a press anywhere on it selects it, keyboard focus
 * still works, and screen readers announce the parts as one group under the `legend`.
 */
import { useId } from 'react'

interface SegmentedControlProps<Value extends string | number> {
  legend: string // read aloud by screen readers, not drawn
  options: { value: Value; label: string }[]
  value: Value
  hint?: string // the tooltip over the whole control, or none
  disabled?: boolean // greys out the control and ignores presses, for a choice that has no effect right now
  onChange: (value: Value) => void
}

export function SegmentedControl<Value extends string | number>({
  legend,
  options,
  value,
  hint,
  disabled = false,
  onChange,
}: SegmentedControlProps<Value>) {
  const name = useId() // groups the radios, so arrow keys move between them

  return (
    <fieldset className={`mt-1 flex items-center ${disabled ? 'opacity-40' : ''}`} title={hint} disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      <div className="flex w-full overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
        {options.map(option => (
          <label key={option.value} className="relative flex-1">
            <input
              className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="block min-h-11 content-center px-4 text-center text-xs font-semibold text-gray-600 peer-checked:bg-(--accent) peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-(--accent) dark:text-gray-400 dark:peer-checked:text-gray-900 short:min-h-9">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
