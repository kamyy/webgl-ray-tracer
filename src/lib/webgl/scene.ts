import wavefrontMtlParser from 'mtl-file-parser'
import wavefrontObjParser from 'obj-file-parser'
import RefFrame from '../math/refFrame'
import Vector1x4 from '../math/vector1x4'
import Material, { DIELECTRIC_MATERIAL, EMISSIVE_MATERIAL } from './material'

enum Axis {
  x = 0,
  y = 1,
  z = 2,
}

const bvMinDelta = 0.01

// must match BVH_MAX_STACK_SIZE in src/shaders/pathTrace.frag.glsl - the ray/BVH traversal stack there is a
// fixed-size array with no bounds checking, so a tree deeper than this will silently corrupt rendering
const bvhMaxStackSize = 16

interface Model {
  name: string
  vertices: { x: number; y: number; z: number }[]
  vertexNormals: { x: number; y: number; z: number }[]
  faces: {
    material: string
    vertices: { vertexIndex: number; textureCoordsIndex: number; vertexNormalIndex: number }[]
  }[]
}

interface Mtl {
  name: string
  Kd: {
    method: string
    red: number
    green: number
    blue: number
  }
}

interface Face {
  p0: Vector1x4 // vertex position 0
  p1: Vector1x4 // vertex position 1
  p2: Vector1x4 // vertex position 2

  n0: Vector1x4 // vertex normal 0
  n1: Vector1x4 // vertex normal 1
  n2: Vector1x4 // vertex normal 2

  faceNormal: Vector1x4
  faceIndex: number // index into root face array
  materialIndex: number // index into material array
}

interface ParsedObj {
  faces: Face[]
  bvhNodes: BvhNode[]
}

class BvhNode {
  // axis-aligned bounding box node of the bounding volume hierarchy (BVH)
  min: Vector1x4 // min corner
  max: Vector1x4 // max corner
  leftChild: number // left child node index
  rightChild: number // right child node index
  faceIndices: number[] // indices of the faces stored in this node

  constructor(min: Vector1x4, max: Vector1x4) {
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

  static faceMin(face: Face): Vector1x4 {
    return new Vector1x4(
      Math.min(face.p0.x, face.p1.x, face.p2.x),
      Math.min(face.p0.y, face.p1.y, face.p2.y),
      Math.min(face.p0.z, face.p1.z, face.p2.z),
    )
  }

  static faceMax(face: Face): Vector1x4 {
    return new Vector1x4(
      Math.max(face.p0.x, face.p1.x, face.p2.x),
      Math.max(face.p0.y, face.p1.y, face.p2.y),
      Math.max(face.p0.z, face.p1.z, face.p2.z),
    )
  }

  static surfaceArea(min: Vector1x4, max: Vector1x4): number {
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
        const a = (faceA.p0.xyzw[axis] + faceA.p1.xyzw[axis] + faceA.p2.xyzw[axis]) / 3.0
        const b = (faceB.p0.xyzw[axis] + faceB.p1.xyzw[axis] + faceB.p2.xyzw[axis]) / 3.0
        return a - b
      })
      const n = sorted.length

      // prefix[i]/suffix[i] = bounds of sorted[0..i) / sorted[i..n)
      const prefixMin: Vector1x4[] = new Array(n + 1)
      const prefixMax: Vector1x4[] = new Array(n + 1)
      const suffixMin: Vector1x4[] = new Array(n + 1)
      const suffixMax: Vector1x4[] = new Array(n + 1)

