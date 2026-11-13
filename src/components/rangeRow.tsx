/**
 * One numeric setting: a label, a slider for dragging, and a number field for typing an exact value.
 *
 * A value can be dragged to roughly or typed exactly. The number field holds half-typed text until it is a number in
 * range, so typing never jumps the slider.
 */
import { useId, useState } from 'react'

interface RangeRowProps {
  title: string
  hint?: string // the tooltip that explains the setting, or none
  value: number
  min: number
  max: number
  step?: number // the smallest change the slider and the number field make, 1 when left out
  disabled?: boolean // greys out the row and ignores input, for a setting that has no effect right now
  onChange: (value: number) => void
}

export function RangeRow({ title, hint, value, min, max, step = 1, disabled = false, onChange }: RangeRowProps) {
  const id = useId()

  // The text being typed, or null while the field shows the setting. Keeping the text lets the field hold a half-typed
  // number such as the 4 on the way to 45, which is below `min` for a setting like the field of view.
  const [draft, setDraft] = useState<string | null>(null)

  // Rounds a value to the nearest step, so a whole-number setting never receives a fraction.
  function snap(number: number): number {
    return Number((Math.round(number / step) * step).toFixed(6))
  }

  // A number in range applies at once. Anything else waits in the field until the typing is finished.
  function onTyped(text: string) {
    setDraft(text)
    const typed = snap(parseFloat(text))
    if (typed >= min && typed <= max) {
      onChange(typed)
    }
  }

  // Leaving the field ends the typing, so a number out of range is clamped and a blank field returns to the setting.
  function onTypingDone() {
    const typed = snap(parseFloat(draft ?? ''))
    if (!Number.isNaN(typed)) {
      onChange(Math.min(Math.max(typed, min), max))
    }
    setDraft(null)
  }

  // `useId` links each label to its slider, so tapping the label focuses it.
  return (
    <div className={`flex min-h-11 items-center gap-2.5 short:min-h-9 ${disabled ? 'opacity-40' : ''}`}>
      <label htmlFor={id} title={hint} className="w-24 flex-none text-xs font-semibold">
        {title}
      </label>
      <input
        id={id}
        title={hint}
        className="h-8 min-w-0 flex-1 disabled:cursor-not-allowed pointer-coarse:h-11 short:h-8 pointer-coarse:short:h-8"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={event => onChange(parseFloat(event.target.value))}
      />
      <input
        className="min-h-9 w-16 flex-none rounded-lg border border-gray-300 bg-gray-100 px-2 text-right text-xs tabular-nums disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-800 short:min-h-8"
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft ?? value}
        title={hint}
        aria-label={`${title} value`}
        disabled={disabled}
        onChange={event => onTyped(event.target.value)}
        onBlur={onTypingDone}
      />
    </div>
  )
}
