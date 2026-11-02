/**
 * Runs the progressive path tracer inside the React Three Fiber canvas.
 *
 * One pass adds one sample per pixel to a running sum held in a float render target, with the sample count in the
 * alpha channel. The display shader divides the sum by that count and draws it to the canvas. A full pass on a slow
 * GPU can take hundreds of milliseconds, and the page cannot repaint while the GPU is busy, so a pass is split into
 * horizontal strips and one strip is drawn per animation frame. The number of strips adapts to the frame time. The
 * component renders nothing itself. It takes over drawing from React Three Fiber with a render priority.
 */
import { useFBO } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { RefObject, useEffect, useMemo, useState } from 'react'
import {
  DataTexture,
  FloatType,
  Matrix4,
  NearestFilter,
  PerspectiveCamera,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { shallow } from 'zustand/shallow'
import { useAppStore } from '../lib/store/appStore'
import { createDisplayMaterial } from '../lib/webgl/displayMaterial'
import { PackedScene } from '../lib/webgl/packScene'
import { createPathTraceMaterial } from '../lib/webgl/pathTraceMaterial'
import { createRandomTexture } from '../lib/webgl/randomTexture'
import { createScreenQuad, screenQuadCamera } from '../lib/webgl/screenQuad'
import { registerScreenshot } from '../lib/webgl/screenshot'

// The accumulation target holds a running sum of color samples, so it needs a float format. Nearest filtering and no
// mipmaps keep each texel exact, because the display pass reads the sum back one texel per pixel.
const renderTargetSettings = {
  type: FloatType,
  format: RGBAFormat,
  minFilter: NearestFilter,
  magFilter: NearestFilter,
  depthBuffer: false,
  generateMipmaps: false,
}

// A pass is drawn as horizontal strips, one strip per animation frame, so the page can repaint between strips. The
// thresholds below grow or shrink the strip count to hold the frame time near one display refresh.
const maxNumStrips = 32
const slowFrameMs = 24 // a frame this long means a strip is too much work for one frame
const slowFramesBeforeMoreStrips = 2
const fastFrameMs = 18 // at 60 Hz an idle frame is about 16.7 ms, so a faster-than-this frame has headroom
const fastFramesBeforeFewerStrips = 30
const statusIntervalMs = 500 // how often the status counters are written to the store
const revokeDelayMs = 10_000 // how long a screenshot's object URL stays valid after the download starts
const bouncesSettleMs = 500 // how long the bounce setting must stay unchanged before it restarts accumulation

// Everything the render loop remembers between frames. It lives in a plain object rather than React state, because
// it changes every frame and must not re-render the page.
interface PassState {
  renderingPass: number // number of completed passes
  restartTimestamp: number // when accumulation last restarted, for the elapsed and remaining times
  numStrips: number // strips per pass, only changed between passes so every pass covers each row once
  wantedNumStrips: number // the strip count that `adaptNumStrips` wants to switch to at the next pass boundary
  strip: number // next strip of the current pass
  numBounces: number // the bounce depth the accumulated passes were traced at, which trails the setting while it is dragged
  needsClear: boolean // true after a restart, so the next draw empties the accumulation target first
  drewLastFrame: boolean // false after a frame with no strip drawn, because the preview is no measure of a strip
  slowFrames: number // consecutive frames over `slowFrameMs`
  fastFrames: number // consecutive frames under `fastFrameMs`
  lastStatusTimestamp: number // when the counters were last written to the store
  lastCameraMatrix: Matrix4 // the camera's world matrix at the last frame, to notice that it moved
}

// A fragment shader that covers the whole target, with the scene that draws it.
interface ScreenPass {
  material: RawShaderMaterial
  scene: Scene
}

// The objects that one frame of drawing needs, gathered so the drawing helpers take one argument.
interface PassInputs {
  gl: WebGLRenderer
  camera: PerspectiveCamera
  width: number
  height: number
  packed: PackedScene
  accumulation: WebGLRenderTarget
  randomTexture: DataTexture
  pathTrace: ScreenPass
  display: ScreenPass
}

interface PathTracerProps {
  packed: PackedScene | null // null while no scene is ready, and nothing is drawn
  interactingRef: RefObject<boolean> // true while the user is dragging the camera
}

// --- Pass state ----------------------------------------------------------------------

function createPassState(): PassState {
  return {
    renderingPass: 0,
    restartTimestamp: Date.now(),
    numStrips: 4,
    wantedNumStrips: 4,
    strip: 0,
    numBounces: useAppStore.getState().numBounces,
    needsClear: true,
    drewLastFrame: false,
    slowFrames: 0,
    fastFrames: 0,
    lastStatusTimestamp: 0,
    lastCameraMatrix: new Matrix4(),
  }
}

function createScreenPass(material: RawShaderMaterial): ScreenPass {
  return { material, scene: createScreenQuad(material) }
}

// Every pixel of the canvas is overwritten by the display pass, and the accumulation target is cleared to zero
// samples, so the renderer clears to transparent black and never clears on its own.
function configureRenderer(gl: WebGLRenderer) {
  gl.autoClear = false
  gl.setClearColor(0x000000, 0)
}

// Restart accumulation at pass 0.
function renderReset(state: PassState) {
  state.renderingPass = 0
  state.strip = 0
  state.needsClear = true
  state.numBounces = useAppStore.getState().numBounces
  state.restartTimestamp = Date.now()
  useAppStore.getState().resetStatus()
}

// --- Strip count ---------------------------------------------------------------------

// Strips make a pass cheaper per frame, so add some when frames run long and remove some when they have headroom.
function adaptNumStrips(state: PassState, frameMs: number) {
  if (!state.drewLastFrame) {
    return
  }

  if (frameMs > slowFrameMs) {
    state.fastFrames = 0
    if (++state.slowFrames >= slowFramesBeforeMoreStrips) {
      state.wantedNumStrips = Math.min(state.numStrips * 2, maxNumStrips)
      state.slowFrames = 0
    }
  } else if (frameMs <= fastFrameMs) {
    state.slowFrames = 0
    if (++state.fastFrames >= fastFramesBeforeFewerStrips) {
      state.wantedNumStrips = Math.max(Math.floor(state.numStrips / 2), 1)
      state.fastFrames = 0
    }
  } else {
    state.slowFrames = 0
    state.fastFrames = 0
  }
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

// Writes the pass and timing counters to the store at a few updates a second, so React does not re-render every frame.
function updateStatus(state: PassState, numSamples: number, force: boolean) {
  const now = Date.now()
  if (!force && now - state.lastStatusTimestamp < statusIntervalMs) {
    return
  }
  state.lastStatusTimestamp = now

  const elapsed = now - state.restartTimestamp
  const average = elapsed / Math.max(state.renderingPass, 1)
  const eta = (numSamples - state.renderingPass) * average
  useAppStore.getState().setStatus({
    renderingPass: state.renderingPass,
    elapsedTime: formatDuration(elapsed),
    etaTime: formatDuration(eta),
    avgTime: `${average.toFixed(0)}ms`,
  })
}

// --- Drawing -------------------------------------------------------------------------

// Draws the average of the running sum to the canvas.
function drawDisplay(gl: WebGLRenderer, display: ScreenPass, accumulation: WebGLRenderTarget) {
  display.material.uniforms.u_color_sampler.value = accumulation.texture
  gl.setRenderTarget(null)
  gl.render(display.scene, screenQuadCamera)
}

// Saves the canvas as a PNG file. The canvas is not created with `preserveDrawingBuffer`, so its contents are gone
// once the browser has shown them. The display pass is drawn again, and `toBlob` copies the canvas before this task
// ends.
function downloadScreenshot(gl: WebGLRenderer, display: ScreenPass, accumulation: WebGLRenderTarget) {
  drawDisplay(gl, display, accumulation)
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

// Adds one strip of samples to the running sum, then draws the average of everything accumulated so far.
function drawStrip(state: PassState, inputs: PassInputs, numStrips: number) {
  const { gl, camera, width, height, packed, accumulation, randomTexture, pathTrace, display } = inputs
  const { shadingMethod, numSamples } = useAppStore.getState()

  // Empty the running sum after a restart. This must happen with the scissor off, or only one strip would be cleared.
  accumulation.scissorTest = false
  if (state.needsClear) {
    state.needsClear = false
    gl.setRenderTarget(accumulation)
    gl.clear()
  }

  // Limit the draw to this strip's rows. A single strip is the whole image, so it needs no scissor.
  const firstRow = Math.floor((height * state.strip) / numStrips)
  const lastRow = Math.floor((height * (state.strip + 1)) / numStrips)
  accumulation.scissor.set(0, firstRow, width, lastRow - firstRow)
  accumulation.scissorTest = numStrips > 1

  // Hand the shader this frame's camera, settings and scene textures.
  const uniforms = pathTrace.material.uniforms
  uniforms.u_half_wd.value = width * 0.5
  uniforms.u_half_ht.value = height * 0.5
  uniforms.u_num_objects.value = packed.numObjects
  uniforms.u_render_pass.value = state.renderingPass + 1
  uniforms.u_num_bounces.value = state.renderingPass === 0 ? 1 : state.numBounces
  uniforms.u_shading_method.value = shadingMethod
  uniforms.u_eye_to_image.value = (height * 0.5) / Math.tan(camera.fov * 0.5 * (Math.PI / 180.0))
  uniforms.u_eye_position.value.setFromMatrixPosition(camera.matrixWorld)
  uniforms.u_eye_to_world.value.copy(camera.matrixWorld)
  uniforms.u_random_sampler.value = randomTexture
  uniforms.u_face_sampler.value = packed.facesTexture
  uniforms.u_bvh_sampler.value = packed.bvhTexture
  uniforms.u_material_sampler.value = packed.materialsTexture

  // Pass 1: trace the strip and add its samples to the running sum.
  gl.setRenderTarget(accumulation)
  gl.render(pathTrace.scene, screenQuadCamera)

  // Pass 2: divide the sum by the sample count and show it on the canvas. This covers every pixel, so strips not yet
  // traced in this pass still show their previous average.
  drawDisplay(gl, display, accumulation)

  // Move to the next strip. After the last one the pass is complete, so a new strip count may take effect and the
  // counters are written at once, so the final pass always shows.
  if (++state.strip >= numStrips) {
    state.strip = 0
    ++state.renderingPass
    state.numStrips = state.wantedNumStrips
    updateStatus(state, numSamples, state.renderingPass >= numSamples)
  } else {
    updateStatus(state, numSamples, false)
  }
}

// Called every animation frame. Restarts accumulation when the camera moved, then draws the next strip if one is due.
function frame(state: PassState, inputs: PassInputs, interacting: boolean, frameMs: number) {
  inputs.camera.updateMatrixWorld()
  if (!state.lastCameraMatrix.equals(inputs.camera.matrixWorld)) {
    state.lastCameraMatrix.copy(inputs.camera.matrixWorld)
    renderReset(state)
  }

  adaptNumStrips(state, frameMs)
  state.drewLastFrame = false

  // The first pass after a restart is a quick one-bounce preview, drawn whole so a moving camera always shows a
  // complete image. While dragging, no later pass is drawn. A pass that has started is finished even when the sample
  // ceiling drops below it, so no rows end up one sample behind the rest.
  const { numSamples } = useAppStore.getState()
  const isPreview = state.renderingPass === 0
  if ((state.strip > 0 || state.renderingPass < numSamples) && (isPreview || !interacting)) {
    drawStrip(state, inputs, isPreview ? 1 : state.numStrips)
    state.drewLastFrame = !isPreview
  }
}

// --- Path tracer ---------------------------------------------------------------------

export function PathTracer({ packed, interactingRef }: PathTracerProps) {
  const gl = useThree(state => state.gl)
  const camera = useThree(state => state.camera) as PerspectiveCamera
  const size = useThree(state => state.size)
  const dpr = useThree(state => state.viewport.dpr)
  const width = Math.floor(size.width * dpr) // the drawing buffer is size * dpr, and so are the render targets
  const height = Math.floor(size.height * dpr)

  // The render targets and textures are rebuilt whenever the view size changes.
  const accumulation = useFBO(width, height, renderTargetSettings)
  const randomTexture = useMemo(() => createRandomTexture(width, height), [width, height])
  const pathTrace = useMemo(() => createScreenPass(createPathTraceMaterial()), [])
  const display = useMemo(() => createScreenPass(createDisplayMaterial()), [])
  const [state] = useState(createPassState)

  useEffect(() => {
    configureRenderer(gl)
  }, [gl])

  // A new view size means new render targets, which start empty, and a new scene means new geometry, so accumulation
  // starts over.
  useEffect(() => {
    renderReset(state)
  }, [state, width, height, packed])

  // The readout shows the size of the drawing buffer, which is also the size of a saved screenshot.
  useEffect(() => {
    useAppStore.getState().setResolution(width, height)
  }, [width, height])

  // Any setting that changes the image restarts accumulation. A new one belongs in this list, except one that is
  // dragged on a slider, which needs a delay like the bounce count below.
  useEffect(
    () =>
      useAppStore.subscribe(
        s => [s.cameraFov, s.shadingMethod],
        () => renderReset(state),
        { equalityFn: shallow },
      ),
    [state],
  )

  // Dragging the bounce slider would restart accumulation at every tick. Instead the render keeps its current depth
  // until the setting has stopped changing, then restarts once at the new depth.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = useAppStore.subscribe(
      s => s.numBounces,
      numBounces => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          if (numBounces !== state.numBounces) {
            renderReset(state)
          }
        }, bouncesSettleMs)
      },
    )
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [state])

  // The sample count only moves the stop ceiling, so accumulation continues. The readout is refreshed because a stopped
  // render draws nothing that would update it.
  useEffect(
    () =>
      useAppStore.subscribe(
        s => s.numSamples,
        numSamples => updateStatus(state, numSamples, true),
      ),
    [state],
  )

  // A lost context takes the accumulated image with it, so start over once it is back.
  useEffect(() => {
    const canvas = gl.domElement
    const restart = () => renderReset(state)
    canvas.addEventListener('webglcontextrestored', restart)
    return () => canvas.removeEventListener('webglcontextrestored', restart)
  }, [gl, state])

  // The heads-up display saves the image through this registration.
  useEffect(() => registerScreenshot(() => downloadScreenshot(gl, display, accumulation)), [gl, display, accumulation])

  // Free GPU memory when a texture or material is replaced or the component unmounts.
  useEffect(() => {
    return () => {
      randomTexture.dispose()
    }
  }, [randomTexture])

  // The packed textures leave the GPU when the scene is replaced. A bundled scene keeps its packed data in memory, so
  // choosing it again uploads the textures again.
  useEffect(() => {
    return () => {
      packed?.facesTexture.dispose()
      packed?.bvhTexture.dispose()
      packed?.materialsTexture.dispose()
    }
  }, [packed])

  useEffect(() => {
    return () => {
      pathTrace.material.dispose()
      display.material.dispose()
    }
  }, [pathTrace, display])

  // Priority above 0 turns off React Three Fiber's own rendering, so this callback does all the drawing.
  useFrame((_, deltaSeconds) => {
    if (!packed) {
      return
    }

    const inputs = { gl, camera, width, height, packed, accumulation, randomTexture, pathTrace, display }
    frame(state, inputs, interactingRef.current, deltaSeconds * 1000)
  }, 1)

  return null
}
