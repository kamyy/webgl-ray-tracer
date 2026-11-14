/**
 * Builds the two map arrays, the textures that hold every base color map and every normal map as one layer each.
 *
 * The path-tracing shader reads each kind of map through one `sampler2DArray`, so every layer of an array must have
 * one size. Each image is uploaded at its own size into a scratch texture, and the GPU stretches it into its layer with
 * a framebuffer blit. The CPU never touches the pixels. That keeps transparent texels' colors, which a 2D canvas would
 * lose to premultiplied alpha, and it leaves no copy of the pixels in memory beyond the images `GLTFLoader` holds.
 *
 * The color array is sRGB, so the GPU converts color maps to linear light on every read. The normal array is plain
 * RGBA, because a normal map holds directions, and filtering must blend the stored values.
 *
 * three.js cannot fill an array texture's layers from images, so the textures are made with raw WebGL calls and handed
 * to three.js as `ExternalTexture`s. A lost context deletes them, so they must be built again once the context is back.
 */
import { ExternalTexture, WebGLRenderer } from 'three'
import type { MapArray, PackedScene } from './packScene'

/** The map arrays of one scene, which the tracer keeps on the GPU while the scene is drawn. */
export interface MapTextures {
  packed: PackedScene // the scene the arrays were built for
  color: ExternalTexture
  normal: ExternalTexture
}

// Throws when WebGL reports that it ran out of memory, which it does through `getError` instead of an exception.
function checkMemory(context: WebGL2RenderingContext, what: string) {
  if (context.getError() === context.OUT_OF_MEMORY) {
    throw new Error(`the GPU ran out of memory for the ${what}. Use fewer or smaller textures.`)
  }
}

// Makes one array and blits each image into its layer, in the given internal format.
function createMapArray(context: WebGL2RenderingContext, maps: MapArray, format: GLenum): WebGLTexture {
  const depth = Math.max(1, maps.layers.length) // an array without images gets one blank layer for the sampler

  const array = context.createTexture()
  context.bindTexture(context.TEXTURE_2D_ARRAY, array)
  context.texStorage3D(context.TEXTURE_2D_ARRAY, 1, format, maps.size, maps.size, depth)
  checkMemory(context, 'scene textures')

  // Every layer shares these settings. `sampleMap` in the shader applies each map's own wrap mode and nearest
  // filtering.
  context.texParameteri(context.TEXTURE_2D_ARRAY, context.TEXTURE_MIN_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D_ARRAY, context.TEXTURE_MAG_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D_ARRAY, context.TEXTURE_WRAP_S, context.REPEAT)
  context.texParameteri(context.TEXTURE_2D_ARRAY, context.TEXTURE_WRAP_T, context.REPEAT)

  const scratch = context.createTexture()
  const readBuffer = context.createFramebuffer()
  const drawBuffer = context.createFramebuffer()
  context.bindFramebuffer(context.READ_FRAMEBUFFER, readBuffer)
  context.bindFramebuffer(context.DRAW_FRAMEBUFFER, drawBuffer)
  context.bindTexture(context.TEXTURE_2D, scratch)

  try {
    maps.layers.forEach((layer, index) => {
      const { width, height } = layer
      context.texImage2D(context.TEXTURE_2D, 0, format, context.RGBA, context.UNSIGNED_BYTE, layer.image)
      checkMemory(context, 'scene textures')
      context.framebufferTexture2D(context.READ_FRAMEBUFFER, context.COLOR_ATTACHMENT0, context.TEXTURE_2D, scratch, 0)
      context.framebufferTextureLayer(context.DRAW_FRAMEBUFFER, context.COLOR_ATTACHMENT0, array, 0, index)
      if (context.checkFramebufferStatus(context.READ_FRAMEBUFFER) !== context.FRAMEBUFFER_COMPLETE) {
        throw new Error(`the GPU could not read a ${width} by ${height} pixel texture.`)
      }

      // A nearest-filtered map is stretched with nearest filtering too, so its hard-edged texels stay hard.
      const filter = layer.nearest ? context.NEAREST : context.LINEAR
      context.blitFramebuffer(0, 0, width, height, 0, 0, maps.size, maps.size, context.COLOR_BUFFER_BIT, filter)
    })
  } catch (error) {
    context.deleteTexture(array)
    throw error
  } finally {
    context.deleteFramebuffer(readBuffer)
    context.deleteFramebuffer(drawBuffer)
    context.deleteTexture(scratch)
  }

  return array
}

/**
 * Makes both map arrays for `packed`. Throws with a sentence for the view when the GPU cannot hold or read the images.
 */
export function createMapTextures(gl: WebGLRenderer, packed: PackedScene): MapTextures {
  const context = gl.getContext() as WebGL2RenderingContext

  // three.js leaves state such as the scissor test from its last draw, and a scissor would clip the blits. Resetting
  // puts every setting back to WebGL's defaults, and three.js forgets what it had bound.
  gl.resetState()

  // The images must arrive exactly as decoded. `GLTFLoader` keeps them unflipped, with straight alpha.
  context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false)
  context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  context.pixelStorei(context.UNPACK_COLORSPACE_CONVERSION_WEBGL, context.NONE)

  try {
    const color = createMapArray(context, packed.colorMaps, context.SRGB8_ALPHA8)
    let normal: WebGLTexture
    try {
      normal = createMapArray(context, packed.normalMaps, context.RGBA8)
    } catch (error) {
      context.deleteTexture(color)
      throw error
    }

    return { packed, color: new ExternalTexture(color), normal: new ExternalTexture(normal) }
  } finally {
    // The calls above changed bindings that three.js had cached.
    gl.resetState()
  }
}

/**
 * Frees both map arrays' GPU memory. `ExternalTexture.dispose` leaves a WebGL texture alone, because three.js did not
 * make it.
 */
export function disposeMapTextures(gl: WebGLRenderer, textures: MapTextures) {
  const context = gl.getContext() as WebGL2RenderingContext
  for (const texture of [textures.color, textures.normal]) {
    context.deleteTexture(texture.sourceTexture as WebGLTexture)
    texture.dispose()
  }
}
