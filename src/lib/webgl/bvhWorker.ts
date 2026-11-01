/**
 * Web Worker that builds the bounding volume hierarchy (BVH) and packs faces and BVH nodes into float arrays.
 *
 * Building the tree with the surface area heuristic takes seconds for a large mesh, which would freeze the page if it
 * ran on the main thread. `packScene` sends world-space triangles here, and the worker sends back the packed arrays as
 * transferable buffers, so nothing is copied. These are the arrays that become the faces and BVH textures.
 */
import { bvhMaxStackSize, numFloatsPerBvhNode, numFloatsPerFace } from './sceneLayout'

enum Axis {
  x = 0,
  y = 1,
  z = 2,
}

// The thinnest a bounding box is allowed to be on any axis. A flat group of faces would otherwise get a zero-width box
// that rays miss through rounding.
const bvMinDelta = 0.01

let maxDepth = 0 // deepest BVH tree level reached while building, reported back to the main thread

interface Vec3 {
  x: number
  y: number
  z: number
}

interface Face {
  p0: Vec3 // vertex position 0
  p1: Vec3 // vertex position 1
  p2: Vec3 // vertex position 2

  n0: Vec3 // vertex normal 0
  n1: Vec3 // vertex normal 1
  n2: Vec3 // vertex normal 2

  faceNormal: Vec3
  faceIndex: number // index into root face array
  materialIndex: number // index into material array

  min: Vec3 // min corner of the face's bounding box
  max: Vec3 // max corner of the face's bounding box
  centroid: Vec3 // average of the three vertex positions, which the split sorts by
}

/** One mesh as world-space triangles, 9 floats per face (three corners of x, y, z). */
export interface BvhRequestMesh {
  positions: Float32Array
  normals: Float32Array
  materialIndex: number
}

export interface BvhRequest {
  meshes: BvhRequestMesh[]
}

export interface BvhResult {
  numObjects: number
  maxNumFaces: number
  maxNumBvhNodes: number
  faces: Float32Array
  bvhNodes: Float32Array
  maxDepth: number
}

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z }
}

function component(v: Vec3, axis: Axis): number {
  return axis === Axis.x ? v.x : axis === Axis.y ? v.y : v.z
}

// Bounds with nothing inside yet, so the first face that is added sets both corners.
function emptyBounds() {
  return {
    min: vec3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    max: vec3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
  }
}

// The box around a group of faces. A box thinner than `bvMinDelta` on an axis is widened to that thickness, so a flat
// group never gets a 2D box.
function boundsOf(faces: Face[]) {
  const { min, max } = emptyBounds()
  faces.forEach(f => {
    min.x = Math.min(min.x, f.min.x)
    min.y = Math.min(min.y, f.min.y)
    min.z = Math.min(min.z, f.min.z)
    max.x = Math.max(max.x, f.max.x)
    max.y = Math.max(max.y, f.max.y)
    max.z = Math.max(max.z, f.max.z)
  })
  if (max.x - min.x < bvMinDelta) {
    max.x += bvMinDelta
  }
  if (max.y - min.y < bvMinDelta) {
    max.y += bvMinDelta
  }
  if (max.z - min.z < bvMinDelta) {
    max.z += bvMinDelta
  }

  return { min, max }
}

class BvhNode {
  // axis-aligned bounding box node of the bounding volume hierarchy (BVH)
  min: Vec3 // min corner
  max: Vec3 // max corner
  leftChild: number // left child node index
  rightChild: number // right child node index
  faceIndices: number[] // indices of the faces stored in this node

  constructor(min: Vec3, max: Vec3) {
    this.min = min
    this.max = max
    this.leftChild = -2.0
    this.rightChild = -2.0
    this.faceIndices = [-2.0, -2.0]
  }

  subDivide(faces: Face[], bvhNodes: BvhNode[], depth: number = 0) {
    if (faces.length <= this.faceIndices.length) {
      // all the faces fit in this node
      faces.forEach((face, i) => (this.faceIndices[i] = face.faceIndex))
    } else {
      maxDepth = Math.max(maxDepth, depth)
      // Traversal pops a node and pushes both children, so a node split at depth d leaves d + 2 entries on the stack.
      if (depth + 2 > bvhMaxStackSize) {
        console.warn(
          `BVH depth ${depth} reached the fragment shader's traversal stack limit (${bvhMaxStackSize}); raise BVH_MAX_STACK_SIZE in src/shaders/pathTrace.frag.glsl`,
        )
      }
      // pick the axis/position that minimizes expected ray traversal cost (SAH)
      const { index, sorted } = BvhNode.findBestSplit(faces)
      this.splitAcross(index, sorted, bvhNodes, depth)
    }
  }

