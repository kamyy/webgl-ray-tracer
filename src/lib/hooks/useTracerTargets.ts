/**
 * Creates the render targets and the random texture that the path tracer draws with, at the size of the view.
 *
 * The accumulation target holds the running sum of samples. The completed target holds a copy of that sum made each
 * time a sample finishes, and the display pass reads it. The random texture holds one generator seed per pixel. All
 * three are rebuilt when the view size changes, and the render then starts over.
 */
import { useFBO } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { FloatType, NearestFilter, RGBAFormat } from 'three'
import { createRandomTexture } from '../webgl/randomTexture'

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

export function useTracerTargets(width: number, height: number) {
  const accumulation = useFBO(width, height, renderTargetSettings)
  const completed = useFBO(width, height, renderTargetSettings)
  const randomTexture = useMemo(() => createRandomTexture(width, height), [width, height])

  // Free GPU memory when the texture is replaced or the component unmounts.
  useEffect(() => {
    return () => {
      randomTexture.dispose()
    }
  }, [randomTexture])

  return { accumulation, completed, randomTexture }
}
