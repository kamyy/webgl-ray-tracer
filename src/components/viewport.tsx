/**
 * The ray-traced view: a React Three Fiber canvas with a camera, orbit controls and the path tracer.
 *
 * `Canvas` owns the WebGL context and the render loop. The camera and `CameraControls` handle mouse and touch input,
 * and `PathTracer` draws each progressive sample. The glTF scene loads under `<Suspense>`, so a spinner shows until the
 * file is decoded and its BVH is built. When the GPU cannot run the tracer, or loses its context, the view says so in
 * words instead of staying blank.
 */
import { CameraControls, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Box3, Sphere, Vector3, type Object3D } from 'three'
import { usePackedScene } from '../lib/hooks/usePackedScene'
import { useAppStore } from '../lib/store/appStore'
import { checkGpuLimits, checkSceneLimits, supportsWebGL2 } from '../lib/webgl/checkGpuLimits'
import type { PackedScene } from '../lib/webgl/packScene'
import { PathTracer } from './pathTracer'

useGLTF.setDecoderPath('/draco/')

interface SceneErrorBoundaryProps {
  onError: (problem: string) => void
  children: React.ReactNode
}

// Rendered as the Suspense fallback inside the canvas. The spinner itself is plain HTML outside the canvas, so this
// only reports whether the scene is still loading.
function LoadingNotice({ onLoadingChange }: { onLoadingChange: (loading: boolean) => void }) {
  useEffect(() => {
    onLoadingChange(true)
    return () => onLoadingChange(false)
  }, [onLoadingChange])

  return null
}

// A phone's touch screen has far fewer pixels to spare than a desktop, so it traces a quarter as many.
function getPixelRatio() {
  return window.matchMedia('(pointer: coarse)').matches ? 0.5 : 1
}

// Points the camera at the middle of the scene from the front and a little above, far enough back that the whole scene
// fits in the view.
function frameCamera(controls: CameraControls, root: Object3D, fovDegrees: number) {
  const box = new Box3().setFromObject(root)
  if (box.isEmpty()) {
    return
  }

  const center = box.getCenter(new Vector3())
  const radius = box.getBoundingSphere(new Sphere()).radius
  const distance = (radius / Math.sin((fovDegrees * Math.PI) / 360)) * 0.75
  const eye = center.clone().add(new Vector3(0, 0.25, 1).normalize().multiplyScalar(distance))
  controls.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z, false)
}

// Loads the glTF file, packs it for the shader, checks that the GPU can hold it, and then hands the packed scene to the
// path tracer. Both the load and the packing suspend, so the nearest `<Suspense>` shows the spinner until they finish.
// The path tracer lives outside this component, so a new scene reuses its compiled shaders and render targets.
function TracedScene({
  url,
  frame,
  onPacked,
  onProblem,
}: {
  url: string
  frame: boolean // whether to point the camera at the scene once it has loaded, for a scene with no starting view
  onPacked: (packed: PackedScene | null) => void
  onProblem: (problem: string | null) => void
}) {
  const gl = useThree(state => state.gl)
  const size = useThree(state => state.size)
  const dpr = useThree(state => state.viewport.dpr)
  const gltf = useGLTF(url)
  const packed = usePackedScene(gltf.scene)
  const controls = useThree(state => state.controls) as CameraControls | null

  useEffect(() => {
    if (frame && controls) {
      frameCamera(controls, gltf.scene, useAppStore.getState().cameraFov)
    }
  }, [frame, controls, gltf.scene])

  const problem = checkSceneLimits(
    gl.getContext() as WebGL2RenderingContext,
    packed,
    Math.floor(size.width * dpr),
    Math.floor(size.height * dpr),
  )
  useEffect(() => {
    onProblem(problem)
  }, [problem, onProblem])

  // The path tracer draws this scene while it is mounted and the GPU can hold it.
  useEffect(() => {
    if (problem) {
      return
    }
    onPacked(packed)
    return () => onPacked(null)
  }, [problem, packed, onPacked])

  return null
}

