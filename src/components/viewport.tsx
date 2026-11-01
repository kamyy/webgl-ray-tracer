/**
 * The ray-traced view: a React Three Fiber canvas with a camera, orbit controls and the path tracer.
 *
 * `Canvas` owns the WebGL context and the render loop. The camera and `CameraControls` handle mouse and touch input,
 * and `PathTracer` draws each progressive pass. The glTF scene loads under `<Suspense>`, so a spinner shows until the
 * file is decoded and its BVH is built.
 */
import { CameraControls, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { RefObject, Suspense, useEffect, useRef, useState } from 'react'
import { usePackedScene } from '../lib/hooks/usePackedScene'
import { useAppStore } from '../lib/store/appStore'
import { PathTracer } from './pathTracer'

useGLTF.setDecoderPath('/draco/')

function checkGpuLimits(gl: WebGL2RenderingContext) {
  if (!gl.getExtension('EXT_color_buffer_float')) {
    console.log('EXT_color_buffer_float not supported')
    return false
  }
  if (!gl.getExtension('EXT_float_blend')) {
    console.log('EXT_float_blend not supported')
    return false
  }

  const MAX_ARRAY_TEXTURE_LAYERS = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)
  const MAX_TEXTURE_IMAGE_UNITS = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
  const MAX_RENDERBUFFER_SIZE = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)
  const MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE)

  console.log(`MAX_ARRAY_TEXTURE_LAYERS = ${MAX_ARRAY_TEXTURE_LAYERS}`)
  console.log(`MAX_TEXTURE_IMAGE_UNITS = ${MAX_TEXTURE_IMAGE_UNITS}`)
  console.log(`MAX_RENDERBUFFER_SIZE = ${MAX_RENDERBUFFER_SIZE}`)
  console.log(`MAX_TEXTURE_SIZE = ${MAX_TEXTURE_SIZE}`)

  if (
    MAX_ARRAY_TEXTURE_LAYERS < 2048 ||
    MAX_TEXTURE_IMAGE_UNITS < 16 ||
    MAX_RENDERBUFFER_SIZE < 16384 ||
    MAX_TEXTURE_SIZE < 16384
  ) {
    return false
  }

  return true
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

function TracedScene({ interactingRef }: { interactingRef: RefObject<boolean> }) {
  const gltf = useGLTF('/suzanne.glb')
  const packed = usePackedScene(gltf.scene)

  return <PathTracer packed={packed} interactingRef={interactingRef} />
}

function Scene({ onLoadingChange }: { onLoadingChange: (loading: boolean) => void }) {
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
      <Suspense fallback={<LoadingNotice onLoadingChange={onLoadingChange} />}>
        <TracedScene interactingRef={interactingRef} />
      </Suspense>
    </>
  )
}

export function Viewport() {
  const [gpuOk, setGpuOk] = useState(true)
  const [loading, setLoading] = useState(false)

  let spinner: React.ReactNode = null
  if (loading) {
    spinner = (
      <div className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-[16px] border-t-[blue] border-r-[green] border-b-[red] border-l-[yellow]" />
    )
  }

  return (
    <div className="relative" style={{ width: 1280, height: 720 }}>
      <Canvas
        dpr={1}
        frameloop="always"
        gl={{ antialias: false, alpha: false, depth: false, stencil: false }}
        onCreated={({ gl }) => setGpuOk(checkGpuLimits(gl.getContext() as WebGL2RenderingContext))}
      >
        {gpuOk ? <Scene onLoadingChange={setLoading} /> : null}
      </Canvas>
      {spinner}
    </div>
  )
}
