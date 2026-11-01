/**
 * The ray-traced view: a React Three Fiber canvas with a camera, orbit controls and the path tracer.
 *
 * `Canvas` owns the WebGL context and the render loop. The camera and `CameraControls` handle mouse and touch input,
 * and `PathTracer` draws each progressive pass. The glTF scene loads under `<Suspense>`, so a spinner shows until the
 * file is decoded and its BVH is built. When the GPU cannot run the tracer, or loses its context, the view says so in
 * words instead of staying blank.
 */
import { CameraControls, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Component, RefObject, Suspense, useEffect, useRef, useState } from 'react'
import { usePackedScene } from '../lib/hooks/usePackedScene'
import { useAppStore } from '../lib/store/appStore'
import { checkGpuLimits, checkSceneLimits, supportsWebGL2 } from '../lib/webgl/checkGpuLimits'
import { PathTracer } from './pathTracer'

useGLTF.setDecoderPath('/draco/')

interface SceneErrorBoundaryProps {
  onError: (problem: string) => void
  children: React.ReactNode
}

// Starts in front of the room, looking straight along -z at the objects. drei makes a new controls instance when
// the default camera changes, so this runs on the instance that is actually used.
function startInFrontOfRoom(controls: CameraControls | null) {
  controls?.setLookAt(0, 2, 10, 0, 2, 0, false)
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

// Loads the glTF file, packs it for the shader, checks that the GPU can hold it, and then runs the path tracer. Both
// the load and the packing suspend, so the nearest `<Suspense>` shows the spinner until they finish.
function TracedScene({
  interactingRef,
  onProblem,
}: {
  interactingRef: RefObject<boolean>
  onProblem: (problem: string | null) => void
}) {
  const gl = useThree(state => state.gl)
  const size = useThree(state => state.size)
  const dpr = useThree(state => state.viewport.dpr)
  const gltf = useGLTF('/suzanne.glb')
  const packed = usePackedScene(gltf.scene)

  const problem = checkSceneLimits(
    gl.getContext() as WebGL2RenderingContext,
    packed,
    Math.floor(size.width * dpr),
    Math.floor(size.height * dpr),
  )
  useEffect(() => {
    onProblem(problem)
  }, [problem, onProblem])

  return problem ? null : <PathTracer packed={packed} interactingRef={interactingRef} />
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
  const interactingRef = useRef(false)

  return (
    <>
      <PerspectiveCamera makeDefault fov={cameraFov} near={0.1} far={100} position={[0, 2, 10]} />
      <CameraControls
        ref={startInFrontOfRoom}
        makeDefault
        azimuthRotateSpeed={0.5}
        polarRotateSpeed={0.5}
        onControlStart={() => (interactingRef.current = true)}
        onControlEnd={() => (interactingRef.current = false)}
      />
      <SceneErrorBoundary onError={onProblem}>
        <Suspense fallback={<LoadingNotice onLoadingChange={onLoadingChange} />}>
          <TracedScene interactingRef={interactingRef} onProblem={onProblem} />
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
      <div className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-[16px] border-t-[blue] border-r-[green] border-b-[red] border-l-[yellow]" />
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
