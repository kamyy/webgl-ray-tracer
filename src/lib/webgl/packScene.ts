/**
 * Turns a loaded glTF scene into the textures the path-tracing shader reads.
 *
 * Every mesh becomes one object with its own BVH tree. The faces and BVH nodes are built and packed on a worker
 * thread (see `src/lib/webgl/bvhWorker.ts`), and the materials are packed here, straight from the three.js material
 * that `GLTFLoader` created. The result is three data textures: faces and BVH nodes with one array layer per
 * object, and materials with one row per material.
 */
import {
  DataArrayTexture,
  DataTexture,
  FloatType,
  Matrix3,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  RGBAFormat,
  RGBFormat,
  Texture,
  Vector3,
} from 'three'
import type { BvhRequest, BvhRequestMesh, BvhResult } from './bvhWorker'
import {
  bvhMaxStackSize,
  bvhNodesPerRow,
  DIELECTRIC_MATERIAL,
  EMISSIVE_MATERIAL,
  facesPerRow,
  numFloatsPerBvhNode,
  numFloatsPerFace,
  numFloatsPerMaterial,
  numTexelsPerBvhNode,
  numTexelsPerFace,
  numTexelsPerMaterial,
  REFLECTIVE_MATERIAL,
} from './sceneLayout'

// The most memory the packed face and BVH arrays may take. Both are padded to the largest mesh in the scene, so a scene
// with many meshes and one huge mesh costs far more than its triangle count suggests.
const maxPackedBytes = 1024 * 1024 * 1024

export interface PackedScene {
  numObjects: number
  facesTexture: DataArrayTexture
  bvhTexture: DataArrayTexture
  materialsTexture: DataTexture
}

// A glTF mesh without normals is flat shaded, so each corner takes the normal of its triangle.
function writeFlatNormals(positions: Float32Array, normals: Float32Array) {
  const p0 = new Vector3()
  const p1 = new Vector3()
  const p2 = new Vector3()
  for (let corner = 0; corner < positions.length; corner += 9) {
    p0.fromArray(positions, corner)
    p1.fromArray(positions, corner + 3)
    p2.fromArray(positions, corner + 6)
    p1.sub(p0).cross(p2.sub(p0)).normalize()
    for (let vertex = 0; vertex < 3; ++vertex) {
      p1.toArray(normals, corner + vertex * 3)
    }
  }
}

// Turns a mesh into world-space triangles for the BVH worker, three corners of x, y, z per face.
function extractTriangles(mesh: Mesh, materialIndex: number): BvhRequestMesh {
  const matrix = mesh.matrixWorld
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
    if (normalAttribute) {
      vector
        .fromBufferAttribute(normalAttribute, vertex)
        .applyMatrix3(normalMatrix)
        .normalize()
        .toArray(normals, corner * 3)
    }
  }

  if (!normalAttribute) {
    writeFlatNormals(positions, normals)
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
      reject(new Error(event.message || 'the BVH worker failed, probably because the scene is too large.'))
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

// The shader reads exact texels with texelFetch, so no filtering or mipmaps.
function setExactTexels(texture: Texture) {
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
}

// Rejects materials the shader cannot light, with a message that says how to fix the file. `GLTFLoader` makes a basic
// material for `KHR_materials_unlit`, and that has no emission, metalness or roughness to read.
function checkMaterial(material: Mesh['material']) {
  if (!(material instanceof MeshStandardMaterial)) {
    throw new Error(
      'a material is unlit (KHR_materials_unlit) or of an unsupported kind. Re-export the scene with standard PBR materials.',
    )
  }
}

// Stops a scene whose padded arrays would be too big to allocate. The BVH has at most two nodes per face.
function checkPackedSize(triangles: BvhRequestMesh[]) {
  const largestMesh = triangles.reduce((most, mesh) => Math.max(most, mesh.positions.length / 9), 0)
  const paddedFaces = Math.ceil(largestMesh / facesPerRow) * facesPerRow
  const paddedNodes = Math.ceil((largestMesh * 2) / bvhNodesPerRow) * bvhNodesPerRow
  const bytes = 4 * triangles.length * (paddedFaces * numFloatsPerFace + paddedNodes * numFloatsPerBvhNode)
  if (bytes > maxPackedBytes) {
    const megabytes = Math.round(bytes / (1024 * 1024))
    throw new Error(
      `the scene is too large to render. Its ${triangles.length} meshes are each padded to the largest one, ` +
        `${Math.round(largestMesh)} triangles, which needs about ${megabytes} MB. Merge small meshes or reduce the biggest one.`,
    )
  }
}

export async function packScene(root: Object3D): Promise<PackedScene> {
  root.updateMatrixWorld(true)
  const meshes: Mesh[] = []
  root.traverse(object => {
    if (object instanceof Mesh) {
      meshes.push(object)
    }
  })

  // A file the user opened may hold no geometry, and the textures cannot be built without at least one mesh.
  if (meshes.length === 0) {
    throw new Error('the file has no meshes to render.')
  }

  const materials: MeshPhysicalMaterial[] = []
  const triangles = meshes.map(mesh => {
    checkMaterial(mesh.material)
    const material = mesh.material as MeshPhysicalMaterial
    if (!materials.includes(material)) {
      materials.push(material)
    }
    return extractTriangles(mesh, materials.indexOf(material))
  })
  checkPackedSize(triangles)
  const bvh = await buildBvh({ meshes: triangles })

  // Traversal pops a node and pushes both children, so a node split at depth d leaves d + 2 entries on the shader's
  // stack. A deeper tree would overflow it and corrupt the render without any error.
  if (bvh.maxDepth + 2 > bvhMaxStackSize) {
    throw new Error(
      `a mesh is too deeply nested for the renderer (BVH depth ${bvh.maxDepth}, limit ${bvhMaxStackSize - 2}). ` +
        'Split the largest meshes into several smaller ones.',
    )
  }

  // `bvh.maxNumFaces` and `bvh.maxNumBvhNodes` are whole multiples of the row lengths, because the worker rounds them up.
  const facesTexture = new DataArrayTexture(
    bvh.faces,
    numTexelsPerFace * facesPerRow,
    bvh.maxNumFaces / facesPerRow,
    bvh.numObjects,
  )
  facesTexture.format = RGBFormat
  facesTexture.type = FloatType
  facesTexture.internalFormat = 'RGB32F'
  setExactTexels(facesTexture)

  const bvhTexture = new DataArrayTexture(
    bvh.bvhNodes,
    numTexelsPerBvhNode * bvhNodesPerRow,
    bvh.maxNumBvhNodes / bvhNodesPerRow,
    bvh.numObjects,
  )
  bvhTexture.format = RGBAFormat
  bvhTexture.type = FloatType
  bvhTexture.internalFormat = 'RGBA32F'
  setExactTexels(bvhTexture)

  const materialsTexture = new DataTexture(
    packMaterials(materials),
    numTexelsPerMaterial,
    materials.length,
    RGBAFormat,
    FloatType,
  )
  materialsTexture.internalFormat = 'RGBA32F'
  setExactTexels(materialsTexture)

  return { numObjects: bvh.numObjects, facesTexture, bvhTexture, materialsTexture }
}
