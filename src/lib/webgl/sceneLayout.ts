/**
 * The packed texture layout shared by the scene packer and the path-tracing shader.
 *
 * These files write the textures using these sizes:
 * - `src/lib/webgl/bvhWorker.ts` writes the faces and the BVH nodes.
 * - `src/lib/webgl/packScene.ts` writes the materials and the lights.
 *
 * `src/shaders/pathTrace.frag.glsl` reads the texels back with the matching `*_INDEX` and class constants, so it must
 * change whenever a constant below changes. A mismatch renders wrong geometry or colors with no error.
 *
 * The scene is four float textures that point into each other by index. A BVH (bounding volume hierarchy) leaf names
 * a run of faces, each face names its material, and each light names the material it takes its emission from:
 *
 *   u_bvh_sampler                    u_face_sampler                   u_material_sampler
 *   ┌──────────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
 *   │ node: box min/max,   │firstFace│ face: normal, three  │ mat     │ material: color,     │
 *   │ left, right child,   ├────────►│ vertices, vertex     ├────────►│ color map slot,      │
 *   │ firstFace, faceCount │         │ normals and UVs, mat │ index   │ class, reflection,   │
 *   │                      │         │ index                │         │ gloss, refraction    │
 *   └──────────────────────┘         └──────────────────────┘         └──────────────────────┘
 *    one layer per mesh               one layer per mesh                         ▲
 *                                                                                │
 *                                    u_light_sampler                             │
 *                                    ┌──────────────────────┐  mat index         │
 *                                    │ light: three         ├────────────────────┘
 *                                    │ vertices, area total │
 *                                    └──────────────────────┘
 *
 * Integer fields are stored as floats plus 0.5, and the shader's `int()` truncates them toward zero. For a value of 0
 * or more, that lands on the intended integer even if the float is slightly off.
 */

// Must equal BVH_MAX_STACK_SIZE in src/shaders/pathTrace.frag.glsl. The ray and BVH traversal stack there is a
// fixed-size array with no bounds checking, so a tree deeper than this silently corrupts the render.
export const bvhMaxStackSize = 24

// A face is ten RGB texels of three floats each, so a face is 30 floats. The shader reads texel `t` of a face with
// the constant in the right column:
//
//   texel │ r                 g        b        │ shader constant
//   ──────┼─────────────────────────────────────┼─────────────────────
//     0   │ face normal x     y        z        │ FACE_NRM_INDEX
//     1   │ vertex 0 pos x    y        z        │ VERTEX_0_POS_INDEX
//     2   │ vertex 1 pos x    y        z        │ VERTEX_1_POS_INDEX
//     3   │ vertex 2 pos x    y        z        │ VERTEX_2_POS_INDEX
//     4   │ vertex 0 nrm x    y        z        │ VERTEX_0_NRM_INDEX
//     5   │ vertex 1 nrm x    y        z        │ VERTEX_1_NRM_INDEX
//     6   │ vertex 2 nrm x    y        z        │ VERTEX_2_NRM_INDEX
//     7   │ material index    unused   unused   │ FACE_MATERIAL_INDEX
//     8   │ vertex 0 u        v        vertex 1 u │ VERTEX_UV_0_INDEX
//     9   │ vertex 1 v        vertex 2 u        v │ VERTEX_UV_1_INDEX
//
// The UVs are the texture coordinates of the material's base color map, with the map's offset, repeat and rotation
// already applied. A face whose material has no map holds zeros there.
export const numTexelsPerFace = 10 // RGB texels. Must equal TEXELS_PER_FACE in src/shaders/pathTrace.frag.glsl.
export const numFloatsPerFace = 30

// Where vertex 0's position starts within a face's floats, texel 1. Vertices 1 and 2 follow it. The CPU readers of the
// face data use it, so it must move with the table above.
export const faceVertex0Offset = 3

// Each mesh's faces wrap onto rows of `facesPerRow` faces, which keeps the texture's height under a phone GPU's texture
// size limit. Must equal FACES_PER_ROW in src/shaders/pathTrace.frag.glsl.
//
// Face `f` of mesh `m` starts at x = (f % facesPerRow) * numTexelsPerFace, y = floor(f / facesPerRow), layer = m.
// With the current values, 64 faces of 10 texels, a row looks like this:
//
//          ◄─────────────── facesPerRow × numTexelsPerFace = 640 texels ───────────────►
//          x=0        x=10       x=20                 x=630
//         ┌──────────┬──────────┬──────────┬─────────┬──────────┐
//   y = 0 │ face 0   │ face 1   │ face 2   │   ...   │ face 63  │
//   y = 1 │ face 64  │ face 65  │ face 66  │   ...   │ face 127 │
//   ...   │   ...    │          │          │         │          │
//         └──────────┴──────────┴──────────┴─────────┴──────────┘
//
// Every layer has the same height, the largest mesh's face count rounded up to a whole row. A smaller mesh leaves the
// rest of its layer as zeros.
export const facesPerRow = 64