  static surfaceArea(min: Vec3, max: Vec3): number {
    const dx = Math.max(0, max.x - min.x)
    const dy = Math.max(0, max.y - min.y)
    const dz = Math.max(0, max.z - min.z)
    return 2.0 * (dx * dy + dy * dz + dz * dx)
  }

  // sweep all 3 axes and every candidate split position, return the one with
  // the lowest surface-area-heuristic cost: SA(left) * |left| + SA(right) * |right|
  static findBestSplit(faces: Face[]): { index: number; sorted: Face[] } {
    let bestIndex = Math.ceil(faces.length / 2)
    let bestCost = Number.MAX_VALUE
    let bestSorted = faces

    ;[Axis.x, Axis.y, Axis.z].forEach(axis => {
      const sorted = [...faces].sort(
        (faceA, faceB) => component(faceA.centroid, axis) - component(faceB.centroid, axis),
      )
      const n = sorted.length

      // prefix[i]/suffix[i] = bounds of sorted[0..i) / sorted[i..n)
      const prefixMin: Vec3[] = new Array(n + 1)
      const prefixMax: Vec3[] = new Array(n + 1)
      const suffixMin: Vec3[] = new Array(n + 1)
      const suffixMax: Vec3[] = new Array(n + 1)

      const empty = emptyBounds()
      prefixMin[0] = empty.min
      prefixMax[0] = empty.max
      for (let i = 0; i < n; i++) {
        const { min: fMin, max: fMax } = sorted[i]
        prefixMin[i + 1] = vec3(
          Math.min(prefixMin[i].x, fMin.x),
          Math.min(prefixMin[i].y, fMin.y),
          Math.min(prefixMin[i].z, fMin.z),
        )
        prefixMax[i + 1] = vec3(
          Math.max(prefixMax[i].x, fMax.x),
          Math.max(prefixMax[i].y, fMax.y),
          Math.max(prefixMax[i].z, fMax.z),
        )
      }

      suffixMin[n] = empty.min
      suffixMax[n] = empty.max
      for (let i = n - 1; i >= 0; i--) {
        const { min: fMin, max: fMax } = sorted[i]
        suffixMin[i] = vec3(
          Math.min(suffixMin[i + 1].x, fMin.x),
          Math.min(suffixMin[i + 1].y, fMin.y),
          Math.min(suffixMin[i + 1].z, fMin.z),
        )
        suffixMax[i] = vec3(
          Math.max(suffixMax[i + 1].x, fMax.x),
          Math.max(suffixMax[i + 1].y, fMax.y),
          Math.max(suffixMax[i + 1].z, fMax.z),
        )
      }

      // only candidates that leave both children non-empty are valid splits
      for (let i = 1; i < n; i++) {
        const leftSA = BvhNode.surfaceArea(prefixMin[i], prefixMax[i])
        const rightSA = BvhNode.surfaceArea(suffixMin[i], suffixMax[i])
        const cost = leftSA * i + rightSA * (n - i)

        if (cost < bestCost) {
          bestCost = cost
          bestIndex = i
          bestSorted = sorted
        }
      }
    })

    return { index: bestIndex, sorted: bestSorted }
  }

  splitAcross(index: number, sorted: Face[], bvhNodes: BvhNode[], depth: number) {
    const leftFaces = sorted.slice(0, index) // left faces
    const rightFaces = sorted.slice(index, sorted.length) // right faces
    let leftNode = null
    let rightNode = null

    if (leftFaces.length > 0) {
      const { min, max } = boundsOf(leftFaces)
      this.leftChild = bvhNodes.length
      leftNode = new BvhNode(min, max)
      bvhNodes.push(leftNode)
    }

    if (rightFaces.length > 0) {
      const { min, max } = boundsOf(rightFaces)
      this.rightChild = bvhNodes.length
      rightNode = new BvhNode(min, max)
      bvhNodes.push(rightNode)
    }

    if (leftNode) {
      leftNode.subDivide(leftFaces, bvhNodes, depth + 1)
    }
    if (rightNode) {
      rightNode.subDivide(rightFaces, bvhNodes, depth + 1)
    }
  }
}

function readVec3(array: Float32Array, offset: number): Vec3 {
  return vec3(array[offset], array[offset + 1], array[offset + 2])
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x - b.x, a.y - b.y, a.z - b.z)
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z)
  return vec3(v.x / length, v.y / length, v.z / length)
}