// Catches a failure to load, decode or pack the scene and reports it as a sentence for the view. Without it the error
// reaches the root of the page and unmounts the whole app. React has no hook for catching a render error, so this
// one is a class.
class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(`The scene could not be loaded: ${error.message}`)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

// The camera, its controls and the traced scene. `interactingRef` tells `PathTracer` when the user is dragging.
function Scene({
  onLoadingChange,
  onProblem,
}: {
  onLoadingChange: (loading: boolean) => void
  onProblem: (problem: string | null) => void
}) {
  const cameraFov = useAppStore(state => state.cameraFov)
  const scene = useAppStore(state => state.scene)
  const interactingRef = useRef(false)
  const [packed, setPacked] = useState<PackedScene | null>(null)

  // Puts the camera at the scene's starting view. drei makes a new controls instance when the default camera changes,
  // so this runs on the instance that is actually used, and again when the scene changes.
  const startAtScene = useCallback(
    (controls: CameraControls | null) => {
      if (scene.view) {
        controls?.setLookAt(...scene.view.eye, ...scene.view.target, false)
      }
    },
    [scene],
  )

  return (
    <>
      <PerspectiveCamera makeDefault fov={cameraFov} near={0.1} far={100} position={scene.view?.eye} />
      <CameraControls
        ref={startAtScene}
        makeDefault
        azimuthRotateSpeed={0.5}
        polarRotateSpeed={0.5}
        dollyDragInverted
        onControlStart={() => (interactingRef.current = true)}
        onControlEnd={() => (interactingRef.current = false)}
      />
      <PathTracer packed={packed} interactingRef={interactingRef} />
      {/* The key remounts the boundary, the spinner and the traced scene together, so a new scene starts clean. */}
      <SceneErrorBoundary key={scene.id} onError={onProblem}>
        <Suspense fallback={<LoadingNotice onLoadingChange={onLoadingChange} />}>
          <TracedScene url={scene.url} frame={!scene.view} onPacked={setPacked} onProblem={onProblem} />
        </Suspense>
      </SceneErrorBoundary>
    </>
  )
}

// A full-view sentence that says why there is no image, since a blank canvas gives no hint.
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="absolute inset-0 m-0 grid place-items-center p-6 text-center text-white">
      {children}
    </p>
  )
}

// The render view. It fills its parent, so the canvas size follows the window and the render restarts on a resize.
export function Viewport() {
  const [webgl2] = useState(supportsWebGL2)
  const [pixelRatio] = useState(getPixelRatio)
  const [loading, setLoading] = useState(false)
  const [gpuProblem, setGpuProblem] = useState<string | null>(null)
  const [sceneProblem, setSceneProblem] = useState<string | null>(null)
  const [contextLost, setContextLost] = useState(false)

  if (!webgl2) {
    return <Notice>This browser does not support WebGL 2. Try a recent version of Chrome, Firefox or Safari.</Notice>
  }

  let spinner: React.ReactNode = null
  if (loading) {
    spinner = (
      <div
        role="status"
        aria-label="Loading the scene"
        className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-4 border-(--accent-track) border-t-(--accent)"
      />
    )
  }

  let notice: React.ReactNode = null
  if (gpuProblem ?? sceneProblem) {
    notice = <Notice>{gpuProblem ?? sceneProblem}</Notice>
  } else if (contextLost) {
    notice = <Notice>The GPU reset the graphics context. The render resumes when it recovers.</Notice>
  }

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={pixelRatio}
        frameloop="always"
        resize={{ debounce: { scroll: 50, resize: 200 } }}
        gl={{ antialias: false, alpha: false, depth: false, stencil: false }}
        onCreated={({ gl }) => {
          setGpuProblem(checkGpuLimits(gl.getContext() as WebGL2RenderingContext))
          gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true))
          gl.domElement.addEventListener('webglcontextrestored', () => setContextLost(false))
        }}
      >
        {gpuProblem ? null : <Scene onLoadingChange={setLoading} onProblem={setSceneProblem} />}
      </Canvas>
      {spinner}
      {notice}
    </div>
  )
}