// A BVH node is three RGBA texels of four floats each, so a node is 12 floats. Node 0 is the root. A leaf's faces sit
// next to each other in the face texture, starting at `firstFace`.
//
//   texel │ r            g            b            a           │ shader constant
//   ──────┼──────────────────────────────────────────────────────┼───────────────────────────
//     0   │ box min x    y            z            1.0         │ BVH_NODE_MIN_BOUNDS_INDEX
//     1   │ box max x    y            z            1.0         │ BVH_NODE_MAX_BOUNDS_INDEX
//     2   │ left child   right child  firstFace    faceCount   │ BVH_NODE_PAYLOAD_INDEX
//
// An interior node has a `faceCount` of 0. `BvhNode` in `src/lib/webgl/bvhWorker.ts` stores a missing child as -2,
// which is written as -1.5. The shader's `int()` truncates that toward zero to the -1 it tests for. A sentinel of -1
// would be written as -0.5 and read as node 0, the root.
export const numTexelsPerBvhNode = 3 // RGBA texels. Must equal TEXELS_PER_BVH_NODE in src/shaders/pathTrace.frag.glsl.
export const numFloatsPerBvhNode = 12

// Where each texel above starts within a node's floats. The CPU readers of the BVH data use them, so they must move
// with the table above.
export const bvhNodeMinOffset = 0 // the box's min corner x, y and z
export const bvhNodeMaxOffset = 4 // the box's max corner x, y and z
export const bvhNodePayloadOffset = 8 // left child, right child, first face and face count, each stored plus 0.5

// BVH nodes wrap onto rows the same way faces do, one layer per mesh. Node `n` of mesh `m` starts at
// x = (n % bvhNodesPerRow) * numTexelsPerBvhNode, y = floor(n / bvhNodesPerRow), layer = m. Must equal
// BVH_NODES_PER_ROW in src/shaders/pathTrace.frag.glsl.
export const bvhNodesPerRow = 64

// A material is two RGBA texels of four floats each, so a material is eight floats. The material texture is
// `numTexelsPerMaterial` wide with one row per material, so material `i` is at y = i.
//
//   texel │ r          g                  b         a                │ shader constant
//   ──────┼────────────────────────────────────────────────────────────┼───────────────────────
//     0   │ color r    g                  b         color map slot   │ MATERIAL_COLOR_INDEX
//     1   │ class      reflection ratio   gloss     refractive index │ MATERIAL_ATTRIB_INDEX
//
// The color is the emitted light for an emissive material and the base color for any other. The color map slot picks
// which of the shader's `u_base_color_samplers` multiplies the base color, or is -1 when the material has no map. The
// shader tests for a slot of 0 or more before converting it to an integer, so -1 needs no extra 0.5.
export const numTexelsPerMaterial = 2 // RGBA texels
export const numFloatsPerMaterial = 8

// A light is one emissive face, three RGBA texels of four floats each, so a light is 12 floats. The shader reads the
// emission color from the face's material.
//
//   texel │ r            g    b    a                                         │ shader constant
//   ──────┼────────────────────────────────────────────────────────────────┼──────────────────────
//     0   │ vertex 0 x   y    z    total area of every light up to this one │ LIGHT_VERTEX_0_INDEX
//     1   │ vertex 1 x   y    z    unused                                   │ LIGHT_VERTEX_1_INDEX
//     2   │ vertex 2 x   y    z    material index                           │ LIGHT_VERTEX_2_INDEX
export const numTexelsPerLight = 3 // RGBA texels. Must equal TEXELS_PER_LIGHT in src/shaders/pathTrace.frag.glsl.
export const numFloatsPerLight = 12

// Lights wrap onto rows the same way faces do, in a single 2D texture. Light `l` starts at
// x = (l % lightsPerRow) * numTexelsPerLight, y = floor(l / lightsPerRow). Must equal LIGHTS_PER_ROW in
// src/shaders/pathTrace.frag.glsl.
export const lightsPerRow = 64

// The most base color textures a scene may use, where a texture is one image with one set of wrap modes and filter.
// Each one is bound to its own texture unit, and WebGL 2 promises
// only 16 units to a fragment shader, of which the path tracer's scene textures take 5. Must equal MAX_BASE_COLOR_MAPS
// in src/shaders/pathTrace.frag.glsl.
export const maxBaseColorMaps = 8

// The material classes the shader branches on. The values must equal the `*_MATERIAL` constants in the shader.
export const EMISSIVE_MATERIAL = 0
export const REFLECTIVE_MATERIAL = 1
export const DIELECTRIC_MATERIAL = 2
