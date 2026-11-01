/**
 * The packed texture layout shared by the scene packer and the path-tracing shader.
 *
 * The BVH worker writes faces and BVH nodes into float arrays using these sizes, `Scene` writes the materials, and
 * `src/shaders/pathTrace.frag.glsl` reads the texels back with the matching `*_INDEX` and class constants. A change
 * here needs the same change in that shader, and a mismatch renders wrong geometry or colors with no error.
 */

// must match BVH_MAX_STACK_SIZE in src/shaders/pathTrace.frag.glsl - the ray/BVH traversal stack there is a
// fixed-size array with no bounds checking, so a tree deeper than this will silently corrupt rendering
export const bvhMaxStackSize = 16

export const numTexelsPerFace = 8 // RGB texels
export const numFloatsPerFace = 24

export const numTexelsPerBvhNode = 3 // RGBA texels
export const numFloatsPerBvhNode = 12

export const numTexelsPerMaterial = 2 // RGBA texels
export const numFloatsPerMaterial = 8

export const EMISSIVE_MATERIAL = 0
export const REFLECTIVE_MATERIAL = 1
export const DIELECTRIC_MATERIAL = 2
