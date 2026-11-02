/**
 * Lets the heads-up display save the rendered image without access to the WebGL canvas.
 *
 * The heads-up display sits outside the React Three Fiber canvas, so it cannot reach the renderer. `PathTracer`
 * registers a function here that draws the image and downloads it, and the heads-up display calls `saveScreenshot`.
 * The registration lives in this module rather than the app store, because the store holds no WebGL handles.
 */

let capture: (() => void) | null = null

/** Sets the function that `saveScreenshot` calls. The returned function removes it. */
export function registerScreenshot(fn: () => void): () => void {
  capture = fn
  return () => {
    if (capture === fn) {
      capture = null
    }
  }
}

/** Downloads the current render as a PNG, or does nothing when no renderer is registered. */
export function saveScreenshot() {
  capture?.()
}
