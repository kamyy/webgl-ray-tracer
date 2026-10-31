/**
 * The sliders and radio buttons that change how the scene is rendered.
 *
 * Each control writes its value to the app store. `PathTracer` watches those values and restarts accumulation when
 * one changes, so a change shows up in the render at once.
 */
import { useId } from 'react'
import { ShadingMethod, useAppStore } from '../lib/store/appStore'

const minSamples = 1
const maxSamples = 10000
const minBounces = 1
const maxBounces = 16
const minCameraFov = 10
const maxCameraFov = 120

const shadingMethods = [
  { value: ShadingMethod.flat, label: 'Flat' },
  { value: ShadingMethod.phong, label: 'Phong' },
]

interface RangeFieldProps {
  title: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

function RangeField({ title, value, min, max, onChange }: RangeFieldProps) {
  const id = useId()

  return (
    <div className="mt-3">
      <div className="flex justify-between text-[0.9rem] font-bold">
        <label htmlFor={id}>{title}</label>
        <output htmlFor={id} className="tabular-nums">
          {value}
        </output>
      </div>
      <input
        id={id}
        className="my-0.5 h-8 w-full pointer-coarse:h-11"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={event => onChange(parseInt(event.target.value))}
      />
      <div className="flex justify-between text-xs text-gray-600 tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

export function RenderingParams() {
  const cameraFov = useAppStore(state => state.cameraFov)
  const numSamples = useAppStore(state => state.numSamples)
  const numBounces = useAppStore(state => state.numBounces)
  const shadingMethod = useAppStore(state => state.shadingMethod)
  const setCameraFov = useAppStore(state => state.setCameraFov)
  const setNumSamples = useAppStore(state => state.setNumSamples)
  const setNumBounces = useAppStore(state => state.setNumBounces)
  const setShadingMethod = useAppStore(state => state.setShadingMethod)

  return (
    <div>
      <RangeField
        title="Camera field of view"
        value={cameraFov}
        min={minCameraFov}
        max={maxCameraFov}
        onChange={setCameraFov}
      />
      <RangeField
        title="Samples per pixel"
        value={numSamples}
        min={minSamples}
        max={maxSamples}
        onChange={setNumSamples}
      />
      <RangeField title="Ray bounces" value={numBounces} min={minBounces} max={maxBounces} onChange={setNumBounces} />

      <fieldset className="mt-4">
        <legend className="text-[0.9rem] font-bold">Shading method</legend>
        <div className="mt-1.5 flex overflow-hidden rounded-lg border border-gray-300">
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
              <span className="block min-h-11 content-center text-center text-xs font-semibold text-gray-600 peer-checked:bg-[darkgreen] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-[darkgreen]">
                {method.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
