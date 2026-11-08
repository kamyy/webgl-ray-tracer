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
const bouncesSettleMs = 500 // how long the bounce setting must stay unchanged before it restarts accumulation

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
  samplesDone: number // number of samples submitted to the GPU
  row: number // first row of the current sample that has not been submitted yet
  msPerRow: number | null // GPU time per row, smoothed over the bands timed so far, or null before the first
  lastBandDoneAt: number // performance.now() when the GPU last finished a band
  restartTimestamp: number // when accumulation last restarted, for the elapsed and remaining times
  numBounces: number // the bounce depth the accumulated samples were traced at, which trails a dragged setting
  needsClear: boolean // true after a restart, so the next draw empties the accumulation target first
  needsDisplay: boolean // true after a sample completes, so the next rendering tick draws the display pass
  bands: Band[] // the bands still on the GPU, oldest first
  lastStatusTimestamp: number // when the counters were last written to the store
  lastCameraMatrix: Matrix4 // the camera's world matrix at the last frame, to notice that it moved
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
}

// --- Setup ---------------------------------------------------------------------------

export function createTracerState(): TracerState {
  return {
    samplesDone: 0,
    row: 0,
    msPerRow: null,
    lastBandDoneAt: 0,
    restartTimestamp: Date.now(),
    numBounces: useAppStore.getState().numBounces,
    needsClear: true,
    needsDisplay: false,
    bands: [],
    lastStatusTimestamp: 0,
    lastCameraMatrix: new Matrix4(),
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
  state.samplesDone = 0
  state.row = 0
  state.needsClear = true
  state.numBounces = useAppStore.getState().numBounces
  state.restartTimestamp = Date.now()
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
// rendering tick. The one-bounce preview is not counted. A camera or setting that is being dragged restarts the render
// before the next sample finishes, so showing the preview would flash numbers between the dashes of each restart.
function updateStatus(state: TracerState, numSamples: number, force: boolean) {
  if (state.samplesDone < 2 && state.samplesDone < numSamples) {
    return
  }

  const now = Date.now()
  if (!force && now - state.lastStatusTimestamp < statusIntervalMs) {
    return
  }
  state.lastStatusTimestamp = now

  const elapsed = now - state.restartTimestamp
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

// Draws the average of the last completed sum to the canvas.
function drawDisplay(gl: WebGLRenderer, display: ShaderTriangle, completed: WebGLRenderTarget) {
  display.material.uniforms.u_color_sampler.value = completed.texture
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

// Draws the display pass when a sample completed since the last time it was drawn.
export function drawDisplayIfNeeded(state: TracerState, inputs: TracerInputs) {
  if (state.needsDisplay) {
    state.needsDisplay = false
    drawDisplay(inputs.gl, inputs.display, inputs.completed)
  }
}

// Picks how many rows the next band covers. The first sample after a restart is drawn whole, because a quick preview
// that arrives in pieces would show a half-new, half-old image to a moving camera.
function nextBandRows(state: TracerState, height: number): number {
  const remaining = height - state.row
  if (state.samplesDone === 0) {
    return remaining
  }

  const rows = state.msPerRow === null ? firstBandRows : Math.floor(bandBudgetMs / state.msPerRow)
  return Math.min(Math.max(rows, 1), remaining)
}

// Adds a band of rows of the current sample to the running sum. Returns the number of rows drawn. The display pass runs
// when a sample completes, at the next rendering tick.
function drawBand(state: TracerState, inputs: TracerInputs): number {
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
  const rows = nextBandRows(state, height)
  accumulation.scissor.set(0, state.row, width, rows)
  accumulation.scissorTest = rows < height

  // Hand the shader this sample's camera, settings and scene textures.
  const uniforms = pathTrace.material.uniforms
  uniforms.u_half_wd.value = width * 0.5
  uniforms.u_half_ht.value = height * 0.5
  uniforms.u_num_objects.value = packed.numObjects
  uniforms.u_num_lights.value = packed.numLights
  uniforms.u_sample_number.value = state.samplesDone + 1
  uniforms.u_num_bounces.value = state.samplesDone === 0 ? 1 : state.numBounces
  uniforms.u_shading_method.value = shadingMethod
  uniforms.u_eye_to_image.value = (height * 0.5) / Math.tan(camera.fov * 0.5 * (Math.PI / 180.0))
  uniforms.u_eye_position.value.setFromMatrixPosition(camera.matrixWorld)
  uniforms.u_eye_to_world.value.copy(camera.matrixWorld)
  uniforms.u_random_sampler.value = randomTexture
  uniforms.u_face_sampler.value = packed.facesTexture
  uniforms.u_bvh_sampler.value = packed.bvhTexture
  uniforms.u_material_sampler.value = packed.materialsTexture
  uniforms.u_light_sampler.value = packed.lightsTexture

  // Shader triangle: trace the band and add it to the running sum.
  gl.setRenderTarget(accumulation)
  gl.render(pathTrace.scene, orthographicCamera)

  state.row += rows
  if (state.row >= height) {
    state.row = 0
    ++state.samplesDone

    // The completed target is only ever copied into, so it has no GPU memory until this call makes it. A resize or a
    // lost context frees that memory, so the call runs before every copy. It does nothing when the memory exists.
    gl.initRenderTarget(completed)

    // The GPU runs commands in order, so the copy holds exactly the finished sample, even with the next band queued.
    gl.copyTextureToTexture(accumulation.texture, completed.texture)
    state.needsDisplay = true
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

  // While dragging, only the preview is drawn. A sample that has started is finished even when the sample ceiling drops
  // below it, so no rows end up one sample behind the rest.
  const { numSamples } = useAppStore.getState()
  const isPreview = state.samplesDone === 0
  if ((state.row === 0 && state.samplesDone >= numSamples) || (!isPreview && interacting)) {
    return idlePollMs
  }
  if (state.bands.length >= maxBandsInFlight) {
    return fencePollMs
  }

  const submittedAt = performance.now()
  const rows = drawBand(state, inputs)

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
  // Any setting that changes the image restarts accumulation. A new one belongs here, except one that is dragged on a
  // slider, which needs a delay like the bounce count below.
  const stopRestartSettings = useAppStore.subscribe(
    s => [s.cameraFov, s.shadingMethod],
    () => renderReset(state),
    { equalityFn: shallow },
  )

  // Dragging the bounce slider would restart accumulation at every tick. Instead the render keeps its current depth
  // until the setting has stopped changing, then restarts once at the new depth.
  let bouncesTimer: ReturnType<typeof setTimeout> | undefined
  const stopBounces = useAppStore.subscribe(
    s => s.numBounces,
    numBounces => {
      clearTimeout(bouncesTimer)
      bouncesTimer = setTimeout(() => {
        if (numBounces !== state.numBounces) {
          renderReset(state)
        }
      }, bouncesSettleMs)
    },
  )

  // The sample count only moves the stop ceiling, so accumulation continues. The readout is refreshed because a stopped
  // render draws nothing that would update it.
  const stopNumSamples = useAppStore.subscribe(
    s => s.numSamples,
    numSamples => updateStatus(state, numSamples, true),
  )

  return () => {
    clearTimeout(bouncesTimer)
    stopRestartSettings()
    stopBounces()
    stopNumSamples()
  }
}