      prefixMin[0] = new Vector1x4(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      prefixMax[0] = new Vector1x4(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
      for (let i = 0; i < n; i++) {
        const fMin = BvhNode.faceMin(sorted[i])
        const fMax = BvhNode.faceMax(sorted[i])
        prefixMin[i + 1] = new Vector1x4(
          Math.min(prefixMin[i].x, fMin.x),
          Math.min(prefixMin[i].y, fMin.y),
          Math.min(prefixMin[i].z, fMin.z),
        )
        prefixMax[i + 1] = new Vector1x4(
          Math.max(prefixMax[i].x, fMax.x),
          Math.max(prefixMax[i].y, fMax.y),
          Math.max(prefixMax[i].z, fMax.z),
        )
      }

      suffixMin[n] = new Vector1x4(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      suffixMax[n] = new Vector1x4(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
      for (let i = n - 1; i >= 0; i--) {
        const fMin = BvhNode.faceMin(sorted[i])
        const fMax = BvhNode.faceMax(sorted[i])
        suffixMin[i] = new Vector1x4(
          Math.min(suffixMin[i + 1].x, fMin.x),
          Math.min(suffixMin[i + 1].y, fMin.y),
          Math.min(suffixMin[i + 1].z, fMin.z),
        )
        suffixMax[i] = new Vector1x4(
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
      const min = new Vector1x4(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      const max = new Vector1x4(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
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
      const min = new Vector1x4(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      const max = new Vector1x4(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
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

export default class Scene {
  objUrl: string
  mtlUrl: string
  objCount: number
  materialCount: number
  parsedObjs: ParsedObj[]
  parsedMtls: Material[]
  rootNode: RefFrame | null = null
  parentNode: RefFrame | null = null
  cameraNode: RefFrame | null = null
  gl: WebGL2RenderingContext | null
  facesTexture: WebGLTexture | null = null
  bvhTexture: WebGLTexture | null = null
  materialsTexture: WebGLTexture | null = null

  constructor(gl: WebGL2RenderingContext | null, objUrl: string, mtlUrl: string) {
    this.objUrl = objUrl
    this.mtlUrl = mtlUrl
    this.objCount = 0
    this.materialCount = 0
    this.parsedObjs = []
    this.parsedMtls = []
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

  async fetchTextFile(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Cannot GET ${url} status=${response.status}`)
    }
    return response.text()
  }

  async init() {
    if (this.gl) {
      const _wavefrontObjParser = new wavefrontObjParser(await this.fetchTextFile(this.objUrl))
      const _wavefrontMtlParser = new wavefrontMtlParser(await this.fetchTextFile(this.mtlUrl))
      const wavefrontObj = _wavefrontObjParser.parse()
      const wavefrontMtl = _wavefrontMtlParser.parse()

      let posArray: { x: number; y: number; z: number }[] = []
      let nrmArray: { x: number; y: number; z: number }[] = []

      this.parsedObjs = wavefrontObj.models.map(({ vertices, vertexNormals, faces }: Model) => {
        const outFaces: Face[] = []
        posArray = posArray.concat(vertices)
        nrmArray = nrmArray.concat(vertexNormals)

        faces.forEach(f => {
          const i0 = f.vertices[0].vertexIndex - 1
          const i1 = f.vertices[1].vertexIndex - 1
          const i2 = f.vertices[2].vertexIndex - 1
          const p0 = new Vector1x4(posArray[i0].x, posArray[i0].y, posArray[i0].z)
          const p1 = new Vector1x4(posArray[i1].x, posArray[i1].y, posArray[i1].z)
          const p2 = new Vector1x4(posArray[i2].x, posArray[i2].y, posArray[i2].z)

          const j0 = f.vertices[0].vertexNormalIndex - 1
          const j1 = f.vertices[1].vertexNormalIndex - 1
          const j2 = f.vertices[2].vertexNormalIndex - 1
          const n0 = new Vector1x4(nrmArray[j0].x, nrmArray[j0].y, nrmArray[j0].z)
          const n1 = new Vector1x4(nrmArray[j1].x, nrmArray[j1].y, nrmArray[j1].z)
          const n2 = new Vector1x4(nrmArray[j2].x, nrmArray[j2].y, nrmArray[j2].z)

          const faceNormal = p1.sub(p0).cross(p2.sub(p0)).normalize() // face normal
          const materialIndex = wavefrontMtl.findIndex((m: Mtl) => m.name === f.material) // material index
          const faceIndex = outFaces.length

          outFaces.push({
            p0,
            p1,
            p2,
            n0,
            n1,
            n2,
            faceNormal,
            materialIndex,
            faceIndex,
          })
        })
        const outBvhNodes = []
        const min = new Vector1x4(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
        const max = new Vector1x4(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
        outFaces.forEach(f => {
          // calculate min/max for root AABB bounding volume
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
        const bv = new BvhNode(min, max)
        outBvhNodes.push(bv)
        bv.subDivide(outFaces, outBvhNodes)

        //console.log(`# faces ${outFaces.length}`);
        //console.log(`# bvhNodes ${outBvhNodes.length}`);
        return {
          // a parsed obj containing faces and its corresponding BVH tree
          faces: outFaces,
          bvhNodes: outBvhNodes,
        }
      })

      this.parsedMtls = wavefrontMtl.map((mtl: Mtl) => {
        const mat = new Material(new Vector1x4(mtl.Kd.red, mtl.Kd.green, mtl.Kd.blue))
        // 'Metal 0', 0.95, 'Glass 0', 0.00, 1.33
        switch (mtl.name) {
          case 'light':
            mat.mtlCls = EMISSIVE_MATERIAL
            mat.albedo.r = 3.0
            mat.albedo.g = 3.0
            mat.albedo.b = 3.0
            break
          case 'glass':
            mat.mtlCls = DIELECTRIC_MATERIAL
            mat.refractionIndex = 1.52
            mat.albedo.r = 1.0
            mat.albedo.g = 1.0
            mat.albedo.b = 1.0
            break
          case 'suzanne':
            mat.reflectionRatio = 0.5
            mat.reflectionGloss = 0.7
            break
          case 'teapot':
            mat.reflectionRatio = 0.9
            break
          case 'ladder':
            mat.reflectionRatio = 0.3
            mat.reflectionGloss = 0.8
            break

          default:
            break
        }
        return mat
      })
      //console.log(`# mtls ${this.parsedMtls.length}`);

      this.initTextures(this.gl)
      this.objCount = this.parsedObjs.length
      this.materialCount = this.parsedMtls.length
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

    const numTexelsPerMaterial = 2
    const numFloatsPerMaterial = 8
    data = new Float32Array(numFloatsPerMaterial * this.parsedMtls.length)
    this.parsedMtls.forEach((mtl, id) => {
      let i = numFloatsPerMaterial * id
      data[i++] = mtl.albedo.x
      data[i++] = mtl.albedo.y
      data[i++] = mtl.albedo.z
      data[i++] = 1.0

      data[i++] = mtl.mtlCls + 0.5 // material type is cast to int in fragment shader
      data[i++] = mtl.reflectionRatio
      data[i++] = mtl.reflectionGloss
      data[i++] = mtl.refractionIndex
    })
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
      this.parsedMtls.length,
      0,
      gl.RGBA,
      gl.FLOAT,
      data,
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
