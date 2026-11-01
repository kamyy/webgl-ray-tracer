/**
 * Runs the progressive path tracer inside the React Three Fiber canvas.
 *
 * Each animation frame renders one more sample per pixel: the path-tracing shader adds a sample to the running sum
 * held in one of two float render targets, and the display shader divides that sum by the pass count and draws it to
 * the canvas. The two targets swap roles every pass, because a shader cannot read and write the same texture. The
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

interface PassState {
  renderingPass: number
  restartTimestamp: number
  writeToA: boolean // which accumulation target the next pass writes to
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
  targetA: WebGLRenderTarget
  targetB: WebGLRenderTarget
  randomTexture: DataTexture
  pathTrace: ScreenPass
  display: ScreenPass
}

interface PathTracerProps {
  packed: PackedScene
  interactingRef: RefObject<boolean> // true while the user is dragging the camera
}

function createPassState(): PassState {
  return { renderingPass: 0, restartTimestamp: Date.now(), writeToA: true, lastCameraMatrix: new Matrix4() }
}

function createScreenPass(material: RawShaderMaterial): ScreenPass {
  return { material, scene: createScreenQuad(material) }
}

// Every pixel is overwritten by each pass, so the renderer does not need to clear first.
function disableAutoClear(gl: WebGLRenderer) {
  gl.autoClear = false
}

// Restart accumulation at pass 0.
function renderReset(state: PassState) {
  state.renderingPass = 0
  state.restartTimestamp = Date.now()
  useAppStore.getState().resetStatus()
}

// Adds one sample per pixel to the running sum, then draws the average to the canvas.
function drawPass(state: PassState, inputs: PassInputs) {
  const { gl, camera, width, height, packed, randomTexture, pathTrace, display } = inputs
  const { numSamples, numBounces, shadingMethod } = useAppStore.getState()

  ++state.renderingPass
  const write = state.writeToA ? inputs.targetA : inputs.targetB
  const read = state.writeToA ? inputs.targetB : inputs.targetA
  state.writeToA = !state.writeToA

  const uniforms = pathTrace.material.uniforms
  uniforms.u_half_wd.value = width * 0.5
  uniforms.u_half_ht.value = height * 0.5
  uniforms.u_num_objects.value = packed.numObjects
  uniforms.u_render_pass.value = state.renderingPass
  uniforms.u_num_bounces.value = state.renderingPass === 1 ? 1 : numBounces
  uniforms.u_shading_method.value = shadingMethod
  uniforms.u_eye_to_image.value = (height * 0.5) / Math.tan(camera.fov * 0.5 * (Math.PI / 180.0))
  uniforms.u_eye_position.value.setFromMatrixPosition(camera.matrixWorld)
  uniforms.u_eye_to_world.value.copy(camera.matrixWorld)
  uniforms.u_color_sampler.value = read.texture
  uniforms.u_random_sampler.value = randomTexture
  uniforms.u_face_sampler.value = packed.facesTexture
  uniforms.u_bvh_sampler.value = packed.bvhTexture
  uniforms.u_material_sampler.value = packed.materialsTexture

  gl.setRenderTarget(write)
  gl.render(pathTrace.scene, screenQuadCamera)

  display.material.uniforms.u_color_sampler.value = write.texture
  display.material.uniforms.u_inv_render_pass.value = 1.0 / state.renderingPass
  gl.setRenderTarget(null)
  gl.render(display.scene, screenQuadCamera)

  const elapsed = Date.now() - state.restartTimestamp
  const average = elapsed / state.renderingPass
  const eta = (numSamples - state.renderingPass) * average
  useAppStore.getState().setStatus({
    renderingPass: state.renderingPass,
    elapsedTime: new Date(elapsed).toISOString().slice(11, 19),
    etaTime: new Date(eta).toISOString().slice(11, 19),
    avgTime: `${average.toFixed(0)}ms`,
  })
}

// Called every animation frame. Restarts accumulation when the camera moved, then draws the next pass if one is due.
function frame(state: PassState, inputs: PassInputs, interacting: boolean) {
  inputs.camera.updateMatrixWorld()
  if (!state.lastCameraMatrix.equals(inputs.camera.matrixWorld)) {
    state.lastCameraMatrix.copy(inputs.camera.matrixWorld)
    renderReset(state)
  }

  // Pass 1 always renders so a moving camera shows something. While dragging, no later pass renders.
  const { numSamples } = useAppStore.getState()
  if (state.renderingPass < numSamples && (state.renderingPass === 0 || !interacting)) {
    drawPass(state, inputs)
  }
}

export function PathTracer({ packed, interactingRef }: PathTracerProps) {
  const gl = useThree(state => state.gl)
  const camera = useThree(state => state.camera) as PerspectiveCamera
  const size = useThree(state => state.size)
  const width = Math.floor(size.width)
  const height = Math.floor(size.height)

  const targetA = useFBO(width, height, renderTargetSettings)
  const targetB = useFBO(width, height, renderTargetSettings)
  const randomTexture = useMemo(() => createRandomTexture(width, height), [width, height])
  const pathTrace = useMemo(() => createScreenPass(createPathTraceMaterial()), [])
  const display = useMemo(() => createScreenPass(createDisplayMaterial()), [])
  const [state] = useState(createPassState)

  useEffect(() => {
    disableAutoClear(gl)
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
  useFrame(() => {
    const inputs = { gl, camera, width, height, packed, targetA, targetB, randomTexture, pathTrace, display }
    frame(state, inputs, interactingRef.current)
  }, 1)

  return null
}
