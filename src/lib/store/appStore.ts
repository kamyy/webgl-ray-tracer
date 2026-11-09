/**
 * Zustand store for the UI settings and the rendering progress counters.
 *
 * React components read it with selectors (`useAppStore(s => s.cameraFov)`), and the render loop reads it outside
 * React with `useAppStore.getState()`. Camera transforms, textures and WebGL handles are not kept here, because they
 * change every rendering tick and must not re-render React.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  defaultFocusRange,
  defaultLensRadiusRange,
  defaultScene,
  focusRangeFor,
  lensRadiusRangeFor,
  snapToRange,
  type SceneInfo,
  type SliderRange,
} from '../scenes'

export enum ShadingMethod {
  flat,
  phong,
}

interface AppState {
  // Which scene is loaded. `PathTracer` restarts accumulation when the new scene is packed, so it needs no restart of its own.
  readonly scene: SceneInfo

  // Render settings. A change to any of them restarts accumulation.
  readonly shadingMethod: ShadingMethod
  readonly numSamples: number // samples to accumulate before the render stops
  readonly numBounces: number // most times a ray may bounce
  readonly cameraFov: number // vertical field of view in degrees
  readonly lensRadius: number // lens radius in world units, 0 for a pinhole with everything sharp
  readonly focusDistance: number // distance in world units from the camera to the plane that stays sharp
  readonly focusRange: SliderRange // the focus slider's limits and step, set from the size of the loaded scene
  readonly lensRadiusRange: SliderRange // the lens radius slider's limits and step, set the same way

  // Render progress, written by `PathTracer` a few times a second. The times are text, ready to show.
  readonly samplesDone: number // samples completed since the last restart
  readonly elapsedTime: string
  readonly etaTime: string
  readonly avgTime: string
  readonly resolution: string // the canvas size in pixels, which is also the size of a saved screenshot
}

// The ways to change the state. Each setter replaces one value.
interface AppActions {
  setScene(scene: SceneInfo): void
  setShadingMethod(shadingMethod: ShadingMethod): void
  setNumSamples(numSamples: number): void
  setNumBounces(numBounces: number): void
  setCameraFov(cameraFov: number): void
  setLensRadius(lensRadius: number): void
  setFocusDistance(focusDistance: number): void
  setSceneScale(radius: number, focusDistance: number): void
  setStatus(status: Pick<AppState, 'samplesDone' | 'elapsedTime' | 'etaTime' | 'avgTime'>): void
  setResolution(width: number, height: number): void
  resetStatus(): void
}

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(set => ({
    scene: defaultScene,
    shadingMethod: ShadingMethod.flat,
    samplesDone: 0,
    numSamples: 100,
    numBounces: 6,
    cameraFov: 45,
    lensRadius: 0,
    focusDistance: defaultFocusRange.max,
    focusRange: defaultFocusRange,
    lensRadiusRange: defaultLensRadiusRange,
    // A dash stands for a time that is not known yet.
    elapsedTime: '--',
    etaTime: '--',
    avgTime: '--',
    resolution: '--',

    setScene: scene => set({ scene }),
    setShadingMethod: shadingMethod => set({ shadingMethod }),
    setNumSamples: numSamples => set({ numSamples }),
    setNumBounces: numBounces => set({ numBounces }),
    setCameraFov: cameraFov => set({ cameraFov }),
    setLensRadius: lensRadius => set({ lensRadius }),
    setFocusDistance: focusDistance => set({ focusDistance }),
    // Sizes the sliders to a scene whose bounding sphere has this radius, and focuses at the given distance. The ranges
    // and the values change together, so a slider never holds a value outside its range.
    setSceneScale: (radius, focusDistance) =>
      set(state => {
        const focusRange = focusRangeFor(radius)
        const lensRadiusRange = lensRadiusRangeFor(radius)
        return {
          focusRange,
          lensRadiusRange,
          focusDistance: snapToRange(focusDistance, focusRange),
          lensRadius: snapToRange(state.lensRadius, lensRadiusRange),
        }
      }),
    setStatus: status => set(status),
    setResolution: (width, height) => set({ resolution: `${width} × ${height}` }),
    resetStatus: () => set({ samplesDone: 0, elapsedTime: '--', etaTime: '--', avgTime: '--' }),
  })),
)
