/**
 * Turns a loaded glTF scene into the textures the path-tracing shader reads.
 *
 * Every mesh becomes one object with its own BVH tree. The faces and BVH nodes are built and packed on a worker
 * thread (see `src/lib/webgl/bvhWorker.ts`), and the materials are packed here, straight from the three.js material
 * that `GLTFLoader` created. The result is four data textures: faces and BVH nodes with one array layer per
 * object, materials with one row per material, and lights. The materials' base color maps are passed through as they
 * are, because the shader binds each one to a sampler of its own.
 */
import {
  DataArrayTexture,
  DataTexture,
  FloatType,
  LinearFilter,
  Matrix3,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  RGBAFormat,
  RGBFormat,
  Texture,
  Vector2,
  Vector3,
} from 'three'
import type { BvhRequest, BvhRequestMesh, BvhResult } from './bvhWorker'
import {
  bvhMaxStackSize,
  bvhNodesPerRow,
  DIELECTRIC_MATERIAL,
  EMISSIVE_MATERIAL,
  facesPerRow,
  lightsPerRow,
  maxBaseColorMaps,
  numFloatsPerBvhNode,
  numFloatsPerFace,
  numFloatsPerLight,
  numFloatsPerMaterial,
  numTexelsPerBvhNode,
  numTexelsPerFace,
  numTexelsPerLight,
  numTexelsPerMaterial,
  REFLECTIVE_MATERIAL,
} from './sceneLayout'

// The most memory the packed face and BVH arrays may take. Both are padded to the largest mesh in the scene, so a scene
// with many meshes and one huge mesh costs far more than its face count suggests.
const maxPackedBytes = 1024 * 1024 * 1024

export interface PackedScene {
  numObjects: number
  facesTexture: DataArrayTexture
  bvhTexture: DataArrayTexture
  materialsTexture: DataTexture
  lightsTexture: DataTexture
  numLights: number
  baseColorMaps: (Texture | null)[] // one entry per shader slot, null for a slot no material uses
  root: Object3D // the loaded glTF scene, which the wireframe view draws
  maxNumFaces: number // the face slots per mesh, filled or padding
  maxNumBvhNodes: number // the node slots per mesh in `bvhTexture`, filled or padding
  bvhNodeDepths: Uint8Array // each node slot's depth below its mesh's root, 255 for padding
  bvhDepth: number // the deepest node's depth, leaves included
  bvhParents: Int32Array // each node slot's parent node in the same mesh, -1 for a root or padding
}

// The base color maps by shader slot, and each material's slot, or -1 for a material without a map.
interface BaseColorMaps {
  maps: (Texture | null)[]
  slots: number[]
}

// A glTF mesh without normals is flat shaded, so each vertex takes the normal of its face.
function writeFlatNormals(pos: Float32Array, nrm: Float32Array) {
  const p0 = new Vector3()
  const p1 = new Vector3()
  const p2 = new Vector3()
  for (let faceStartIndex = 0; faceStartIndex < pos.length; faceStartIndex += 9) {
    p0.fromArray(pos, faceStartIndex)
    p1.fromArray(pos, faceStartIndex + 3)
    p2.fromArray(pos, faceStartIndex + 6)
    p1.sub(p0).cross(p2.sub(p0)).normalize()
    for (let vertex = 0; vertex < 3; ++vertex) {
      p1.toArray(nrm, faceStartIndex + vertex * 3)
    }
  }
}

