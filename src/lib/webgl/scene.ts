import { Matrix3, Matrix4, Mesh, MeshPhysicalMaterial, Vector3 } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import RefFrame from '../math/refFrame'
import Vector1x4 from '../math/vector1x4'

enum Axis {
  x = 0,
  y = 1,
  z = 2,
}

const bvMinDelta = 0.01

const EMISSIVE_MATERIAL = 0
const REFLECTIVE_MATERIAL = 1
const DIELECTRIC_MATERIAL = 2

const numTexelsPerMaterial = 2
const numFloatsPerMaterial = 8

// The scene file is Y-up like all glTF files, but the camera code still uses Z-up world axes. Rotating the
// geometry by +90 degrees about the x axis maps (x, y, z) to (x, -z, y).
const yUpToZUp = new Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1)

// must match BVH_MAX_STACK_SIZE in src/shaders/pathTrace.frag.glsl - the ray/BVH traversal stack there is a
// fixed-size array with no bounds checking, so a tree deeper than this will silently corrupt rendering
const bvhMaxStackSize = 16

interface Face {
  p0: Vector3 // vertex position 0
  p1: Vector3 // vertex position 1
  p2: Vector3 // vertex position 2

  n0: Vector3 // vertex normal 0
  n1: Vector3 // vertex normal 1
  n2: Vector3 // vertex normal 2

  faceNormal: Vector3
  faceIndex: number // index into root face array
  materialIndex: number // index into material array
}

interface ParsedObj {
  faces: Face[]
  bvhNodes: BvhNode[]
}

class BvhNode {
  // axis-aligned bounding box node of the bounding volume hierarchy (BVH)
  min: Vector3 // min corner
  max: Vector3 // max corner
  leftChild: number // left child node index
  rightChild: number // right child node index
  faceIndices: number[] // indices of the faces stored in this node

