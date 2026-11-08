/**
 * Runs the progressive path tracer inside the React Three Fiber canvas.
 *
 * The component draws nothing itself. It sizes the render targets to the view, builds the objects the tracer draws
 * with, restarts the render when the view size, the scene or a setting changes, and starts the tracing loop. The
 * drawing itself is in `src/lib/webgl/tracer.ts`.
 */
import { useThree } from '@react-three/fiber'
import { RefObject, useEffect, useMemo, useState } from 'react'
import { PerspectiveCamera } from 'three'
import { useShaderTriangles } from '../lib/hooks/useShaderTriangles'
import { useTracerTargets } from '../lib/hooks/useTracerTargets'
import { useTracingLoop } from '../lib/hooks/useTracingLoop'
import { useAppStore } from '../lib/store/appStore'
import { PackedScene } from '../lib/webgl/packScene'
import { registerScreenshot } from '../lib/webgl/screenshot'
import {
  configureRenderer,
  createTracerState,
  downloadScreenshot,
  renderReset,
  TracerInputs,
  watchSettings,
} from '../lib/webgl/tracer'

interface PathTracerProps {
  packed: PackedScene | null // null while no scene is ready, and nothing is drawn
  interactingRef: RefObject<boolean> // true while the user is dragging the camera
}

export function PathTracer({ packed, interactingRef }: PathTracerProps) {
  const gl = useThree(state => state.gl)
  const camera = useThree(state => state.camera) as PerspectiveCamera
  const size = useThree(state => state.size)
  const dpr = useThree(state => state.viewport.dpr)
  const width = Math.floor(size.width * dpr) // the drawing buffer is size * dpr, and so are the render targets
  const height = Math.floor(size.height * dpr)

  const { accumulation, completed, randomTexture } = useTracerTargets(width, height)
  const { pathTrace, display } = useShaderTriangles()
  const [state] = useState(createTracerState)

  // The objects the tracing loop draws with. It is null while no scene is ready.
  const inputs = useMemo<TracerInputs | null>(
    () =>
      packed ? { gl, camera, width, height, packed, accumulation, completed, randomTexture, pathTrace, display } : null,
    [gl, camera, width, height, packed, accumulation, completed, randomTexture, pathTrace, display],
  )

  useEffect(() => {
    configureRenderer(gl)
  }, [gl])

  // A new view size means new render targets, which start empty, and a new scene means new geometry, so accumulation
  // starts over. The readout shows the size of the drawing buffer, which is also the size of a saved screenshot.
  useEffect(() => {
    renderReset(state)
    useAppStore.getState().setResolution(width, height)
  }, [state, width, height, packed])

  useEffect(() => watchSettings(state), [state])

  // A lost context takes the accumulated image with it, so start over once it is back.
  useEffect(() => {
    const canvas = gl.domElement
    const restart = () => renderReset(state)
    canvas.addEventListener('webglcontextrestored', restart)
    return () => canvas.removeEventListener('webglcontextrestored', restart)
  }, [gl, state])

  // The heads-up display saves the image through this registration.
  useEffect(() => registerScreenshot(() => downloadScreenshot(gl, display, completed)), [gl, display, completed])

  // The packed textures leave the GPU when the scene is replaced. A bundled scene keeps its packed data in memory, so
  // choosing it again uploads the textures again.
  useEffect(() => {
    return () => {
      packed?.facesTexture.dispose()
      packed?.bvhTexture.dispose()
      packed?.materialsTexture.dispose()
      packed?.lightsTexture.dispose()
    }
  }, [packed])

  useTracingLoop(state, inputs, interactingRef)

  return null
}