// Turns a mesh into world-space faces for the BVH worker, three verts of x, y, z per face.
//
// Each face vertex also gets the texture coordinates of the material's base color map, with the map's offset, repeat
// and rotation applied, so the shader can use them as they are. A mesh without a map gets zero UVs, which the shader
// never reads. A mesh with a map but without the UV set the map names also gets zeros, so the whole mesh takes the
// map's color at one corner.
function extractFaces(mesh: Mesh, materialIndex: number, map: Texture | null): BvhRequestMesh {
  const mtx = mesh.matrixWorld
  const nrmMtx = new Matrix3().getNormalMatrix(mtx)
  const posAttrib = mesh.geometry.getAttribute('position')
  const nrmAttrib = mesh.geometry.getAttribute('normal')
  const indices = mesh.geometry.getIndex()
  const numFaceVerts = indices ? indices.count : posAttrib.count

  // `map.channel` names the UV set the material uses, and set 0 is the `uv` attribute.
  const uvAttrib = map ? mesh.geometry.getAttribute(map.channel === 0 ? 'uv' : `uv${map.channel}`) : undefined
  map?.updateMatrix()

  const pos = new Float32Array(numFaceVerts * 3)
  const nrm = new Float32Array(numFaceVerts * 3)
  const uvs = new Float32Array(numFaceVerts * 2)
  const vec = new Vector3()
  const uv = new Vector2()
  for (let faceVert = 0; faceVert < numFaceVerts; ++faceVert) {
    const meshVert = indices ? indices.getX(faceVert) : faceVert
    vec
      .fromBufferAttribute(posAttrib, meshVert)
      .applyMatrix4(mtx)
      .toArray(pos, faceVert * 3)
    if (nrmAttrib) {
      vec
        .fromBufferAttribute(nrmAttrib, meshVert)
        .applyMatrix3(nrmMtx)
        .normalize()
        .toArray(nrm, faceVert * 3)
    }

    // `Vector2.fromBufferAttribute` is typed to refuse an interleaved attribute, so the UV is read by component.
    if (map && uvAttrib) {
      uv.set(uvAttrib.getX(meshVert), uvAttrib.getY(meshVert))
        .applyMatrix3(map.matrix)
        .toArray(uvs, faceVert * 2)
    }
  }

  if (!nrmAttrib) {
    writeFlatNormals(pos, nrm)
  }

  return { positions: pos, normals: nrm, uvs, materialIndex }
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
      request.meshes.flatMap(mesh => [mesh.positions.buffer, mesh.normals.buffer, mesh.uvs.buffer]),
    )
  })
}

// A material with a non-zero emissive color is a light.
function isEmissive(material: MeshPhysicalMaterial): boolean {
  return material.emissive.r > 0 || material.emissive.g > 0 || material.emissive.b > 0
}

// The map that tints a material's base color. A light's color is its emission, so a light's map is not used.
function baseColorMap(material: MeshPhysicalMaterial): Texture | null {
  return isEmissive(material) ? null : material.map
}

// Whether two maps draw the same image the same way. `GLTFLoader` makes a separate texture for each texture transform
// or sampler of one image. The transforms are already applied to the UVs, so only the wrap modes and the filter keep
// two such textures apart.
function samplesAlike(a: Texture, b: Texture): boolean {
  return a.source === b.source && a.wrapS === b.wrapS && a.wrapT === b.wrapT && a.magFilter === b.magFilter
}

// Gives each base color texture a sampler slot, shared by the maps that sample alike. A texture is one image with one
// set of wrap modes and filter, so an image used with two wrap modes takes two slots.
function collectBaseColorMaps(materials: MeshPhysicalMaterial[]): BaseColorMaps {
  const maps: Texture[] = []
  const slots = materials.map(material => {
    const map = baseColorMap(material)
    if (!map) {
      return -1
    }

    const slot = maps.findIndex(other => samplesAlike(other, map))
    if (slot !== -1) {
      return slot
    }

    maps.push(map)
    return maps.length - 1
  })

  if (maps.length > maxBaseColorMaps) {
    throw new Error(
      `the scene uses ${maps.length} base color textures, and the renderer supports ${maxBaseColorMaps}. ` +
        'An image used with two different wrap settings counts twice. ' +
        'Combine images into an atlas or remove some before exporting.',
    )
  }

  // The shader only reads the full-size image, so a mipmap chain would take GPU memory for nothing. The magnification
  // filter stays as the file set it.
  for (const map of maps) {
    map.generateMipmaps = false
    map.minFilter = LinearFilter
    map.needsUpdate = true
  }

  // Every shader slot needs an entry, or three.js binds fewer texture units than the shader declares. three.js binds an
  // empty texture for a null entry.
  const slotMaps: (Texture | null)[] = new Array(maxBaseColorMaps).fill(null)
  maps.forEach((map, slot) => {
    slotMaps[slot] = map
  })

  return { maps: slotMaps, slots }
}

