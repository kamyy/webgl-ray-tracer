/**
 * The scenes the app can render, where the camera starts in each, and the exposure and contrast each starts with.
 *
 * The two bundled scenes are glTF binaries in a private S3 bucket that CloudFront serves at `/scenes/`. Each has a
 * starting `view` that places the camera in the scene's own units, where y is up. A scene the user opens from their own
 * drive has no `view`, so `TracedScene` in `src/components/viewport.tsx` frames it once it has loaded and its size is
 * known. The bundled scenes' materials were tuned together with their exposure and contrast. A scene from the user's
 * drive gets an exposure and contrast of 1, which shows its materials as they were authored.
 */

export const scenes: SceneInfo[] = [
  {
    id: 'suzanne',
    label: 'Suzanne',
    url: '/scenes/suzanne-B.glb',
    thumbnail: '/thumbnails/suzanne.jpg',
    view: { eye: [0, 2, 10], target: [0, 2, 0] },
    exposure: 0.9,
    contrast: 1.4,
  },
  {
    id: 'tricycle',
    label: 'Tricycle',
    url: '/scenes/tricycle-B.glb',
    thumbnail: '/thumbnails/tricycle.jpg',
    view: { eye: [0, 2, 10], target: [0, 1.5, 0] },
    exposure: 0.9,
    contrast: 1.4,
  },
]

export const defaultScene = scenes[0]

// The focus distance and lens radius slider ranges, in world units, before a scene has loaded.
export const defaultFocusRange: SliderRange = { min: 0.1, max: 10, step: 0.1 }
export const defaultLensRadiusRange: SliderRange = { min: 0, max: 1, step: 0.01 }

// The lowest and highest value of a slider and the size of one step, all in world units.
export interface SliderRange {
  min: number
  max: number
  step: number
}

export interface SceneInfo {
  id: string
  label: string
  url: string
  thumbnail?: string // a small picture of the scene, for the scene cards
  view?: { eye: [number, number, number]; target: [number, number, number] }
  exposure?: number // the exposure the scene loads and resets with, 1 when left out
  contrast?: number // the contrast the scene loads and resets with, 1 when left out
}

// Makes a scene from a file the user picked. The browser serves the file from memory at an object URL, which stays valid
// until `chooseScene` in `src/components/renderSettings.tsx` frees it.
export function sceneFromFile(file: File): SceneInfo {
  return {
    id: `file:${file.name}:${file.size}:${file.lastModified}`,
    label: file.name,
    url: URL.createObjectURL(file),
  }
}

// The exposure and contrast a scene loads with, and that the reset button returns to.
export function imageSettingsFor(scene: SceneInfo): { exposure: number; contrast: number } {
  return { exposure: scene.exposure ?? 1, contrast: scene.contrast ?? 1 }
}

// Whether the scene came from the user's drive, and so holds an object URL that needs freeing.
export function isFileScene(scene: SceneInfo): boolean {
  return scene.url.startsWith('blob:')
}

// Rounds a number up to 1, 2 or 5 times a power of ten, so a slider step reads cleanly.
function niceStep(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value))
  const fraction = value / power
  if (fraction <= 1) {
    return power
  }
  if (fraction <= 2) {
    return 2 * power
  }
  return fraction <= 5 ? 5 * power : 10 * power
}

// A range of 100 steps whose largest value is at least `max`, because scene units have no fixed scale.
function rangeUpTo(max: number, min: 'step' | 0): SliderRange {
  const step = Number(niceStep(max / 100).toPrecision(6))
  return { min: min === 'step' ? step : 0, max: Number((step * 100).toPrecision(6)), step }
}

// The focus range for a scene whose bounding sphere, with the starting camera inside it, has this radius. The sphere's
// diameter reaches from the camera to the farthest point of the scene.
export function focusRangeFor(radius: number): SliderRange {
  return rangeUpTo(2 * radius, 'step')
}

// The lens radius range for the same sphere. A lens a twentieth of the sphere's diameter blurs strongly.
export function lensRadiusRangeFor(radius: number): SliderRange {
  return rangeUpTo(radius / 10, 0)
}

// Rounds a value to the nearest step of the range, within its limits.
export function snapToRange(value: number, range: SliderRange): number {
  const snapped = Math.round(value / range.step) * range.step
  return Math.min(Math.max(Number(snapped.toPrecision(6)), range.min), range.max)
}
