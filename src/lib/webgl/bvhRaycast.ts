/**
 * Finds the triangle nearest the camera along a ray, by walking the scene's BVH on the CPU.
 *
 * Finding the surface under a tap by testing every triangle would take too long in a large scene, so this walks the
 * same bounding volume hierarchy (BVH) the path tracer walks on the GPU, read from the BVH and face texture data that
 * `packScene` keeps on the CPU. A box farther away than the nearest hit so far is skipped along with everything inside
 * it, so only the few triangles near the ray are tested. Every mesh's tree is walked, and the hit nearest the ray's
 * origin wins. The triangle test is the shader's: it counts both sides of a triangle, and it treats a ray as parallel
 * by the same angle, whatever the triangle's size.
 */
import { Ray, Vector3 } from 'three'
import type { PackedScene } from './packScene'
import {
  bvhNodeMaxOffset,
  bvhNodeMinOffset,
  bvhNodePayloadOffset,
  faceVertex0Offset,
  numFloatsPerBvhNode,
  numFloatsPerFace,
} from './sceneLayout'

// A ray within this cosine of a triangle's plane, about 0.06°, counts as parallel to it. The value equals EPSILON in
// `src/shaders/pathTrace.frag.glsl`, which the shader's test uses the same way, so the two find the same triangles.
const parallelCosine = 0.001

// A hit closer than this to the ray's origin is not counted. It also stands in for a zero component of the ray's
// direction, so the box test never divides by zero.
const tiny = 1e-7

/** The nearest triangle a ray hits, with the leaf box that holds it and its world-space corners. */
export interface BvhHit {
  distance: number // along the ray, from its origin
  point: Vector3
  mesh: number // the mesh's layer in the packed textures
  leaf: number // the leaf node that holds the triangle, within the mesh's tree
  face: number // the triangle's position among the mesh's faces in leaf order, as packed
  corners: [Vector3, Vector3, Vector3]
}

// The near distance at which the ray enters the node's box, or Infinity when it misses. The slab test clips the ray
// against each axis's pair of planes in turn.
function enterBox(nodes: Float32Array, base: number, origin: Vector3, inverse: Vector3): number {
  let near = 0
  let far = Infinity
  for (let axis = 0; axis < 3; ++axis) {
    const o = origin.getComponent(axis)
    const inv = inverse.getComponent(axis)
    let t0 = (nodes[base + bvhNodeMinOffset + axis] - o) * inv
    let t1 = (nodes[base + bvhNodeMaxOffset + axis] - o) * inv
    if (t0 > t1) {
      ;[t0, t1] = [t1, t0]
    }
    near = Math.max(near, t0)
    far = Math.min(far, t1)
    if (near > far) {
      return Infinity
    }
  }
  return near
}

// The distance at which the ray hits the triangle starting at `base` in the face data, or Infinity when it misses.
// This is the Möller–Trumbore test the shader uses.
function hitTriangle(faces: Float32Array, base: number, ray: Ray): number {
  const p0 = base + faceVertex0Offset
  const e1x = faces[p0 + 3] - faces[p0]
  const e1y = faces[p0 + 4] - faces[p0 + 1]
  const e1z = faces[p0 + 5] - faces[p0 + 2]
  const e2x = faces[p0 + 6] - faces[p0]
  const e2y = faces[p0 + 7] - faces[p0 + 1]
  const e2z = faces[p0 + 8] - faces[p0 + 2]
  const { x: dx, y: dy, z: dz } = ray.direction

  // `det` is the cosine between the ray and the triangle's normal, times twice the triangle's area, so the parallel
  // test compares it with the area rather than with a fixed number.
  const px = dy * e2z - dz * e2y
  const py = dz * e2x - dx * e2z
  const pz = dx * e2y - dy * e2x
  const det = e1x * px + e1y * py + e1z * pz
  const twiceArea = Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x)
  if (Math.abs(det) <= parallelCosine * twiceArea) {
    return Infinity
  }

  const inv = 1 / det
  const tx = ray.origin.x - faces[p0]
  const ty = ray.origin.y - faces[p0 + 1]
  const tz = ray.origin.z - faces[p0 + 2]
  const u = (tx * px + ty * py + tz * pz) * inv
  if (u < 0 || u > 1) {
    return Infinity
  }

  const qx = ty * e1z - tz * e1y
  const qy = tz * e1x - tx * e1z
  const qz = tx * e1y - ty * e1x
  const v = (dx * qx + dy * qy + dz * qz) * inv
  if (v < 0 || u + v > 1) {
    return Infinity
  }

  const t = (e2x * qx + e2y * qy + e2z * qz) * inv
  return t > tiny ? t : Infinity
}

// The three corners of the face starting at `base` in the face data.
function corners(faces: Float32Array, base: number): [Vector3, Vector3, Vector3] {
  const p0 = base + faceVertex0Offset
  return [
    new Vector3(faces[p0], faces[p0 + 1], faces[p0 + 2]),
    new Vector3(faces[p0 + 3], faces[p0 + 4], faces[p0 + 5]),
    new Vector3(faces[p0 + 6], faces[p0 + 7], faces[p0 + 8]),
  ]
}

/** Returns the triangle nearest the ray's origin across every mesh, or null when the ray hits nothing. */
export function raycastBvh(packed: PackedScene, ray: Ray): BvhHit | null {
  const nodes = packed.bvhTexture.image.data as Float32Array
  const faces = packed.facesTexture.image.data as Float32Array

  // An axis the ray runs parallel to gets a huge inverse instead of an infinite one, so the slab test never multiplies
  // zero by infinity.
  const inverse = new Vector3(
    1 / (ray.direction.x || tiny),
    1 / (ray.direction.y || tiny),
    1 / (ray.direction.z || tiny),
  )

  let best: Omit<BvhHit, 'point' | 'corners'> & { base: number } = {
    distance: Infinity,
    mesh: -1,
    leaf: -1,
    face: -1,
    base: -1,
  }
  const stack: number[] = []

  for (let mesh = 0; mesh < packed.numObjects; ++mesh) {
    const meshNodes = mesh * packed.maxNumBvhNodes
    const meshFaces = mesh * packed.maxNumFaces
    stack.push(0)

    while (stack.length > 0) {
      const node = stack.pop()!
      const base = (meshNodes + node) * numFloatsPerBvhNode
      if (enterBox(nodes, base, ray.origin, inverse) >= best.distance) {
        continue
      }

      // The payload holds the left and right children, the first face and the face count, each stored plus 0.5.
      const payload = base + bvhNodePayloadOffset
      const faceCount = Math.trunc(nodes[payload + 3])
      if (faceCount > 0) {
        const firstFace = Math.trunc(nodes[payload + 2])
        for (let face = firstFace; face < firstFace + faceCount; ++face) {
          const faceBase = (meshFaces + face) * numFloatsPerFace
          const distance = hitTriangle(faces, faceBase, ray)
          if (distance < best.distance) {
            best = { distance, mesh, leaf: node, face, base: faceBase }
          }
        }
        continue
      }

      // A missing child is stored as -1.5, which truncates to -1.
      const left = Math.trunc(nodes[payload])
      const right = Math.trunc(nodes[payload + 1])
      if (left >= 0) {
        stack.push(left)
      }
      if (right >= 0) {
        stack.push(right)
      }
    }
  }

  if (best.base < 0) {
    return null
  }

  const { base, ...hit } = best
  return { ...hit, point: ray.at(hit.distance, new Vector3()), corners: corners(faces, base) }
}