// Writes the texels the shader reads for each material, straight from the three.js material.
function packMaterials(materials: MeshPhysicalMaterial[], mapSlots: number[]): Float32Array {
  const data = new Float32Array(numFloatsPerMaterial * materials.length)
  materials.forEach((material, id) => {
    let i = numFloatsPerMaterial * id
    let materialClass = REFLECTIVE_MATERIAL
    let color = material.color.clone() // the base color, or the emitted light for a light

    if (isEmissive(material)) {
      materialClass = EMISSIVE_MATERIAL
      color = material.emissive.clone().multiplyScalar(material.emissiveIntensity)
    } else if (material.transmission > 0.5) {
      materialClass = DIELECTRIC_MATERIAL
    }

    data[i++] = color.r
    data[i++] = color.g
    data[i++] = color.b
    data[i++] = mapSlots[id] // -1 for no map, which the shader tests for before converting to int

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

// Writes one light per face of every emissive mesh. The first texel's `w` holds the running total of the areas, which
// the shader searches to pick a light with a chance in proportion to its area.
function packLights(meshFaces: BvhRequestMesh[], materials: MeshPhysicalMaterial[]): Float32Array {
  const lights: number[] = []
  const p0 = new Vector3()
  const p1 = new Vector3()
  const p2 = new Vector3()
  const edge1 = new Vector3()
  const edge2 = new Vector3()
  let totalArea = 0

  for (const mesh of meshFaces) {
    if (!isEmissive(materials[mesh.materialIndex])) {
      continue
    }

    for (let start = 0; start < mesh.positions.length; start += 9) {
      p0.fromArray(mesh.positions, start)
      p1.fromArray(mesh.positions, start + 3)
      p2.fromArray(mesh.positions, start + 6)
      const area = 0.5 * edge1.subVectors(p1, p0).cross(edge2.subVectors(p2, p0)).length()
      if (area <= 0) {
        continue
      }

      totalArea += area
      lights.push(p0.x, p0.y, p0.z, totalArea)
      lights.push(p1.x, p1.y, p1.z, 0)
      lights.push(p2.x, p2.y, p2.z, mesh.materialIndex + 0.5) // material index is cast to int in fragment shader
    }
  }

  return new Float32Array(lights)
}

// The lights texture, with a placeholder row when the scene has no light, because the shader's sampler needs a texture.
function createLightsTexture(lights: Float32Array): DataTexture {
  const rows = Math.max(1, Math.ceil(lights.length / numFloatsPerLight / lightsPerRow))
  const data = new Float32Array(rows * lightsPerRow * numFloatsPerLight)
  data.set(lights)

  const texture = new DataTexture(data, numTexelsPerLight * lightsPerRow, rows, RGBAFormat, FloatType)
  texture.internalFormat = 'RGBA32F'
  setExactTexels(texture)
  return texture
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
function checkPackedSize(meshFaces: BvhRequestMesh[]) {
  const largestMesh = meshFaces.reduce((most, mesh) => Math.max(most, mesh.positions.length / 9), 0)
  const paddedFaces = Math.ceil(largestMesh / facesPerRow) * facesPerRow
  const paddedNodes = Math.ceil((largestMesh * 2) / bvhNodesPerRow) * bvhNodesPerRow
  const bytes = 4 * meshFaces.length * (paddedFaces * numFloatsPerFace + paddedNodes * numFloatsPerBvhNode)
  if (bytes > maxPackedBytes) {
    const megabytes = Math.round(bytes / (1024 * 1024))
    throw new Error(
      `the scene is too large to render. Its ${meshFaces.length} meshes are each padded to the largest one, ` +
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
  for (const mesh of meshes) {
    checkMaterial(mesh.material)
    const material = mesh.material as MeshPhysicalMaterial
    if (!materials.includes(material)) {
      materials.push(material)
    }
  }
  const baseColorMaps = collectBaseColorMaps(materials)

  const meshFaces = meshes.map(mesh => {
    const material = mesh.material as MeshPhysicalMaterial
    return extractFaces(mesh, materials.indexOf(material), baseColorMap(material))
  })
  checkPackedSize(meshFaces)

  // The lights are read before `buildBvh`, because sending the faces to the worker empties these arrays.
  const lights = packLights(meshFaces, materials)
  const bvh = await buildBvh({ meshes: meshFaces })

  // Traversal pops a node and pushes the children its ray hits, at most two, so a node split at depth d leaves at most
  // d + 2 entries on the shader's stack. A deeper tree would overflow it and corrupt the render without any error.
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
    packMaterials(materials, baseColorMaps.slots),
    numTexelsPerMaterial,
    materials.length,
    RGBAFormat,
    FloatType,
  )
  materialsTexture.internalFormat = 'RGBA32F'
  setExactTexels(materialsTexture)

  return {
    numObjects: bvh.numObjects,
    facesTexture,
    bvhTexture,
    materialsTexture,
    lightsTexture: createLightsTexture(lights),
    numLights: lights.length / numFloatsPerLight,
    baseColorMaps: baseColorMaps.maps,
    root,
    maxNumFaces: bvh.maxNumFaces,
    maxNumBvhNodes: bvh.maxNumBvhNodes,
    bvhNodeDepths: bvh.bvhNodeDepths,
    bvhDepth: bvh.bvhDepth,
    bvhParents: bvh.bvhParents,
  }
}
