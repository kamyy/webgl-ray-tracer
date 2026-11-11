/**
 * The scene cards, sliders, number fields and radio buttons that change what is rendered and how.
 *
 * Each slider is paired with a number field, so a value can be dragged to or typed exactly. Each control writes its
 * value to the app store, and `PathTracer` watches those values. The settings come in two titled groups. An image
 * setting keeps the samples traced so far. A tracing setting changes what is traced, so a change restarts
 * accumulation. The scene cards write the chosen scene to the store, which remounts the traced scene.
 */
import { useGLTF } from '@react-three/drei'
import { useId, useRef, useState } from 'react'
import { isFileScene, sceneFromFile, scenes, type SceneInfo } from '../lib/scenes'
import { ShadingMethod, useAppStore } from '../lib/store/appStore'
import { Icon } from './icon'

// The limits of each setting. They bound both the sliders and the number fields.
const minSamples = 1
const maxSamples = 10000
const minBounces = 1
const maxBounces = 16
const minCameraFov = 10
const maxCameraFov = 120
const minExposure = 0.1
const maxExposure = 3
const minContrast = 1
const maxContrast = 2
const imageSettingStep = 0.05 // the exposure and contrast step

// The tooltip of each setting.
const hints = {
  fov: 'Vertical field of view, in degrees.',
  lensRadius: 'In world space units. A larger lens blurs more outside the focus distance.',
  focus: 'In world space units. Objects at this distance from the camera stay sharp.',
  samples: 'Number of samples per pixel to complete the render.',
  bounces: 'Max number of times a ray may bounce off surfaces.',
  exposure: 'Brightens or darkens the whole image.',
  contrast: 'Deepens shadows and strengthens colors.',
  shading: 'Flat shows each triangle. Phong smooths across them.',
}

// The choices in the shading control, in the order they are shown.
const shadingMethods = [
  { value: ShadingMethod.flat, label: 'Flat' },
  { value: ShadingMethod.phong, label: 'Phong' },
]

// The classes the three scene cards share. `peer` on the radio lets the picture and the name react to it being checked.
const cardPicture =
  'block aspect-[4/3] rounded-lg bg-cover bg-center ring-2 ring-transparent outline-1 -outline-offset-1 outline-gray-300 dark:outline-gray-600'
const cardName = 'block truncate text-center text-xs font-semibold'

interface RangeRowProps {
  title: string
  hint: string // the tooltip that explains the setting
  value: number
  min: number
  max: number
  step?: number // the smallest change the slider and the number field make, 1 when left out
  onChange: (value: number) => void
}

interface SettingsGroupProps {
  title: string
  children: React.ReactNode
}

// One setting: a label, a slider for dragging, and a number field for typing an exact value.
function RangeRow({ title, hint, value, min, max, step = 1, onChange }: RangeRowProps) {
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
    <div className="flex min-h-11 items-center gap-2.5 short:min-h-9">
      <label htmlFor={id} title={hint} className="w-24 flex-none text-xs font-semibold">
        {title}
      </label>
      <input
        id={id}
        title={hint}
        className="h-8 min-w-0 flex-1 pointer-coarse:h-11 short:h-8 pointer-coarse:short:h-8"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(parseFloat(event.target.value))}
      />
      <input
        className="min-h-9 w-16 flex-none rounded-lg border border-gray-300 bg-gray-100 px-2 text-right text-xs tabular-nums dark:border-gray-600 dark:bg-gray-800 short:min-h-8"
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft ?? value}
        title={hint}
        aria-label={`${title} value`}
        onChange={event => onTyped(event.target.value)}
        onBlur={onTypingDone}
      />
    </div>
  )
}

// A titled box around a group of settings. The box is a fieldset, so the title sits on its border and screen readers
// announce it with each setting in the group. `min-w-0` lets the box shrink inside a grid column, which a fieldset
// otherwise refuses to do below its content's width.
function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <fieldset className="mt-1 min-w-0 rounded-xl border border-gray-300 px-2 pb-1.5 dark:border-gray-600 short:mt-0">
      <legend className="px-1 text-xs font-bold tracking-wide uppercase">{title}</legend>
      {children}
    </fieldset>
  )
}

// Switches the app to another scene. Writing it to the store remounts the traced scene. A scene from the user's drive
// holds an object URL and a cached copy of the loaded file, so both are freed once another scene replaces it.
function chooseScene(scene: SceneInfo) {
  const { scene: current, setScene } = useAppStore.getState()
  if (scene.id === current.id) {
    // Picking the file that is already loaded made a second object URL, which nothing will use.
    if (scene.url !== current.url && isFileScene(scene)) {
      URL.revokeObjectURL(scene.url)
    }
    return
  }

  setScene(scene)
  if (isFileScene(current)) {
    URL.revokeObjectURL(current.url)
    useGLTF.clear(current.url)
  }
}

