/**
 * Turns a loaded glTF scene into the textures the path-tracing shader reads.
 *
 * Every mesh becomes one object with its own BVH tree. The faces and BVH nodes are built and packed on a worker
 * thread (see `src/lib/webgl/bvhWorker.ts`), and the materials are packed here, straight from the three.js material
 * that `GLTFLoader` created. The result is four data textures: faces and BVH nodes with one array layer per
 * object, materials with one row per material, and lights. It also lists the base color and normal map images, which
 * `src/lib/webgl/mapTextures.ts` draws into the layers of two array textures once a renderer is at hand.
 */
import {
  ClampToEdgeWrapping,
  DataArrayTexture,
  DataTexture,
  FloatType,
  Matrix3,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MirroredRepeatWrapping,
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
  CLAMP_WRAP,
  DIELECTRIC_MATERIAL,
  EMISSIVE_MATERIAL,
  facesPerRow,
  lightsPerRow,
  MIRROR_WRAP,
  numFloatsPerBvhNode,
  numFloatsPerFace,
  numFloatsPerLight,
  numFloatsPerMaterial,
  numTexelsPerBvhNode,
  numTexelsPerFace,
  numTexelsPerLight,
  numTexelsPerMaterial,
  REFLECTIVE_MATERIAL,
  REPEAT_WRAP,
} from './sceneLayout'

// The most memory the packed face and BVH arrays may take. Both are padded to the largest mesh in the scene, so a scene
// with many meshes and one huge mesh costs far more than its face count suggests.
const maxPackedBytes = 1024 * 1024 * 1024

// Every layer of a map array is the size of that array's largest image, up to `maxMapSize` pixels square. The larger
// array is then halved until both fit in `maxMapBytes`, because an array takes four bytes per pixel per layer.
const maxMapSize = 2048
const maxMapBytes = 256 * 1024 * 1024

export interface PackedScene {
  numObjects: number
  facesTexture: DataArrayTexture
  bvhTexture: DataArrayTexture
  materialsTexture: DataTexture
  lightsTexture: DataTexture
  numLights: number
  colorMaps: MapArray // the base color map images, which the shader reads as sRGB color
  normalMaps: MapArray // the normal map images, which the shader reads as stored
  root: Object3D // the loaded glTF scene, which the wireframe view draws
  maxNumFaces: number // the face slots per mesh, filled or padding
  maxNumBvhNodes: number // the node slots per mesh in `bvhTexture`, filled or padding
  bvhNodeDepths: Uint8Array // each node slot's depth below its mesh's root, 255 for padding
  bvhDepth: number // the deepest node's depth, leaves included
  bvhParents: Int32Array // each node slot's parent node in the same mesh, -1 for a root or padding
}

// A material's map layers, or -1 for a map it does not have, with the sampling code the shader reads each map with.
interface MaterialMaps {
  colorLayer: number
  colorSampling: number
  normalLayer: number
  normalSampling: number
}

/** One image of a map array. `nearest` is true when every map that draws the image wants hard-edged texels. */
export interface MapLayer {
  image: TexImageSource
  width: number // the image's own size, before it is stretched into its layer
  height: number
  nearest: boolean
}

/** The images of one map array, in layer order, and the width and height every layer is stretched to. */
export interface MapArray {
  layers: MapLayer[]
  size: number
}

