/**
 * The sliders, number fields and radio buttons that change how the scene is rendered.
 *
 * Each slider is paired with a number field, so a value can be dragged to or typed exactly. Each control writes its
 * value to the app store. `PathTracer` watches those values and restarts accumulation when one changes.
 */
import { useId } from 'react'
import { ShadingMethod, useAppStore } from '../lib/store/appStore'

// The limits of each setting. They bound both the sliders and the number fields.
const minSamples = 1
const maxSamples = 10000
const minBounces = 1
const maxBounces = 16
const minCameraFov = 10
const maxCameraFov = 120

// The choices in the shading control, in the order they are shown.
const shadingMethods = [
  { value: ShadingMethod.flat, label: 'Flat' },
  { value: ShadingMethod.phong, label: 'Phong' },
]

interface RangeRowProps {
  title: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

// One setting: a label, a slider for dragging, and a number field for typing an exact value.
function RangeRow({ title, value, min, max, onChange }: RangeRowProps) {
  const id = useId()

  // A half-typed number is ignored, so the field keeps its last valid value until the typing is a number in range.
  function onTyped(text: string) {
    const typed = parseInt(text)
    if (!Number.isNaN(typed)) {
      onChange(Math.min(Math.max(typed, min), max))
    }
  }

  // `useId` links each label to its slider, so tapping the label focuses it.
  return (
    <div className="flex min-h-11 items-center gap-2.5 short:min-h-9">
      <label htmlFor={id} className="w-20 flex-none text-xs font-semibold">
        {title}
      </label>
      <input
        id={id}
        className="h-8 min-w-0 flex-1 pointer-coarse:h-11 short:h-8 pointer-coarse:short:h-8"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={event => onChange(parseInt(event.target.value))}
      />
      <input
        className="min-h-9 w-16 flex-none short:min-h-8 rounded-lg border border-gray-300 bg-gray-100 px-2 dark:border-gray-600 dark:bg-gray-800 text-right text-xs tabular-nums"
        type="number"
        min={min}
        max={max}
        value={value}
        aria-label={`${title} value`}
        onChange={event => onTyped(event.target.value)}
      />
    </div>
  )
}

export function RenderSettings() {
  const cameraFov = useAppStore(state => state.cameraFov)
  const numSamples = useAppStore(state => state.numSamples)
  const numBounces = useAppStore(state => state.numBounces)
  const shadingMethod = useAppStore(state => state.shadingMethod)
  const setCameraFov = useAppStore(state => state.setCameraFov)
  const setNumSamples = useAppStore(state => state.setNumSamples)
  const setNumBounces = useAppStore(state => state.setNumBounces)
  const setShadingMethod = useAppStore(state => state.setShadingMethod)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)]">
      <RangeRow title="FOV" value={cameraFov} min={minCameraFov} max={maxCameraFov} onChange={setCameraFov} />
      <RangeRow title="Samples" value={numSamples} min={minSamples} max={maxSamples} onChange={setNumSamples} />
      <RangeRow title="Bounces" value={numBounces} min={minBounces} max={maxBounces} onChange={setNumBounces} />

      {/* The shading choice is a radio group drawn as one segmented button. The radios are invisible and fill each
          half, so a press anywhere on the half selects it, and keyboard focus still works. */}
      <fieldset className="mt-1 flex items-center">
        <legend className="sr-only">Shading method</legend>
        <div className="flex w-full overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
          {shadingMethods.map(method => (
            <label key={method.value} className="relative flex-1">
              <input
                className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                type="radio"
                name="shadingMethod"
                value={method.value}
                checked={shadingMethod === method.value}
                onChange={() => setShadingMethod(method.value)}
              />
              <span className="block min-h-11 content-center px-4 short:min-h-9 text-center text-xs font-semibold text-gray-600 peer-checked:bg-(--accent) peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-(--accent) dark:text-gray-400 dark:peer-checked:text-gray-900">
                {method.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
