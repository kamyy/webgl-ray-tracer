/**
 * Creates the path-trace shader triangle and the display shader triangle, and frees their materials on unmount.
 *
 * The path-trace shader adds a sample to the running sum, and the display shader draws the average to the canvas. Each
 * is a shader material on a triangle that covers the target. A material holds a compiled GPU program, so it is made
 * once and disposed when the component that owns it unmounts.
 */
import { useEffect, useMemo } from 'react'
import { createDisplayMaterial } from '../webgl/displayMaterial'
import { createPathTraceMaterial } from '../webgl/pathTraceMaterial'
import { createShaderTriangle } from '../webgl/shaderTriangle'

export function useShaderTriangles() {
  const pathTrace = useMemo(() => createShaderTriangle(createPathTraceMaterial()), [])
  const display = useMemo(() => createShaderTriangle(createDisplayMaterial()), [])

  useEffect(() => {
    return () => {
      pathTrace.material.dispose()
      display.material.dispose()
    }
  }, [pathTrace, display])

  return { pathTrace, display }
}
