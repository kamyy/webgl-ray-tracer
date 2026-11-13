/**
 * The path-tracing engine: draws samples into the running sum and shows the finished ones.
 *
 * One sample adds one path per pixel to a running sum held in a float render target, with the sample count in the
 * alpha channel. The display shader divides the sum by that count and draws it to the canvas.
 *
 * The GPU is shared with the rest of the desktop, so one job must stay short, or every window stutters while it runs.
 * A sample is therefore drawn as bands of rows, and each band is sized to take a few milliseconds. The loop keeps at
 * most two bands waiting on the GPU, found by polling a fence, which is a marker the GPU signals when it has finished
 * everything submitted before it. That keeps the GPU busy without letting the command queue grow.
 *
 * While a sample is partly drawn, its finished rows have one more sample than the rest, which shows as a faint edge in
 * the noise. So the picture comes from a second target, a copy of the running sum made each time a sample completes.
 *
 * Everything here is plain TypeScript with no React, because the state changes every sample and must not re-render the
 * page.
 */
import { DataTexture, Matrix4, PerspectiveCamera, WebGLRenderer, WebGLRenderTarget } from 'three'
import { shallow } from 'zustand/shallow'
import { useAppStore } from '../store/appStore'
import { PackedScene } from './packScene'
import { orthographicCamera, ShaderTriangle } from './shaderTriangle'
import { Wireframe } from './wireframe'

// The tracing loop keeps this many bands submitted to the GPU. It learns that one finished by polling on a timer, so
// the second band keeps the GPU busy until the next poll. The desktop can wait for both before it draws a window.
const maxBandsInFlight = 2
const bandBudgetMs = 16 // how long one band should take on the GPU
const firstBandRows = 16 // the band size before any band has been timed
const msPerRowSmoothing = 0.3 // how much each timed band moves the estimate, from 0 (never) to 1 (replace it)
const fencePollMs = 4 // browsers stretch a shorter nested timer to this, and a longer wait delays each band's timing
export const idlePollMs = 16 // how often the loop looks for new work when it has nothing to draw
const statusIntervalMs = 500 // how often the status counters are written to the store
const revokeDelayMs = 10_000 // how long a screenshot's object URL stays valid after the download starts
const sliderSettleMs = 500 // how long the slider settings must stay unchanged before they restart accumulation

// --- Tracer state --------------------------------------------------------------------

// A band of rows that was submitted to the GPU and has not finished yet.
interface Band {
  fence: WebGLSync
  submittedAt: number // performance.now() when it was submitted
  rows: number
  timed: boolean // false for the one-bounce preview, which costs less per row than a full sample
}

// Everything the render loop remembers between ticks. It lives in a plain object rather than React state, because
// it changes every rendering tick and must not re-render the page.
export interface TracerState {
  previewDone: boolean // true once the one-bounce preview after a restart has been submitted
  samplesDone: number // number of full samples submitted to the GPU, not counting the preview
  row: number // first row of the current sample that has not been submitted yet
  msPerRow: number | null // GPU time per row, smoothed over the bands timed so far, or null before the first
  lastBandDoneAt: number // performance.now() when the GPU last finished a band
  restartTimestamp: number // when accumulation last restarted, for the elapsed and remaining times
  numBounces: number // the bounce depth the accumulated samples were traced at, which trails a dragged setting
  lensRadius: number // the lens radius the accumulated samples were traced at, which trails a dragged setting
  focusDistance: number // the focus distance the accumulated samples were traced at, which trails a dragged setting
  needsClear: boolean // true after a restart, so the next draw empties the accumulation target first
  needsDisplay: boolean // true after a sample completes or an image setting changes, so the next tick draws the display pass
  bands: Band[] // the bands still on the GPU, oldest first
  lastStatusTimestamp: number // when the counters were last written to the store
  lastCameraMatrix: Matrix4 // the camera's world matrix at the last frame, to notice that it moved
  pausedAt: number | null // Date.now() when the mesh wireframe paused tracing, or null while tracing runs
  wireframeKey: string // the wireframe settings and selection last drawn, or empty to force the next wireframe draw
  lastDrawnCamera: Matrix4 // the camera's world matrix when the canvas was last drawn, to notice that it moved
}