// Builds the faces of one mesh and the BVH tree over them.
function buildObject(mesh: BvhRequestMesh): { faces: Face[]; bvhNodes: BvhNode[] } {
  const numFaces = mesh.positions.length / 9
  const faces: Face[] = []
  for (let faceIndex = 0; faceIndex < numFaces; ++faceIndex) {
    const o = faceIndex * 9
    const p0 = readVec3(mesh.positions, o)
    const p1 = readVec3(mesh.positions, o + 3)
    const p2 = readVec3(mesh.positions, o + 6)
    const faceNormal = normalize(cross(sub(p1, p0), sub(p2, p0)))

    faces.push({
      p0,
      p1,
      p2,
      n0: readVec3(mesh.normals, o),
      n1: readVec3(mesh.normals, o + 3),
      n2: readVec3(mesh.normals, o + 6),
      faceNormal,
      materialIndex: mesh.materialIndex,
      faceIndex,
      min: vec3(Math.min(p0.x, p1.x, p2.x), Math.min(p0.y, p1.y, p2.y), Math.min(p0.z, p1.z, p2.z)),
      max: vec3(Math.max(p0.x, p1.x, p2.x), Math.max(p0.y, p1.y, p2.y), Math.max(p0.z, p1.z, p2.z)),
      centroid: vec3((p0.x + p1.x + p2.x) / 3.0, (p0.y + p1.y + p2.y) / 3.0, (p0.z + p1.z + p2.z) / 3.0),
    })
  }

  const { min, max } = boundsOf(faces) // root bounding box over all faces

  const bvhNodes: BvhNode[] = []
  const root = new BvhNode(min, max)
  bvhNodes.push(root)
  root.subDivide(faces, bvhNodes)

  return { faces, bvhNodes }
}

// Writes the face texels the shader reads, one slice of maxNumFaces faces per object.
function packFaces(objects: { faces: Face[] }[], maxNumFaces: number): Float32Array {
  const data = new Float32Array(numFloatsPerFace * maxNumFaces * objects.length)
  objects.forEach((obj, id) => {
    let i = numFloatsPerFace * maxNumFaces * id // index to start of texture slice for object's faces
    obj.faces.forEach(face => {
      data[i++] = face.faceNormal.x
      data[i++] = face.faceNormal.y
      data[i++] = face.faceNormal.z // face unit normal

      data[i++] = face.p0.x
      data[i++] = face.p0.y
      data[i++] = face.p0.z // vertex positions
      data[i++] = face.p1.x
      data[i++] = face.p1.y
      data[i++] = face.p1.z
      data[i++] = face.p2.x
      data[i++] = face.p2.y
      data[i++] = face.p2.z

      data[i++] = face.n0.x
      data[i++] = face.n0.y
      data[i++] = face.n0.z // vertex normals
      data[i++] = face.n1.x
      data[i++] = face.n1.y
      data[i++] = face.n1.z
      data[i++] = face.n2.x
      data[i++] = face.n2.y
      data[i++] = face.n2.z

      data[i] = face.materialIndex + 0.5 // material index is cast to int in fragment shader
      i += 3
    })
  })
  return data
}

// Writes the BVH node texels the shader reads, one slice of maxNumBvhNodes nodes per object.
function packBvhNodes(objects: { bvhNodes: BvhNode[] }[], maxNumBvhNodes: number): Float32Array {
  const data = new Float32Array(numFloatsPerBvhNode * maxNumBvhNodes * objects.length)
  objects.forEach((obj, id) => {
    let i = numFloatsPerBvhNode * maxNumBvhNodes * id // index to start of texture slice for the object's BVH tree
    obj.bvhNodes.forEach(bv => {
      data[i++] = bv.min.x
      data[i++] = bv.min.y
      data[i++] = bv.min.z
      data[i++] = 1.0

      data[i++] = bv.max.x
      data[i++] = bv.max.y
      data[i++] = bv.max.z
      data[i++] = 1.0

      data[i++] = bv.leftChild + 0.5 // left child node index is cast to int in fragment shader
      data[i++] = bv.rightChild + 0.5 // right child node index is cast to int in fragment shader
      data[i++] = bv.faceIndices[0] + 0.5 // face index is cast to int in fragment shader
      data[i++] = bv.faceIndices[1] + 0.5 // face index is cast to int in fragment shader
    })
  })
  return data
}

self.onmessage = (event: MessageEvent<BvhRequest>) => {
  maxDepth = 0
  const objects = event.data.meshes.map(buildObject)
  const maxNumFaces = objects.reduce((max, obj) => Math.max(max, obj.faces.length), 0)
  const maxNumBvhNodes = objects.reduce((max, obj) => Math.max(max, obj.bvhNodes.length), 0)

  const result: BvhResult = {
    numObjects: objects.length,
    maxNumFaces,
    maxNumBvhNodes,
    faces: packFaces(objects, maxNumFaces),
    bvhNodes: packBvhNodes(objects, maxNumBvhNodes),
    maxDepth,
  }
  self.postMessage(result, { transfer: [result.faces.buffer, result.bvhNodes.buffer] })
}
