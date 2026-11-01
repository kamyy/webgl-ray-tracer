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

const renderTargetSettings = {
  type: FloatType,
  format: RGBAFormat,
  minFilter: NearestFilter,
  magFilter: NearestFilter,
  depthBuffer: false,
  generateMipmaps: false,
}

const maxNumStrips = 32
const slowFrameMs = 24 // a frame this long means a strip is too much work for one frame
const slowFramesBeforeMoreStrips = 2
const fastFrameMs = 18 // at 60 Hz an idle frame is about 16.7 ms, so a faster-than-this frame has headroom
const fastFramesBeforeFewerStrips = 30
const statusIntervalMs = 250 // how often the status counters are written to the store

interface PassState {
  renderingPass: number // number of completed passes
  restartTimestamp: number
  numStrips: number // strips per pass, only changed between passes so every pass covers each row once
  wantedNumStrips: number
  strip: number // next strip of the current pass
  needsClear: boolean
  drewLastFrame: boolean
  slowFrames: number
  fastFrames: number
  lastStatusTimestamp: number
  lastCameraMatrix: Matrix4
}

interface ScreenPass {
  material: RawShaderMaterial
  scene: Scene
}

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
  packed: PackedScene
  interactingRef: RefObject<boolean> // true while the user is dragging the camera
}

function createPassState(): PassState {
  return {
    renderingPass: 0,
    restartTimestamp: Date.now(),
    numStrips: 4,
    wantedNumStrips: 4,
    strip: 0,
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
  state.restartTimestamp = Date.now()
  useAppStore.getState().resetStatus()
}

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
    elapsedTime: new Date(elapsed).toISOString().slice(11, 19),
    etaTime: new Date(eta).toISOString().slice(11, 19),
    avgTime: `${average.toFixed(0)}ms`,
  })
}

// Adds one strip of samples to the running sum, then draws the average of everything accumulated so far.
function drawStrip(state: PassState, inputs: PassInputs, numStrips: number) {
  const { gl, camera, width, height, packed, accumulation, randomTexture, pathTrace, display } = inputs
  const { numBounces, shadingMethod, numSamples } = useAppStore.getState()

  accumulation.scissorTest = false
  if (state.needsClear) {
    state.needsClear = false
    gl.setRenderTarget(accumulation)
    gl.clear()
  }

  const firstRow = Math.floor((height * state.strip) / numStrips)
  const lastRow = Math.floor((height * (state.strip + 1)) / numStrips)
  accumulation.scissor.set(0, firstRow, width, lastRow - firstRow)
  accumulation.scissorTest = numStrips > 1

  const uniforms = pathTrace.material.uniforms
  uniforms.u_half_wd.value = width * 0.5
  uniforms.u_half_ht.value = height * 0.5
  uniforms.u_num_objects.value = packed.numObjects
  uniforms.u_render_pass.value = state.renderingPass + 1
  uniforms.u_num_bounces.value = state.renderingPass === 0 ? 1 : numBounces
  uniforms.u_shading_method.value = shadingMethod
  uniforms.u_eye_to_image.value = (height * 0.5) / Math.tan(camera.fov * 0.5 * (Math.PI / 180.0))
  uniforms.u_eye_position.value.setFromMatrixPosition(camera.matrixWorld)
  uniforms.u_eye_to_world.value.copy(camera.matrixWorld)
  uniforms.u_random_sampler.value = randomTexture
  uniforms.u_face_sampler.value = packed.facesTexture
  uniforms.u_bvh_sampler.value = packed.bvhTexture
  uniforms.u_material_sampler.value = packed.materialsTexture

  gl.setRenderTarget(accumulation)
  gl.render(pathTrace.scene, screenQuadCamera)
  accumulation.scissorTest = false

  display.material.uniforms.u_color_sampler.value = accumulation.texture
  gl.setRenderTarget(null)
  gl.render(display.scene, screenQuadCamera)

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
  // complete image. While dragging, no later pass is drawn.
  const { numSamples } = useAppStore.getState()
  const isPreview = state.renderingPass === 0
  if (state.renderingPass < numSamples && (isPreview || !interacting)) {
    drawStrip(state, inputs, isPreview ? 1 : state.numStrips)
    state.drewLastFrame = true
  }
}

export function PathTracer({ packed, interactingRef }: PathTracerProps) {
  const gl = useThree(state => state.gl)
  const camera = useThree(state => state.camera) as PerspectiveCamera
  const size = useThree(state => state.size)
  const width = Math.floor(size.width)
  const height = Math.floor(size.height)

  const accumulation = useFBO(width, height, renderTargetSettings)
  const randomTexture = useMemo(() => createRandomTexture(width, height), [width, height])
  const pathTrace = useMemo(() => createScreenPass(createPathTraceMaterial()), [])
  const display = useMemo(() => createScreenPass(createDisplayMaterial()), [])
  const [state] = useState(createPassState)

  useEffect(() => {
    configureRenderer(gl)
  }, [gl])

  useEffect(() => {
    renderReset(state)
  }, [state, width, height])

  // Any setting that changes the image restarts accumulation.
  useEffect(
    () =>
      useAppStore.subscribe(
        s => [s.cameraFov, s.numSamples, s.numBounces, s.shadingMethod],
        () => renderReset(state),
        { equalityFn: shallow },
      ),
    [state],
  )

  useEffect(() => {
    return () => {
      randomTexture.dispose()
    }
  }, [randomTexture])

  useEffect(() => {
    return () => {
      pathTrace.material.dispose()
      display.material.dispose()
    }
  }, [pathTrace, display])

  // Priority above 0 turns off React Three Fiber's own rendering, so this callback does all the drawing.
  useFrame((_, deltaSeconds) => {
    const inputs = { gl, camera, width, height, packed, accumulation, randomTexture, pathTrace, display }
    frame(state, inputs, interactingRef.current, deltaSeconds * 1000)
  }, 1)

  return null
}
