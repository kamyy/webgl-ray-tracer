/**
 * The shader program that path-traces one sample per pixel.
 *
 * It renders into the accumulation target with additive blending, so each draw adds one sample per pixel to the
 * running sum, and the alpha channel counts the samples. It reads the scene from the packed face, BVH and material
 * textures. A raw shader material is used because the GLSL declares its own inputs and outputs, and three.js would
 * otherwise add its own and clash with them.
 */
import { AddEquation, CustomBlending, GLSL3, Matrix4, OneFactor, RawShaderMaterial, Texture, Vector3 } from 'three'
import fragmentShader from '../../shaders/pathTrace.frag.glsl?raw'
import vertexShader from '../../shaders/pathTrace.vert.glsl?raw'

export function createPathTraceMaterial(): RawShaderMaterial {
  return new RawShaderMaterial({
    glslVersion: GLSL3, // three.js writes the #version line, so the GLSL files have none
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    // Add each sample to the render target's contents instead of replacing them.
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneFactor,
    uniforms: {
      u_half_wd: { value: 0 },
      u_half_ht: { value: 0 },
      u_num_objects: { value: 0 },
      u_render_pass: { value: 0 },
      u_num_bounces: { value: 0 },
      u_shading_method: { value: 0 },
      u_eye_to_image: { value: 0 },
      u_eye_position: { value: new Vector3() },
      u_eye_to_world: { value: new Matrix4() },
      u_random_sampler: { value: null as Texture | null },
      u_face_sampler: { value: null as Texture | null },
      u_bvh_sampler: { value: null as Texture | null },
      u_material_sampler: { value: null as Texture | null },
    },
  })
}