// The objects that one frame of drawing needs, gathered so the drawing helpers take one argument.
export interface TracerInputs {
  gl: WebGLRenderer
  camera: PerspectiveCamera
  width: number
  height: number
  packed: PackedScene
  accumulation: WebGLRenderTarget
  completed: WebGLRenderTarget
  randomTexture: DataTexture
  pathTrace: ShaderTriangle
  display: ShaderTriangle
  wireframe: Wireframe
}

// --- Setup ---------------------------------------------------------------------------

export function createTracerState(): TracerState {
  return {
    previewDone: false,
    samplesDone: 0,
    row: 0,
    msPerRow: null,
    lastBandDoneAt: 0,
    restartTimestamp: Date.now(),
    numBounces: useAppStore.getState().numBounces,
    lensRadius: useAppStore.getState().lensRadius,
    focusDistance: useAppStore.getState().focusDistance,
    needsClear: true,
    needsDisplay: false,
    bands: [],
    lastStatusTimestamp: 0,
    lastCameraMatrix: new Matrix4(),
    pausedAt: useAppStore.getState().showMeshWireframe ? Date.now() : null,
    wireframeKey: '',
    lastDrawnCamera: new Matrix4(),
  }
}

// Every pixel of the canvas is overwritten by the display pass, and the accumulation target is cleared to zero
// samples, so the renderer clears to transparent black and never clears on its own.
export function configureRenderer(gl: WebGLRenderer) {
  gl.autoClear = false
  gl.setClearColor(0x000000, 0)
}

// Restart accumulation from zero samples.
export function renderReset(state: TracerState) {
  state.previewDone = false
  state.samplesDone = 0
  state.row = 0
  state.needsClear = true
  state.numBounces = useAppStore.getState().numBounces
  state.lensRadius = useAppStore.getState().lensRadius
  state.focusDistance = useAppStore.getState().focusDistance
  state.restartTimestamp = Date.now()
  if (state.pausedAt !== null) {
    state.pausedAt = state.restartTimestamp
  }
  state.wireframeKey = '' // a resize or a lost context empties the canvas, so any wireframe is drawn again
  useAppStore.getState().resetStatus()
}

// --- Status counters -----------------------------------------------------------------

// Formats a length of time with abbreviated units that grow with the value: `45s`, `3m 05s` or `1h 02m 05s`. A zero
// or negative time is shown as `0s`.
function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }
  return `${seconds}s`
}

// Writes the sample and timing counters to the store at a few updates a second, so React does not re-render every
// rendering tick. Nothing is written until the first full sample, so a dragged camera, which only draws the preview,
// leaves the readout on its dashes.
function updateStatus(state: TracerState, numSamples: number, force: boolean) {
  if (state.samplesDone === 0) {
    return
  }

  const now = Date.now()
  if (!force && now - state.lastStatusTimestamp < statusIntervalMs) {
    return
  }
  state.lastStatusTimestamp = now

  // A paused render's clock stops when the pause starts, so the paused time stays out of every counter.
  const elapsed = (state.pausedAt ?? now) - state.restartTimestamp
  const average = elapsed / Math.max(state.samplesDone, 1)
  const eta = (numSamples - state.samplesDone) * average
  useAppStore.getState().setStatus({
    samplesDone: state.samplesDone,
    elapsedTime: formatDuration(elapsed),
    etaTime: formatDuration(eta),
    avgTime: `${average.toFixed(0)}ms`,
  })
}

// --- Drawing -------------------------------------------------------------------------

// Draws the average of the last completed sum to the canvas, with the current exposure and contrast. Reading them here
// keeps the picture, a redraw and a screenshot in step with the sliders.
function drawDisplay(gl: WebGLRenderer, display: ShaderTriangle, completed: WebGLRenderTarget) {
  const { exposure, contrast } = useAppStore.getState()
  display.material.uniforms.u_color_sampler.value = completed.texture
  display.material.uniforms.u_exposure.value = exposure
  display.material.uniforms.u_contrast.value = contrast
  gl.setRenderTarget(null)
  gl.render(display.scene, orthographicCamera)
}

