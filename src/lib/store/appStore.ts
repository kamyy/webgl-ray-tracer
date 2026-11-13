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
  imageSettingsFor,
  lensRadiusRangeFor,
  snapToRange,
  type SceneInfo,
  type SliderRange,
} from '../scenes'

export enum ShadingMethod {
  flat,
  phong,
}

// The settings the app starts with, which the reset button restores. The focus distance, exposure and contrast are
// missing because they depend on the scene.
const defaultSettings = {
  shadingMethod: ShadingMethod.flat,
  numBounces: 6,
  cameraFov: 45,
  lensRadius: 0,
  numSamples: 500,
  showMeshWireframe: false,
  showBvhWireframe: false,
  showSelectedBoxesOnly: false,
}

// The deepest BVH level shown when a scene loads or the settings are reset. The levels below it are usually too dense
// to read.
const startBvhMaxDepth = 6

// The BVH depth range before a scene has loaded.
const defaultBvhDepthRange: SliderRange = { min: 0, max: startBvhMaxDepth, step: 1 }

// The floating cards that open one at a time. The progress pill folds on its own and is not one of them.
type OpenPanel = 'settings' | 'about' | 'wireframe' | null

interface AppState {
  // Which scene is loaded. `PathTracer` restarts accumulation when the new scene is packed, so it needs no restart of its own.
  readonly scene: SceneInfo

  // Tracing settings. A change to any of them restarts accumulation.
  readonly shadingMethod: ShadingMethod
  readonly numBounces: number // most times a ray may bounce
  readonly cameraFov: number // vertical field of view in degrees
  readonly lensRadius: number // lens radius in world units, 0 for a pinhole with everything sharp
  readonly focusDistance: number // distance in world units from the camera to the plane that stays sharp
  readonly startFocusDistance: number // the loaded scene's starting focus distance, which a reset returns to
  readonly focusRange: SliderRange // the focus slider's limits and step, set from the size of the loaded scene
  readonly lensRadiusRange: SliderRange // the lens radius slider's limits and step, set the same way

  // Image settings. A change keeps the accumulated samples. The sample count moves where the render stops, and the
  // exposure and contrast only change how the display pass draws the average.
  readonly numSamples: number // samples to accumulate before the render stops
  readonly exposure: number // multiplies the linear average before tone mapping
  readonly contrast: number // the power the linear average is raised to before tone mapping

  // Wireframe view. The mesh wireframe pauses tracing and replaces the traced image. The BVH boxes draw over either.
  readonly showMeshWireframe: boolean // draw every triangle edge
  readonly showBvhWireframe: boolean // draw the BVH boxes from `bvhMinDepth` to `bvhMaxDepth`
  readonly showSelectedBoxesOnly: boolean // draw only the tapped triangle and the boxes around it, at every depth
  readonly bvhMinDepth: number // the shallowest BVH level drawn, where 0 is each mesh's root box
  readonly bvhMaxDepth: number // the deepest BVH level drawn
  readonly bvhDepthRange: SliderRange // both depth sliders' limits, from 0 to the loaded scene's deepest level

  // Render progress, written by `PathTracer` a few times a second. The times are text, ready to show.
  readonly samplesDone: number // samples completed since the last restart
  readonly elapsedTime: string
  readonly etaTime: string
  readonly avgTime: string
  readonly resolution: string // the canvas size in pixels, which is also the size of a saved screenshot

