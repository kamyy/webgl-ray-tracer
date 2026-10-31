/**
 * Zustand store for the UI settings and the rendering progress counters.
 *
 * React components read it with selectors (`useAppStore(s => s.cameraFov)`), and the render loop reads it outside
 * React with `useAppStore.getState()`. Camera transforms, textures and WebGL handles are not kept here, because they
 * change every frame and must not re-render React.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export enum LoadingSpinner {
  show,
  hide,
  fail,
}
export enum ShadingMethod {
  flat,
  phong,
}

interface AppState {
  readonly loadingSpinner: LoadingSpinner
  readonly shadingMethod: ShadingMethod
  readonly renderingPass: number
  readonly numSamples: number
  readonly numBounces: number
  readonly cameraFov: number
  readonly elapsedTime: string
  readonly etaTime: string
  readonly avgTime: string
}

interface AppActions {
  setLoadingSpinner(loadingSpinner: LoadingSpinner): void
  setShadingMethod(shadingMethod: ShadingMethod): void
  setNumSamples(numSamples: number): void
  setNumBounces(numBounces: number): void
  setCameraFov(cameraFov: number): void
  setStatus(status: Pick<AppState, 'renderingPass' | 'elapsedTime' | 'etaTime' | 'avgTime'>): void
  resetStatus(): void
}

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(set => ({
    loadingSpinner: LoadingSpinner.hide,
    shadingMethod: ShadingMethod.flat,
    renderingPass: 0,
    numSamples: 10,
    numBounces: 6,
    cameraFov: 45,
    elapsedTime: '',
    etaTime: '',
    avgTime: '',

    setLoadingSpinner: loadingSpinner => set({ loadingSpinner }),
    setShadingMethod: shadingMethod => set({ shadingMethod }),
    setNumSamples: numSamples => set({ numSamples }),
    setNumBounces: numBounces => set({ numBounces }),
    setCameraFov: cameraFov => set({ cameraFov }),
    setStatus: status => set(status),
    resetStatus: () => set({ renderingPass: 0, elapsedTime: '00:00:00', etaTime: '??:??:??', avgTime: '????' }),
  })),
)