// The scenes to render, drawn as a row of pictures. The last card opens the browser's file picker, so a `.glb` from the
// user's own drive loads like a bundled scene. While such a file is loaded, that card shows its name and is the
// selected one.
function SceneCards() {
  const current = useAppStore(state => state.scene)
  const fileInput = useRef<HTMLInputElement>(null)
  const fileLoaded = isFileScene(current)

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      chooseScene(sceneFromFile(file))
    }

    // Clearing the input lets the same file be picked again after another scene was chosen.
    event.target.value = ''
  }

  let openCardPicture =
    'grid place-items-center border-2 border-dashed border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400'
  let openCardName = 'Open .glb'
  if (fileLoaded) {
    openCardPicture = 'grid place-items-center bg-(--accent) text-white dark:text-gray-900'
    openCardName = current.label
  }

  return (
    <fieldset className="mt-1 mb-2 grid grid-cols-3 gap-2">
      <legend className="sr-only">Scene</legend>
      {scenes.map(scene => (
        <label key={scene.id} className="relative flex cursor-pointer flex-col gap-1">
          <input
            className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type="radio"
            name="scene"
            checked={scene.id === current.id}
            onChange={() => chooseScene(scene)}
          />
          <span
            className={`${cardPicture} peer-checked:ring-(--accent) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--accent)`}
            style={{ backgroundImage: `url(${scene.thumbnail})` }}
          />
          <span className={`${cardName} peer-checked:text-(--accent)`}>{scene.label}</span>
        </label>
      ))}

      <div className="relative flex flex-col gap-1">
        <button
          type="button"
          aria-label={fileLoaded ? `Open another .glb file. Loaded: ${current.label}` : 'Open a .glb file'}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onClick={() => fileInput.current?.click()}
        />
        <span
          className={`${cardPicture} ${openCardPicture} peer-hover:border-(--accent) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--accent)`}
        >
          <Icon className="h-6 w-6">
            <path d="M12 5v14M5 12h14" />
          </Icon>
        </span>
        <span className={cardName}>{openCardName}</span>
        <input ref={fileInput} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={onFilePicked} />
      </div>
    </fieldset>
  )
}

// The flat or Phong choice, drawn as one segmented button. The radios are invisible and fill each half, so a press
// anywhere on the half selects it, and keyboard focus still works.
function ShadingControl() {
  const shadingMethod = useAppStore(state => state.shadingMethod)
  const setShadingMethod = useAppStore(state => state.setShadingMethod)

  return (
    <fieldset className="mt-1 flex items-center" title={hints.shading}>
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
            <span className="block min-h-11 content-center px-4 text-center text-xs font-semibold text-gray-600 peer-checked:bg-(--accent) peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-(--accent) dark:text-gray-400 dark:peer-checked:text-gray-900 short:min-h-9">
              {method.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// The settings that change what is traced. A change restarts accumulation.
function TracingSettings() {
  const cameraFov = useAppStore(state => state.cameraFov)
  const lensRadius = useAppStore(state => state.lensRadius)
  const lensRadiusRange = useAppStore(state => state.lensRadiusRange)
  const focusDistance = useAppStore(state => state.focusDistance)
  const focusRange = useAppStore(state => state.focusRange)
  const numBounces = useAppStore(state => state.numBounces)
  const setCameraFov = useAppStore(state => state.setCameraFov)
  const setLensRadius = useAppStore(state => state.setLensRadius)
  const setFocusDistance = useAppStore(state => state.setFocusDistance)
  const setNumBounces = useAppStore(state => state.setNumBounces)

  return (
    <SettingsGroup title="Tracing">
      <RangeRow
        title="Field of view"
        hint={hints.fov}
        value={cameraFov}
        min={minCameraFov}
        max={maxCameraFov}
        onChange={setCameraFov}
      />
      <RangeRow
        title="Lens radius"
        hint={hints.lensRadius}
        value={lensRadius}
        min={lensRadiusRange.min}
        max={lensRadiusRange.max}
        step={lensRadiusRange.step}
        onChange={setLensRadius}
      />
      <RangeRow
        title="Focus distance"
        hint={hints.focus}
        value={focusDistance}
        min={focusRange.min}
        max={focusRange.max}
        step={focusRange.step}
        onChange={setFocusDistance}
      />
      <RangeRow
        title="Ray bounces"
        hint={hints.bounces}
        value={numBounces}
        min={minBounces}
        max={maxBounces}
        onChange={setNumBounces}
      />
      <ShadingControl />
    </SettingsGroup>
  )
}

// The settings that keep the samples traced so far. The sample count moves where the render stops, and the exposure
// and contrast redraw the finished average.
function ImageSettings() {
  const numSamples = useAppStore(state => state.numSamples)
  const exposure = useAppStore(state => state.exposure)
  const contrast = useAppStore(state => state.contrast)
  const setNumSamples = useAppStore(state => state.setNumSamples)
  const setExposure = useAppStore(state => state.setExposure)
  const setContrast = useAppStore(state => state.setContrast)

  return (
    <SettingsGroup title="Image">
      <RangeRow
        title="Samples"
        hint={hints.samples}
        value={numSamples}
        min={minSamples}
        max={maxSamples}
        onChange={setNumSamples}
      />
      <RangeRow
        title="Exposure"
        hint={hints.exposure}
        value={exposure}
        min={minExposure}
        max={maxExposure}
        step={imageSettingStep}
        onChange={setExposure}
      />
      <RangeRow
        title="Contrast"
        hint={hints.contrast}
        value={contrast}
        min={minContrast}
        max={maxContrast}
        step={imageSettingStep}
        onChange={setContrast}
      />
    </SettingsGroup>
  )
}

// One column on a desktop and on a phone in portrait. On a phone in landscape the window is too short for one column,
// so the scene cards, the image settings and the tracing settings sit side by side.
export function RenderSettings() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] short:landscape:grid-cols-[minmax(0,22%)_minmax(0,1fr)_minmax(0,1fr)] short:landscape:items-start short:landscape:gap-x-4">
      <SceneCards />
      <ImageSettings />
      <TracingSettings />
    </div>
  )
}