  // The one floating card that is open, or null when all are closed. Keeping it in one value means opening a card
  // closes the others, so they never cover each other. The settings card starts open.
  readonly openPanel: OpenPanel
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
  setExposure(exposure: number): void
  setContrast(contrast: number): void
  setSceneScale(radius: number, focusDistance: number): void
  setShowMeshWireframe(show: boolean): void
  setShowBvhWireframe(show: boolean): void
  setShowSelectedBoxesOnly(show: boolean): void
  setBvhMinDepth(depth: number): void
  setBvhMaxDepth(depth: number): void
  setBvhDepthLimit(deepest: number): void
  resetSettings(): void
  setStatus(status: Pick<AppState, 'samplesDone' | 'elapsedTime' | 'etaTime' | 'avgTime'>): void
  setResolution(width: number, height: number): void
  resetStatus(): void
  setOpenPanel(openPanel: OpenPanel): void
}

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(set => ({
    scene: defaultScene,
    ...defaultSettings,
    ...imageSettingsFor(defaultScene),
    samplesDone: 0,
    focusDistance: defaultFocusRange.max,
    startFocusDistance: defaultFocusRange.max,
    focusRange: defaultFocusRange,
    lensRadiusRange: defaultLensRadiusRange,
    bvhMinDepth: 0,
    bvhMaxDepth: startBvhMaxDepth,
    bvhDepthRange: defaultBvhDepthRange,
    // A dash stands for a time that is not known yet.
    elapsedTime: '--',
    etaTime: '--',
    avgTime: '--',
    resolution: '--',
    openPanel: 'settings',

    // A new scene brings its own exposure and contrast, because they suit its materials.
    setScene: scene => set({ scene, ...imageSettingsFor(scene) }),
    setShadingMethod: shadingMethod => set({ shadingMethod }),
    setNumSamples: numSamples => set({ numSamples }),
    setNumBounces: numBounces => set({ numBounces }),
    setCameraFov: cameraFov => set({ cameraFov }),
    setLensRadius: lensRadius => set({ lensRadius }),
    setFocusDistance: focusDistance => set({ focusDistance }),
    setExposure: exposure => set({ exposure }),
    setContrast: contrast => set({ contrast }),
    // Sizes the sliders to a scene whose bounding sphere has this radius, and focuses at the given distance. The ranges
    // and the values change together, so a slider never holds a value outside its range.
    setSceneScale: (radius, focusDistance) =>
      set(state => {
        const focusRange = focusRangeFor(radius)
        const lensRadiusRange = lensRadiusRangeFor(radius)
        const startFocusDistance = snapToRange(focusDistance, focusRange)
        return {
          focusRange,
          lensRadiusRange,
          focusDistance: startFocusDistance,
          startFocusDistance,
          lensRadius: snapToRange(state.lensRadius, lensRadiusRange),
        }
      }),
    setShowMeshWireframe: showMeshWireframe => set({ showMeshWireframe }),
    setShowBvhWireframe: showBvhWireframe => set({ showBvhWireframe }),
    setShowSelectedBoxesOnly: showSelectedBoxesOnly => set({ showSelectedBoxesOnly }),
    // The two depths move together where they would cross, so the band of levels shown is never empty.
    setBvhMinDepth: bvhMinDepth =>
      set(state => ({ bvhMinDepth, bvhMaxDepth: Math.max(state.bvhMaxDepth, bvhMinDepth) })),
    setBvhMaxDepth: bvhMaxDepth =>
      set(state => ({ bvhMaxDepth, bvhMinDepth: Math.min(state.bvhMinDepth, bvhMaxDepth) })),
    // Sizes both depth sliders to a scene whose deepest BVH level is `deepest`, and shows its first few levels.
    setBvhDepthLimit: deepest =>
      set({
        bvhDepthRange: { min: 0, max: deepest, step: 1 },
        bvhMinDepth: 0,
        bvhMaxDepth: Math.min(startBvhMaxDepth, deepest),
      }),
    // Returns every setting to the value the app starts with, and the focus, exposure, contrast and BVH depths to the
    // loaded scene's own. The scene and the camera stay as they are. The settings watchers in `src/lib/webgl/tracer.ts`
    // restart or redraw as each changed setting needs.
    resetSettings: () =>
      set(state => ({
        ...defaultSettings,
        ...imageSettingsFor(state.scene),
        focusDistance: state.startFocusDistance,
        bvhMinDepth: 0,
        bvhMaxDepth: Math.min(startBvhMaxDepth, state.bvhDepthRange.max),
      })),
    setStatus: status => set(status),
    setResolution: (width, height) => set({ resolution: `${width} × ${height}` }),
    resetStatus: () => set({ samplesDone: 0, elapsedTime: '--', etaTime: '--', avgTime: '--' }),
    setOpenPanel: openPanel => set({ openPanel }),
  })),
)
