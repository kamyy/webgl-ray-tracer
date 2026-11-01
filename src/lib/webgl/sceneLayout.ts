/**
 * The packed texture layout shared by the scene packer and the path-tracing shader.
 *
 * The BVH worker writes faces and BVH nodes into float arrays using these sizes, `packScene` writes the materials, and
 * `src/shaders/pathTrace.frag.glsl` reads the texels back with the matching `*_INDEX` and class constants. A change
 * here needs the same change in that shader, and a mismatch renders wrong geometry or colors with no error.
 */

// Must equal BVH_MAX_STACK_SIZE in src/shaders/pathTrace.frag.glsl. The ray and BVH traversal stack there is a
// fixed-size array with no bounds checking, so a tree deeper than this silently corrupts the render.
export const bvhMaxStackSize = 24

// A face is eight texels: the face normal, three vertex positions, three vertex normals and the material index. Each
// texel is three floats, so a face is 24 floats.
export const numTexelsPerFace = 8 // RGB texels
export const numFloatsPerFace = 24

// A BVH node is three texels: the box's minimum corner, its maximum corner, and the two child indices with up to two
// face indices. Each texel is four floats, so a node is 12 floats.
export const numTexelsPerBvhNode = 3 // RGBA texels
export const numFloatsPerBvhNode = 12

// A material is two texels: the albedo color, then the class, reflection ratio, gloss and refractive index. Each texel
// is four floats, so a material is eight floats.
export const numTexelsPerMaterial = 2 // RGBA texels
export const numFloatsPerMaterial = 8

// The material classes the shader branches on. The values must equal the `*_MATERIAL` constants in the shader.
export const EMISSIVE_MATERIAL = 0
export const REFLECTIVE_MATERIAL = 1
export const DIELECTRIC_MATERIAL = 2