// The two map arrays and each material's place in them.
interface CollectedMaps {
  colorMaps: MapArray
  normalMaps: MapArray
  materialMaps: MaterialMaps[]
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
// Each face vertex also gets the texture coordinates of the material's maps, with the maps' offset, repeat and rotation
// applied, so the shader can use them as they are. A mesh without a map gets zero UVs, which the shader never reads. A
// mesh with a map but without the UV set the map names also gets zeros, so the whole mesh takes the map's color at one
// corner.
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

// Glass decides whether a ray enters or leaves it from the shading normal, so it takes no normal map.
function isDielectric(material: MeshPhysicalMaterial): boolean {
  return material.transmission > 0.5
}

// The map that tints a material's base color. A light's color is its emission, so a light's map is not used.
function baseColorMap(material: MeshPhysicalMaterial): Texture | null {
  return isEmissive(material) ? null : material.map
}

// The map that tilts a material's shading normal. Lights and glass ignore it.
function normalMap(material: MeshPhysicalMaterial): Texture | null {
  return isEmissive(material) || isDielectric(material) ? null : material.normalMap
}

// The map whose texture coordinates the faces carry. A material's maps must share them, which `checkMapUvs` enforces.
function uvMap(material: MeshPhysicalMaterial): Texture | null {
  return baseColorMap(material) ?? normalMap(material)
}

// Each face holds one set of texture coordinates, so a normal map must read the same UV set, with the same texture
// transform, as the base color map beside it.
function checkMapUvs(material: MeshPhysicalMaterial) {
  const color = baseColorMap(material)
  const normal = normalMap(material)
  if (!color || !normal) {
    return
  }

  color.updateMatrix()
  normal.updateMatrix()
  if (color.channel !== normal.channel || !color.matrix.equals(normal.matrix)) {
    throw new Error(
      `the material "${material.name}" places its normal map with a different UV map or texture transform than its ` +
        'base color map. Give both images the same UV map and Mapping node before exporting.',
    )
  }
}

// The shader's code for one wrap mode. See the sampling code in `src/lib/webgl/sceneLayout.ts`.
function wrapCode(wrap: number): number {
  if (wrap === ClampToEdgeWrapping) {
    return CLAMP_WRAP
  }

  if (wrap === MirroredRepeatWrapping) {
    return MIRROR_WRAP
  }

  return REPEAT_WRAP
}

// How the shader reads a map. It stands in for the texture's own sampler settings, which the map array cannot keep per
// layer. It is stored plus 0.5, because the shader's `int()` truncates it.
function samplingCode(map: Texture | null): number {
  if (!map) {
    return 0.5
  }

  const nearest = map.magFilter === NearestFilter ? 1 : 0
  return wrapCode(map.wrapS) + 3 * wrapCode(map.wrapT) + 9 * nearest + 0.5
}

// The longest side of the largest image in `layers`, capped at `maxMapSize`.
function largestSide(layers: MapLayer[]): number {
  const sides = layers.map(layer => Math.max(layer.width, layer.height))
  return Math.min(maxMapSize, Math.max(1, ...sides))
}

// Sizes the two arrays to their largest images, then halves the larger array's layers until both fit in memory.
function sizeMapArrays(colorMaps: MapArray, normalMaps: MapArray) {
  colorMaps.size = largestSide(colorMaps.layers)
  normalMaps.size = largestSide(normalMaps.layers)

  const bytes = (maps: MapArray) => maps.layers.length * maps.size * maps.size * 4
  while (bytes(colorMaps) + bytes(normalMaps) > maxMapBytes) {
    const larger = bytes(colorMaps) >= bytes(normalMaps) ? colorMaps : normalMaps
    if (larger.size === 1) {
      break
    }

    larger.size = Math.floor(larger.size / 2)
  }
}

// Gives a map's image a layer of `maps`, shared by every map that draws the same image whatever its wrap modes, because
// the shader applies the wrap modes itself. Returns -1 for no map.
function layerOf(maps: MapArray, sources: Texture['source'][], map: Texture | null): number {
  if (!map) {
    return -1
  }

  const nearest = map.magFilter === NearestFilter
  let layer = sources.indexOf(map.source)
  if (layer === -1) {
    sources.push(map.source)
    const { width, height } = map.source.data as { width: number; height: number }
    maps.layers.push({ image: map.source.data as TexImageSource, width, height, nearest })
    layer = sources.length - 1
  }

  maps.layers[layer].nearest &&= nearest
  return layer
}

// Lists the base color and normal map images, each in its own array. The arrays differ in how the GPU reads them, so a
// normal map never shares a layer with a color map.
function collectMaps(materials: MeshPhysicalMaterial[]): CollectedMaps {
  const colorMaps: MapArray = { layers: [], size: 1 }
  const normalMaps: MapArray = { layers: [], size: 1 }
  const colorSources: Texture['source'][] = []
  const normalSources: Texture['source'][] = []

  const materialMaps = materials.map(material => {
    const color = baseColorMap(material)
    const normal = normalMap(material)
    return {
      colorLayer: layerOf(colorMaps, colorSources, color),
      colorSampling: samplingCode(color),
      normalLayer: layerOf(normalMaps, normalSources, normal),
      normalSampling: samplingCode(normal),
    }
  })

  sizeMapArrays(colorMaps, normalMaps)

  return { colorMaps, normalMaps, materialMaps }
}

// A map layer as the shader reads it: plus 0.5 so `int()` truncates to the layer, or -1 for no map, which the shader
// tests for before converting.
function layerValue(layer: number): number {
  return layer >= 0 ? layer + 0.5 : -1
}

// Writes the texels the shader reads for each material, straight from the three.js material.
function packMaterials(materials: MeshPhysicalMaterial[], materialMaps: MaterialMaps[]): Float32Array {
  const data = new Float32Array(numFloatsPerMaterial * materials.length)
  materials.forEach((material, id) => {
    let i = numFloatsPerMaterial * id
    let materialClass = REFLECTIVE_MATERIAL
    let color = material.color.clone() // the base color, or the emitted light for a light
    const maps = materialMaps[id]

    if (isEmissive(material)) {
      materialClass = EMISSIVE_MATERIAL
      color = material.emissive.clone().multiplyScalar(material.emissiveIntensity)
    } else if (isDielectric(material)) {
      materialClass = DIELECTRIC_MATERIAL
    }

    data[i++] = color.r
    data[i++] = color.g
    data[i++] = color.b
    data[i++] = layerValue(maps.colorLayer)

    data[i++] = materialClass + 0.5 // material class is cast to int in fragment shader
    data[i++] = material.metalness // reflection ratio
    data[i++] = 1.0 - material.roughness // reflection gloss
    data[i++] = Number.isFinite(material.ior) ? material.ior : 1.5 // refraction index, glTF default when absent

    data[i++] = maps.colorSampling
    data[i++] = layerValue(maps.normalLayer)
    data[i++] = maps.normalSampling
    data[i++] = material.normalScale.x // GLTFLoader flips y for three.js's own shading, so x holds the glTF scale
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
      checkMapUvs(material)
      materials.push(material)
    }
  }
  const maps = collectMaps(materials)

  const meshFaces = meshes.map(mesh => {
    const material = mesh.material as MeshPhysicalMaterial
    return extractFaces(mesh, materials.indexOf(material), uvMap(material))
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
    packMaterials(materials, maps.materialMaps),
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
    colorMaps: maps.colorMaps,
    normalMaps: maps.normalMaps,
    root,
    maxNumFaces: bvh.maxNumFaces,
    maxNumBvhNodes: bvh.maxNumBvhNodes,
    bvhNodeDepths: bvh.bvhNodeDepths,
    bvhDepth: bvh.bvhDepth,
    bvhParents: bvh.bvhParents,
  }
}
