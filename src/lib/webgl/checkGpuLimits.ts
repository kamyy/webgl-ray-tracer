/**
 * Checks that the GPU can run the path tracer and that it can hold the loaded scene.
 *
 * The shader needs float render targets, additive float blending and enough texture units, and the scene needs
 * textures as tall, as wide and as deep as its biggest mesh and its object count. Phone GPUs often report much lower limits
 * than desktop ones, so the scene checks compare the real sizes with the real limits. Each check returns a sentence
 * for the person looking at a blank view, or null when everything fits.
 */
import { PackedScene } from './packScene'

// The path-tracing shader's samplers: random seeds, faces, BVH nodes, materials, lights and the two map arrays.
const numSamplerTextureUnits = 7

export function supportsWebGL2(): boolean {
  return document.createElement('canvas').getContext('webgl2') !== null
}

export function checkGpuLimits(gl: WebGL2RenderingContext): string | null {
  if (!gl.getExtension('EXT_color_buffer_float')) {
    return 'This GPU or browser cannot render to floating-point textures (EXT_color_buffer_float), which the ray tracer needs.'
  }
  if (!gl.getExtension('EXT_float_blend')) {
    return 'This GPU or browser cannot blend floating-point textures (EXT_float_blend), which the ray tracer needs.'
  }

  const textureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
  if (textureUnits < numSamplerTextureUnits) {
    return `This GPU supports ${textureUnits} texture units in a shader, and the ray tracer needs ${numSamplerTextureUnits}.`
  }

  return null
}

// The longest side of any base color or normal map image in the scene, before it is stretched into its layer.
function largestImageSide(packed: PackedScene): number {
  const layers = [...packed.colorMaps.layers, ...packed.normalMaps.layers]
  return Math.max(0, ...layers.map(layer => Math.max(layer.width, layer.height)))
}

export function checkSceneLimits(
  gl: WebGL2RenderingContext,
  packed: PackedScene,
  width: number,
  height: number,
): string | null {
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  const maxArrayLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)
  const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)
  const widest = Math.max(
    packed.facesTexture.image.width,
    packed.bvhTexture.image.width,
    packed.materialsTexture.image.width,
    packed.lightsTexture.image.width,
    packed.colorMaps.size,
    packed.normalMaps.size,
  )
  const tallest = Math.max(
    packed.facesTexture.image.height,
    packed.bvhTexture.image.height,
    packed.materialsTexture.image.height,
    packed.lightsTexture.image.height,
    packed.colorMaps.size,
    packed.normalMaps.size,
    height,
  )

  if (tallest > maxTextureSize) {
    return `This scene needs a texture ${tallest} pixels tall, and this GPU allows ${maxTextureSize}.`
  }
  if (widest > maxTextureSize) {
    return `This scene needs a texture ${widest} pixels wide, and this GPU allows ${maxTextureSize}.`
  }
  if (packed.numObjects > maxArrayLayers) {
    return `This scene has ${packed.numObjects} meshes, and this GPU allows ${maxArrayLayers} texture layers.`
  }
  const mapImages = Math.max(packed.colorMaps.layers.length, packed.normalMaps.layers.length)
  if (mapImages > maxArrayLayers) {
    return `This scene has ${mapImages} texture images of one kind, and this GPU allows ${maxArrayLayers} texture layers.`
  }
  // Each image is uploaded at its own size before the GPU shrinks it into its layer.
  const largestImage = largestImageSide(packed)
  if (largestImage > maxTextureSize) {
    return `This scene has a texture image ${largestImage} pixels across, and this GPU allows ${maxTextureSize}.`
  }
  if (Math.max(width, height) > maxRenderbufferSize) {
    return `The view is ${width} by ${height} pixels, and this GPU allows renders up to ${maxRenderbufferSize}.`
  }

  return null
}