  constructor(min: Vector3, max: Vector3) {
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
      if (depth >= bvhMaxStackSize) {
        console.warn(
          `BVH depth ${depth} reached the fragment shader's traversal stack limit (${bvhMaxStackSize}); raise BVH_MAX_STACK_SIZE in pathTrace.frag.glsl`,
        )
      }
      // pick the axis/position that minimizes expected ray traversal cost (SAH)
      const { index, sorted } = BvhNode.findBestSplit(faces)
      this.splitAcross(index, sorted, bvhNodes, depth)
    }
  }

  static faceMin(face: Face): Vector3 {
    return new Vector3(
      Math.min(face.p0.x, face.p1.x, face.p2.x),
      Math.min(face.p0.y, face.p1.y, face.p2.y),
      Math.min(face.p0.z, face.p1.z, face.p2.z),
    )
  }

  static faceMax(face: Face): Vector3 {
    return new Vector3(
      Math.max(face.p0.x, face.p1.x, face.p2.x),
      Math.max(face.p0.y, face.p1.y, face.p2.y),
      Math.max(face.p0.z, face.p1.z, face.p2.z),
    )
  }

  static surfaceArea(min: Vector3, max: Vector3): number {
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
      const sorted = [...faces].sort((faceA, faceB) => {
        const a = (faceA.p0.getComponent(axis) + faceA.p1.getComponent(axis) + faceA.p2.getComponent(axis)) / 3.0
        const b = (faceB.p0.getComponent(axis) + faceB.p1.getComponent(axis) + faceB.p2.getComponent(axis)) / 3.0
        return a - b
      })
      const n = sorted.length

      // prefix[i]/suffix[i] = bounds of sorted[0..i) / sorted[i..n)
      const prefixMin: Vector3[] = new Array(n + 1)
      const prefixMax: Vector3[] = new Array(n + 1)
      const suffixMin: Vector3[] = new Array(n + 1)
      const suffixMax: Vector3[] = new Array(n + 1)

      prefixMin[0] = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      prefixMax[0] = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
      for (let i = 0; i < n; i++) {
        const fMin = BvhNode.faceMin(sorted[i])
        const fMax = BvhNode.faceMax(sorted[i])
        prefixMin[i + 1] = new Vector3(
          Math.min(prefixMin[i].x, fMin.x),
          Math.min(prefixMin[i].y, fMin.y),
          Math.min(prefixMin[i].z, fMin.z),
        )
        prefixMax[i + 1] = new Vector3(
          Math.max(prefixMax[i].x, fMax.x),
          Math.max(prefixMax[i].y, fMax.y),
          Math.max(prefixMax[i].z, fMax.z),
        )
      }

      suffixMin[n] = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      suffixMax[n] = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
      for (let i = n - 1; i >= 0; i--) {
        const fMin = BvhNode.faceMin(sorted[i])
        const fMax = BvhNode.faceMax(sorted[i])
        suffixMin[i] = new Vector3(
          Math.min(suffixMin[i + 1].x, fMin.x),
          Math.min(suffixMin[i + 1].y, fMin.y),
          Math.min(suffixMin[i + 1].z, fMin.z),
        )
        suffixMax[i] = new Vector3(
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
      const min = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      const max = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
      leftFaces.forEach(f => {
        min.x = Math.min(min.x, f.p0.x, f.p1.x, f.p2.x)
        min.y = Math.min(min.y, f.p0.y, f.p1.y, f.p2.y)
        min.z = Math.min(min.z, f.p0.z, f.p1.z, f.p2.z)
        max.x = Math.max(max.x, f.p0.x, f.p1.x, f.p2.x)
        max.y = Math.max(max.y, f.p0.y, f.p1.y, f.p2.y)
        max.z = Math.max(max.z, f.p0.z, f.p1.z, f.p2.z)
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

      this.leftChild = bvhNodes.length
      leftNode = new BvhNode(min, max)
      bvhNodes.push(leftNode)
    }

    if (rightFaces.length > 0) {
      const min = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      const max = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
      rightFaces.forEach(f => {
        min.x = Math.min(min.x, f.p0.x, f.p1.x, f.p2.x)
        min.y = Math.min(min.y, f.p0.y, f.p1.y, f.p2.y)
        min.z = Math.min(min.z, f.p0.z, f.p1.z, f.p2.z)
        max.x = Math.max(max.x, f.p0.x, f.p1.x, f.p2.x)
        max.y = Math.max(max.y, f.p0.y, f.p1.y, f.p2.y)
        max.z = Math.max(max.z, f.p0.z, f.p1.z, f.p2.z)
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

function emptyBounds() {
  return {
    min: new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    max: new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
  }
}

// Turns a mesh into world-space faces plus the BVH tree over them.
function parseMesh(mesh: Mesh, materialIndex: number): ParsedObj {
  const matrix = new Matrix4().multiplyMatrices(yUpToZUp, mesh.matrixWorld)
  const normalMatrix = new Matrix3().getNormalMatrix(matrix)
  const positions = mesh.geometry.getAttribute('position')
  const normals = mesh.geometry.getAttribute('normal')
  const indices = mesh.geometry.getIndex()
  const numFaces = (indices ? indices.count : positions.count) / 3

  const faces: Face[] = []
  for (let faceIndex = 0; faceIndex < numFaces; ++faceIndex) {
    const vertexIndices = [0, 1, 2].map(corner =>
      indices ? indices.getX(faceIndex * 3 + corner) : faceIndex * 3 + corner,
    )
    const [p0, p1, p2] = vertexIndices.map(i => new Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix))
    const [n0, n1, n2] = vertexIndices.map(i =>
      new Vector3().fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize(),
    )
    const faceNormal = new Vector3().crossVectors(p1.clone().sub(p0), p2.clone().sub(p0)).normalize()

    faces.push({ p0, p1, p2, n0, n1, n2, faceNormal, materialIndex, faceIndex })
  }

  // root bounding box over all faces
  const { min, max } = emptyBounds()
  faces.forEach(f => {
    min.x = Math.min(min.x, f.p0.x, f.p1.x, f.p2.x)
    min.y = Math.min(min.y, f.p0.y, f.p1.y, f.p2.y)
    min.z = Math.min(min.z, f.p0.z, f.p1.z, f.p2.z)
    max.x = Math.max(max.x, f.p0.x, f.p1.x, f.p2.x)
    max.y = Math.max(max.y, f.p0.y, f.p1.y, f.p2.y)
    max.z = Math.max(max.z, f.p0.z, f.p1.z, f.p2.z)
  })
  if (max.x - min.x < bvMinDelta) {
    max.x += bvMinDelta
  } // don't allow a 2D AABB
  if (max.y - min.y < bvMinDelta) {
    max.y += bvMinDelta
  }
  if (max.z - min.z < bvMinDelta) {
    max.z += bvMinDelta
  }

  const bvhNodes: BvhNode[] = []
  const root = new BvhNode(min, max)
  bvhNodes.push(root)
  root.subDivide(faces, bvhNodes)

  return { faces, bvhNodes }
}

// Writes the texels the shader reads for each material, straight from the three.js material.
function packMaterials(materials: MeshPhysicalMaterial[]): Float32Array {
  const data = new Float32Array(numFloatsPerMaterial * materials.length)
  materials.forEach((material, id) => {
    let i = numFloatsPerMaterial * id
    let materialClass = REFLECTIVE_MATERIAL
    let albedo = material.color.clone()

    if (material.emissive.r > 0 || material.emissive.g > 0 || material.emissive.b > 0) {
      materialClass = EMISSIVE_MATERIAL
      albedo = material.emissive.clone().multiplyScalar(material.emissiveIntensity)
    } else if (material.transmission > 0.5) {
      materialClass = DIELECTRIC_MATERIAL
    }

    data[i++] = albedo.r
    data[i++] = albedo.g
    data[i++] = albedo.b
    data[i++] = 1.0

    data[i++] = materialClass + 0.5 // material class is cast to int in fragment shader
    data[i++] = material.metalness // reflection ratio
    data[i++] = 1.0 - material.roughness // reflection gloss
    data[i++] = Number.isFinite(material.ior) ? material.ior : 1.5 // refraction index, glTF default when absent
  })
  return data
}

export default class Scene {
  sceneUrl: string
  objCount: number
  materialCount: number
  parsedObjs: ParsedObj[]
  materialData: Float32Array = new Float32Array(0)
  rootNode: RefFrame | null = null
  parentNode: RefFrame | null = null
  cameraNode: RefFrame | null = null
  gl: WebGL2RenderingContext | null
  facesTexture: WebGLTexture | null = null
  bvhTexture: WebGLTexture | null = null
  materialsTexture: WebGLTexture | null = null

  constructor(gl: WebGL2RenderingContext | null, sceneUrl: string) {
    this.sceneUrl = sceneUrl
    this.objCount = 0
    this.materialCount = 0
    this.parsedObjs = []
    this.gl = gl

    if (gl) {
      this.facesTexture = gl.createTexture()
      this.bvhTexture = gl.createTexture()
      this.materialsTexture = gl.createTexture()

      this.rootNode = new RefFrame()
      this.parentNode = new RefFrame(this.rootNode)
      this.cameraNode = new RefFrame(this.parentNode)
      this.cameraNode.translate(new Vector1x4(0.0, -10.0, 2.0))
    }
  }

  async init() {
    if (this.gl) {
      const dracoLoader = new DRACOLoader()
      dracoLoader.setDecoderPath('/draco/')
      const gltfLoader = new GLTFLoader()
      gltfLoader.setDRACOLoader(dracoLoader)
      const gltf = await gltfLoader.loadAsync(this.sceneUrl)
      dracoLoader.dispose()

      gltf.scene.updateMatrixWorld(true)
      const meshes: Mesh[] = []
      gltf.scene.traverse(object => {
        if (object instanceof Mesh) {
          meshes.push(object)
        }
      })

      const materials: MeshPhysicalMaterial[] = []
      this.parsedObjs = meshes.map(mesh => {
        const material = mesh.material as MeshPhysicalMaterial
        if (!materials.includes(material)) {
          materials.push(material)
        }
        return parseMesh(mesh, materials.indexOf(material))
      })
      this.materialData = packMaterials(materials)

      this.objCount = this.parsedObjs.length
      this.materialCount = materials.length
      this.initTextures(this.gl)
    }
  }

  initTextures(gl: WebGL2RenderingContext) {
    const maxNumFaces = this.parsedObjs.reduce((max, obj) => Math.max(max, obj.faces.length), 0) // max number of faces
    const numTexelsPerFace = 8 // RGBA texel
    const numFloatsPerFace = 24

    let data = new Float32Array(numFloatsPerFace * maxNumFaces * this.parsedObjs.length)
    this.parsedObjs.forEach((obj, id) => {
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
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.facesTexture)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.RGB32F,
      numTexelsPerFace,
      maxNumFaces,
      this.parsedObjs.length,
      0,
      gl.RGB,
      gl.FLOAT,
      data,
    )

    const maxNumBvhNodes = this.parsedObjs.reduce((val: number, obj) => Math.max(val, obj.bvhNodes.length), 0) // max number of BvhNode nodes
    const numTexelsPerBvhNode = 3 // RGBA texel
    const numFloatsPerBvhNode = 12

    data = new Float32Array(numFloatsPerBvhNode * maxNumBvhNodes * this.parsedObjs.length)
    this.parsedObjs.forEach((obj, id) => {
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
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.bvhTexture)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.RGBA32F,
      numTexelsPerBvhNode,
      maxNumBvhNodes,
      this.parsedObjs.length,
      0,
      gl.RGBA,
      gl.FLOAT,
      data,
    )

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.materialsTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      numTexelsPerMaterial,
      this.materialCount,
      0,
      gl.RGBA,
      gl.FLOAT,
      this.materialData,
    )
  }

  bindToSampleShader(gl: WebGL2RenderingContext, program: WebGLProgram) {
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.facesTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_face_sampler'), 3)

    gl.activeTexture(gl.TEXTURE4)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.bvhTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_bvh_sampler'), 4)

    gl.activeTexture(gl.TEXTURE5)
    gl.bindTexture(gl.TEXTURE_2D, this.materialsTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_material_sampler'), 5)
  }
}
