/**
 * The scene cards, sliders, number fields and radio buttons that change what is rendered and how.
 *
 * Each slider is paired with a number field, so a value can be dragged to or typed exactly. Each control writes its
 * value to the app store. `PathTracer` watches those values and restarts accumulation when one changes. The scene
 * cards write the chosen scene to the store, which remounts the traced scene.
 */
import { useGLTF } from '@react-three/drei'
import { useId, useRef, useState } from 'react'
import { isFileScene, sceneFromFile, scenes, type SceneInfo } from '../lib/scenes'
import { ShadingMethod, useAppStore } from '../lib/store/appStore'

// The limits of each setting. They bound both the sliders and the number fields. `RAY_BOUNCE_MAX_STACK_SIZE` in
// `src/shaders/pathTrace.frag.glsl` must stay above `maxBounces`.
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

// The classes the three scene cards share. `peer` on the radio lets the picture and the name react to it being checked.
const cardPicture =
  'block aspect-[4/3] rounded-lg bg-cover bg-center ring-2 ring-transparent outline-1 -outline-offset-1 outline-gray-300 dark:outline-gray-600'
const cardName = 'block truncate text-center text-xs font-semibold'

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

  // The text being typed, or null while the field shows the setting. Keeping the text lets the field hold a half-typed
  // number such as the 4 on the way to 45, which is below `min` for a setting like the field of view.
  const [draft, setDraft] = useState<string | null>(null)

  // A number in range applies at once. Anything else waits in the field until the typing is finished.
  function onTyped(text: string) {
    setDraft(text)
    const typed = parseInt(text)
    if (typed >= min && typed <= max) {
      onChange(typed)
    }
  }

  // Leaving the field ends the typing, so a number out of range is clamped and a blank field returns to the setting.
  function onTypingDone() {
    const typed = parseInt(draft ?? '')
    if (!Number.isNaN(typed)) {
      onChange(Math.min(Math.max(typed, min), max))
    }
    setDraft(null)
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
        value={draft ?? value}
        aria-label={`${title} value`}
        onChange={event => onTyped(event.target.value)}
        onBlur={onTypingDone}
      />
    </div>
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
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className={cardName}>{openCardName}</span>
        <input ref={fileInput} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={onFilePicked} />
      </div>
    </fieldset>
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
      <SceneCards />
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