// Saves the canvas as a PNG file. The canvas is not created with `preserveDrawingBuffer`, so its contents are gone
// once the browser has shown them. The display pass is drawn again, and `toBlob` copies the canvas before this task
// ends.
export function downloadScreenshot(gl: WebGLRenderer, display: ShaderTriangle, completed: WebGLRenderTarget) {
  drawDisplay(gl, display, completed)
  gl.domElement.toBlob(blob => {
    if (!blob) {
      console.error('The canvas could not be encoded as a PNG.')
      return
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'path-tracer.png'
    link.click()

    // Some browsers start the download after `click` returns, so the URL must outlive this call.
    setTimeout(() => URL.revokeObjectURL(url), revokeDelayMs)
  }, 'image/png')
}

// Draws the BVH boxes over whatever the canvas holds. The renderer never clears on its own. With the selected-triangle filter
// on, only the tapped triangle and the boxes around it are drawn, at every depth. Otherwise every box in the
// chosen band of levels is drawn.
function drawBoxes(gl: WebGLRenderer, camera: PerspectiveCamera, wireframe: Wireframe) {
  const { bvhMinDepth, bvhMaxDepth, showSelectedBoxesOnly } = useAppStore.getState()
  gl.setRenderTarget(null)
  if (showSelectedBoxesOnly) {
    gl.render(wireframe.selection, camera)
    return
  }

  gl.render(wireframe.boxes(bvhMinDepth, bvhMaxDepth), camera)
}

// The wireframe settings and selection that decide what a wireframe draw shows, or empty while no wireframe is on.
function wireframeKey(wireframe: Wireframe): string {
  const { showMeshWireframe, showBvhWireframe, showSelectedBoxesOnly, bvhMinDepth, bvhMaxDepth } =
    useAppStore.getState()
  if (!showMeshWireframe && !showBvhWireframe) {
    return ''
  }
  return [
    showMeshWireframe,
    showBvhWireframe,
    showSelectedBoxesOnly,
    bvhMinDepth,
    bvhMaxDepth,
    wireframe.selectionVersion(),
  ].join(':')
}

// Draws the canvas when something on it changed since the last draw. The canvas keeps what was drawn, so an unchanged
// frame is skipped and the GPU stays free for tracing.
// - The mesh wireframe replaces the traced image on black. It is drawn when the camera or a wireframe setting changed.
// - The traced image is drawn when a sample completed or an image setting changed. With the BVH boxes on, it is also
//   drawn when the camera or a wireframe setting changed, because the boxes are drawn over it.
// - The BVH boxes are drawn over whichever of the two was just drawn.
export function drawFrame(state: TracerState, inputs: TracerInputs) {
  const { gl, camera, wireframe } = inputs
  const { showMeshWireframe, showBvhWireframe } = useAppStore.getState()

  // `CameraControls` moves the camera earlier in this frame, but three.js only refreshes a camera's world matrix when
  // the scene the camera belongs to is drawn. The camera belongs to React Three Fiber's scene, which this loop never
  // draws, so the matrix is refreshed here. Without it the wireframe would follow the camera a frame late.
  camera.updateMatrixWorld()

  const key = wireframeKey(wireframe)
  const cameraMoved = !state.lastDrawnCamera.equals(camera.matrixWorld)
  const wireframeChanged = key !== state.wireframeKey || (key !== '' && cameraMoved)
  state.wireframeKey = key
  state.lastDrawnCamera.copy(camera.matrixWorld)

  if (showMeshWireframe) {
    if (!wireframeChanged) {
      return
    }
    gl.setRenderTarget(null)
    gl.clear()
    gl.render(wireframe.faces, camera)
  } else if (state.needsDisplay || (showBvhWireframe && wireframeChanged)) {
    state.needsDisplay = false
    drawDisplay(gl, inputs.display, inputs.completed)
  } else {
    return
  }

  if (showBvhWireframe) {
    drawBoxes(gl, camera, wireframe)
  }
}

// Picks how many rows the next band covers. The preview is drawn whole, because a quick preview that arrives in pieces
// would show a half-new, half-old image to a moving camera.
function nextBandRows(state: TracerState, height: number, isPreview: boolean): number {
  const remaining = height - state.row
  if (isPreview) {
    return remaining
  }

  const rows = state.msPerRow === null ? firstBandRows : Math.floor(bandBudgetMs / state.msPerRow)
  return Math.min(Math.max(rows, 1), remaining)
}

// Adds a band of rows of the current sample to the running sum. Returns the number of rows drawn. The display pass runs
// when a sample completes, at the next rendering tick.
function drawBand(state: TracerState, inputs: TracerInputs, isPreview: boolean): number {
  const { gl, camera, width, height, packed, accumulation, completed, randomTexture, pathTrace } = inputs
  const { shadingMethod, numSamples } = useAppStore.getState()

  // Empty the running sum after a restart. This must happen with the scissor off, or only one band would be cleared.
  accumulation.scissorTest = false
  if (state.needsClear) {
    state.needsClear = false
    gl.setRenderTarget(accumulation)
    gl.clear()
  }

  // Limit the draw to this band's rows with a scissor, a rectangle the GPU will not draw outside.
  const rows = nextBandRows(state, height, isPreview)
  accumulation.scissor.set(0, state.row, width, rows)
  accumulation.scissorTest = rows < height

  // Hand the shader this sample's camera, settings and scene textures.
  const uniforms = pathTrace.material.uniforms
  uniforms.u_half_wd.value = width * 0.5
  uniforms.u_half_ht.value = height * 0.5
  uniforms.u_num_objects.value = packed.numObjects
  uniforms.u_num_lights.value = packed.numLights
  uniforms.u_sample_number.value = state.samplesDone + 1
  uniforms.u_num_bounces.value = isPreview ? 1 : state.numBounces
  uniforms.u_shading_method.value = shadingMethod
  uniforms.u_eye_to_image.value = (height * 0.5) / Math.tan(camera.fov * 0.5 * (Math.PI / 180.0))
  // The preview is a pinhole, so a moving camera shows a sharp image.
  uniforms.u_lens_radius.value = isPreview ? 0 : state.lensRadius
  uniforms.u_focus_distance.value = state.focusDistance
  uniforms.u_eye_position.value.setFromMatrixPosition(camera.matrixWorld)
  uniforms.u_eye_to_world.value.copy(camera.matrixWorld)
  uniforms.u_random_sampler.value = randomTexture
  uniforms.u_face_sampler.value = packed.facesTexture
  uniforms.u_bvh_sampler.value = packed.bvhTexture
  uniforms.u_material_sampler.value = packed.materialsTexture
  uniforms.u_light_sampler.value = packed.lightsTexture
  uniforms.u_base_color_samplers.value = packed.baseColorMaps

  // Shader triangle: trace the band and add it to the running sum.
  gl.setRenderTarget(accumulation)
  gl.render(pathTrace.scene, orthographicCamera)

  state.row += rows
  if (state.row >= height) {
    state.row = 0

    // The completed target is only ever copied into, so it has no GPU memory until this call makes it. A resize or a
    // lost context frees that memory, so the call runs before every copy. It does nothing when the memory exists.
    gl.initRenderTarget(completed)

    // The GPU runs commands in order, so the copy holds exactly the finished sample, even with the next band queued.
    gl.copyTextureToTexture(accumulation.texture, completed.texture)
    state.needsDisplay = true

    // The preview stays on screen from the completed target, but leaves the running sum, so the full samples are not
    // averaged with its flat ambient lighting. The clear runs in this untimed band so it does not skew the row timing.
    // The elapsed time starts here, because the average and the remaining time count full samples only.
    if (isPreview) {
      state.previewDone = true
      accumulation.scissorTest = false
      gl.setRenderTarget(accumulation)
      gl.clear()
      state.restartTimestamp = Date.now()
    } else {
      ++state.samplesDone
    }

    updateStatus(state, numSamples, true)
  } else {
    updateStatus(state, numSamples, false)
  }

  return rows
}

// --- Tracing loop --------------------------------------------------------------------

// Forgets the bands the GPU has finished, and learns from their timing how long a row takes. A band started when the
// GPU was free or when the band before it finished, whichever is later. A fence the GPU cannot signal, such as after a
// lost context, counts as finished.
function retireFinishedBands(context: WebGL2RenderingContext, state: TracerState) {
  while (state.bands.length > 0 && context.clientWaitSync(state.bands[0].fence, 0, 0) !== context.TIMEOUT_EXPIRED) {
    const band = state.bands.shift()!
    context.deleteSync(band.fence)

    const now = performance.now()
    if (band.timed) {
      const msPerRow = (now - Math.max(band.submittedAt, state.lastBandDoneAt)) / band.rows
      state.msPerRow =
        state.msPerRow === null ? msPerRow : state.msPerRow + (msPerRow - state.msPerRow) * msPerRowSmoothing
    }
    state.lastBandDoneAt = now
  }
}

// Submits one band when the GPU has room and the settings call for one. Returns how many milliseconds to wait before
// the next try.
export function traceStep(state: TracerState, inputs: TracerInputs, interacting: boolean): number {
  const context = inputs.gl.getContext() as WebGL2RenderingContext
  if (context.isContextLost()) {
    return idlePollMs
  }

  retireFinishedBands(context, state)

  inputs.camera.updateMatrixWorld()
  if (!state.lastCameraMatrix.equals(inputs.camera.matrixWorld)) {
    state.lastCameraMatrix.copy(inputs.camera.matrixWorld)
    renderReset(state)
  }

  // The mesh wireframe pauses tracing. The camera check above still runs during the pause, so moving the camera then
  // throws away the samples, and tracing starts over when the pause ends.
  if (state.pausedAt !== null) {
    return idlePollMs
  }

  // While the user is moving the camera, only the preview is drawn. A sample that has started is finished even when the
  // sample ceiling drops below it, so no rows end up one sample behind the rest.
  const { numSamples } = useAppStore.getState()
  const isPreview = !state.previewDone
  if ((state.row === 0 && state.samplesDone >= numSamples) || (!isPreview && interacting)) {
    return idlePollMs
  }
  if (state.bands.length >= maxBandsInFlight) {
    return fencePollMs
  }

  const submittedAt = performance.now()
  const rows = drawBand(state, inputs, isPreview)

  const fence = context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0)
  if (fence) {
    state.bands.push({ fence, submittedAt, rows, timed: !isPreview })
  }
  context.flush() // a fence is only signaled once the GPU has been sent the commands before it

  return 0
}

