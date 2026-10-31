import { Matrix3, Matrix4, Mesh, MeshPhysicalMaterial, Vector3 } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import RefFrame from '../math/refFrame'
import Vector1x4 from '../math/vector1x4'
import type { BvhRequest, BvhRequestMesh, BvhResult } from './bvhWorker'
import {
  DIELECTRIC_MATERIAL,
  EMISSIVE_MATERIAL,
  numFloatsPerMaterial,
  numTexelsPerBvhNode,
  numTexelsPerFace,
  numTexelsPerMaterial,
  REFLECTIVE_MATERIAL,
} from './sceneLayout'

// The scene file is Y-up like all glTF files, but the camera code still uses Z-up world axes. Rotating the
// geometry by +90 degrees about the x axis maps (x, y, z) to (x, -z, y).
const yUpToZUp = new Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1)

// Turns a mesh into world-space triangles for the BVH worker, three corners of x, y, z per face.
function extractTriangles(mesh: Mesh, materialIndex: number): BvhRequestMesh {
  const matrix = new Matrix4().multiplyMatrices(yUpToZUp, mesh.matrixWorld)
  const normalMatrix = new Matrix3().getNormalMatrix(matrix)
  const positionAttribute = mesh.geometry.getAttribute('position')
  const normalAttribute = mesh.geometry.getAttribute('normal')
  const indices = mesh.geometry.getIndex()
  const numCorners = indices ? indices.count : positionAttribute.count

  const positions = new Float32Array(numCorners * 3)
  const normals = new Float32Array(numCorners * 3)
  const vector = new Vector3()
  for (let corner = 0; corner < numCorners; ++corner) {
    const vertex = indices ? indices.getX(corner) : corner
    vector
      .fromBufferAttribute(positionAttribute, vertex)
      .applyMatrix4(matrix)
      .toArray(positions, corner * 3)
    vector
      .fromBufferAttribute(normalAttribute, vertex)
      .applyMatrix3(normalMatrix)
      .normalize()
      .toArray(normals, corner * 3)
  }

  return { positions, normals, materialIndex }
}

// Builds the BVH on a worker thread, so a large scene does not freeze the page.
function buildBvh(request: BvhRequest): Promise<BvhResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./bvhWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<BvhResult>) => {
      worker.terminate()
      resolve(event.data)
    }
    worker.onerror = event => {
      worker.terminate()
      reject(new Error(event.message))
    }
    worker.postMessage(
      request,
      request.meshes.flatMap(mesh => [mesh.positions.buffer, mesh.normals.buffer]),
    )
  })
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
  bvh: BvhResult | null = null
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
      const triangles = meshes.map(mesh => {
        const material = mesh.material as MeshPhysicalMaterial
        if (!materials.includes(material)) {
          materials.push(material)
        }
        return extractTriangles(mesh, materials.indexOf(material))
      })
      this.materialData = packMaterials(materials)
      this.bvh = await buildBvh({ meshes: triangles })

      this.objCount = this.bvh.numObjects
      this.materialCount = materials.length
      this.initTextures(this.gl)
    }
  }

  initTextures(gl: WebGL2RenderingContext) {
    if (!this.bvh) {
      return
    }
    const { numObjects, maxNumFaces, maxNumBvhNodes, faces, bvhNodes } = this.bvh

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
      numObjects,
      0,
      gl.RGB,
      gl.FLOAT,
      faces,
    )

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
      numObjects,
      0,
      gl.RGBA,
      gl.FLOAT,
      bvhNodes,
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
