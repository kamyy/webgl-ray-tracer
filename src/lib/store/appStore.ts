/**
 * Zustand store for the UI settings and the rendering progress counters.
 *
 * React components read it with selectors (`useAppStore(s => s.cameraFov)`), and the render loop reads it outside
 * React with `useAppStore.getState()`. Camera transforms, textures and WebGL handles are not kept here, because they
 * change every frame and must not re-render React.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export enum ShadingMethod {
  flat,
  phong,
}

interface AppState {
  // Render settings. A change to any of them restarts accumulation.
  readonly shadingMethod: ShadingMethod
  readonly numSamples: number // passes to accumulate before the render stops
  readonly numBounces: number // most times a ray may bounce
  readonly cameraFov: number // vertical field of view in degrees

  // Render progress, written by `PathTracer` a few times a second. The times are text, ready to show.
  readonly renderingPass: number // passes completed since the last restart
  readonly elapsedTime: string
  readonly etaTime: string
  readonly avgTime: string
}

// The ways to change the state. Each setter replaces one value.
interface AppActions {
  setShadingMethod(shadingMethod: ShadingMethod): void
  setNumSamples(numSamples: number): void
  setNumBounces(numBounces: number): void
  setCameraFov(cameraFov: number): void
  setStatus(status: Pick<AppState, 'renderingPass' | 'elapsedTime' | 'etaTime' | 'avgTime'>): void
  resetStatus(): void
}

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(set => ({
    shadingMethod: ShadingMethod.flat,
    renderingPass: 0,
    numSamples: 10,
    numBounces: 6,
    cameraFov: 45,
    // A dash stands for a time that is not known yet.
    elapsedTime: '--',
    etaTime: '--',
    avgTime: '--',

    setShadingMethod: shadingMethod => set({ shadingMethod }),
    setNumSamples: numSamples => set({ numSamples }),
    setNumBounces: numBounces => set({ numBounces }),
    setCameraFov: cameraFov => set({ cameraFov }),
    setStatus: status => set(status),
    resetStatus: () => set({ renderingPass: 0, elapsedTime: '--', etaTime: '--', avgTime: '--' }),
  })),
)
