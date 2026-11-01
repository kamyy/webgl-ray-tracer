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
export const numTexelsPerFace = 8 // RGB texels. Must equal TEXELS_PER_FACE in src/shaders/pathTrace.frag.glsl.
export const numFloatsPerFace = 24

// Each object's faces wrap onto rows of this many faces. A row is `facesPerRow * numTexelsPerFace` texels wide, so the
// texture's height is the face count divided by this, which keeps it under a phone GPU's texture size limit. Must
// equal FACES_PER_ROW in src/shaders/pathTrace.frag.glsl.
export const facesPerRow = 64

// A BVH node is three texels: the box's minimum corner, its maximum corner, and the two child indices with up to two
// face indices. Each texel is four floats, so a node is 12 floats.
export const numTexelsPerBvhNode = 3 // RGBA texels. Must equal TEXELS_PER_BVH_NODE in src/shaders/pathTrace.frag.glsl.
export const numFloatsPerBvhNode = 12

// BVH nodes wrap onto rows the same way. Must equal BVH_NODES_PER_ROW in src/shaders/pathTrace.frag.glsl.
export const bvhNodesPerRow = 64

// A material is two texels: the albedo color, then the class, reflection ratio, gloss and refractive index. Each texel
// is four floats, so a material is eight floats.
export const numTexelsPerMaterial = 2 // RGBA texels
export const numFloatsPerMaterial = 8

// The material classes the shader branches on. The values must equal the `*_MATERIAL` constants in the shader.
export const EMISSIVE_MATERIAL = 0
export const REFLECTIVE_MATERIAL = 1
export const DIELECTRIC_MATERIAL = 2