// --- Setting changes -----------------------------------------------------------------

// Watches the store for settings that affect the render. Returns a function that stops watching.
export function watchSettings(state: TracerState) {
  // Any setting that changes what is traced restarts accumulation. A new one belongs here, except one that is dragged on
  // a slider, which needs a delay like the bounce count, lens radius and focus distance below. A setting that only
  // changes how the display pass draws the samples belongs with the exposure and contrast at the end instead.
  const stopRestartSettings = useAppStore.subscribe(
    s => [s.cameraFov, s.shadingMethod],
    () => renderReset(state),
    { equalityFn: shallow },
  )

  // Dragging the bounce, lens radius or focus slider would restart accumulation at every tick. Instead the render keeps
  // its current values until the settings have stopped changing, then restarts once at the new ones.
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  const stopSliders = useAppStore.subscribe(
    s => [s.numBounces, s.lensRadius, s.focusDistance],
    ([numBounces, lensRadius, focusDistance]) => {
      clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        if (
          numBounces !== state.numBounces ||
          lensRadius !== state.lensRadius ||
          focusDistance !== state.focusDistance
        ) {
          renderReset(state)
        }
      }, sliderSettleMs)
    },
    { equalityFn: shallow },
  )

  // The sample count only moves the stop ceiling, so accumulation continues. The readout is refreshed because a stopped
  // render draws nothing that would update it.
  const stopNumSamples = useAppStore.subscribe(
    s => s.numSamples,
    numSamples => updateStatus(state, numSamples, true),
  )

  // The exposure and contrast only change how the display pass draws the samples already traced, so they redraw the
  // picture instead of restarting. A finished render traces nothing more, so without this redraw the picture would keep
  // the old values.
  const stopImageSettings = useAppStore.subscribe(
    s => [s.exposure, s.contrast],
    () => {
      state.needsDisplay = true
    },
    { equalityFn: shallow },
  )

  // The mesh wireframe pauses tracing while it is shown. The paused time is left out of the elapsed, average and
  // remaining times, which count tracing time only. Switching back redraws the traced image, which a finished render
  // would otherwise leave covered by the last wireframe frame.
  const stopMeshWireframe = useAppStore.subscribe(
    s => s.showMeshWireframe,
    shown => {
      if (shown) {
        state.pausedAt = Date.now()
      } else if (state.pausedAt !== null) {
        state.restartTimestamp += Date.now() - state.pausedAt
        state.pausedAt = null
        state.needsDisplay = true
      }
    },
  )

  // The BVH boxes draw over the traced image without pausing it. Turning them off redraws the image, which a finished
  // render would otherwise leave with the last boxes drawn on it.
  const stopBvhWireframe = useAppStore.subscribe(
    s => s.showBvhWireframe,
    () => {
      state.needsDisplay = true
    },
  )

  return () => {
    clearTimeout(settleTimer)
    stopRestartSettings()
    stopSliders()
    stopNumSamples()
    stopImageSettings()
    stopMeshWireframe()
    stopBvhWireframe()
  }
}
