/**
 * The shader program that shows the accumulated image on the canvas.
 *
 * The path-tracing pass keeps a running sum of every sample and counts the samples in the alpha channel, so this pass
 * divides the sum by that count to get the average color, applies the exposure and contrast settings, tone maps it and
 * encodes it to sRGB for the screen. Keeping that work here leaves the accumulation buffer a plain linear sum, so the
 * exposure and contrast can change without tracing any sample again.
 */
import { GLSL3, RawShaderMaterial, Texture } from 'three'
import fragmentShader from '../../shaders/display.frag.glsl?raw'
import vertexShader from '../../shaders/display.vert.glsl?raw'

export function createDisplayMaterial(): RawShaderMaterial {
  return new RawShaderMaterial({
    glslVersion: GLSL3, // three.js writes the #version line, so the GLSL files have none
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      u_color_sampler: { value: null as Texture | null },
      u_exposure: { value: 1 }, // set from the store before every draw
      u_contrast: { value: 1 }, // set from the store before every draw
    },
  })
}
