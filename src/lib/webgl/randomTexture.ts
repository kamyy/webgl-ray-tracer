/**
 * Creates the texture of random generator seeds, one per pixel.
 *
 * The path-tracing shader draws random numbers to pick each ray's jitter and bounce, so every pixel needs its own
 * generator state. Four random 32-bit integers per pixel seed that generator, and the shader then perturbs them by
 * the pass number so every pass draws different samples.
 */
import { DataTexture, NearestFilter, RGBAIntegerFormat, UnsignedIntType } from 'three'

export function createRandomTexture(width: number, height: number): DataTexture {
  const data = new Uint32Array(width * height * 4) // require 4 random values for each fragment to seed
  for (let i = 0; i < data.length; ++i) {
    // tausworthe/LCG random number generator
    let n = Math.random() * 4294967295
    while (n < 129) {
      // tausworthe/LCG random number generator seed must be 129 or larger
      n = Math.random() * 4294967295
    }
    data[i] = n
  }

  const texture = new DataTexture(data, width, height, RGBAIntegerFormat, UnsignedIntType)
  texture.internalFormat = 'RGBA32UI'
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}
