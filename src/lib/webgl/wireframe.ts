/**
 * The three.js objects that draw the loaded scene's triangle edges and BVH boxes as lines.
 *
 * Both are drawn with the ordinary three.js rasterizer rather than the path tracer. The triangle edges replace the
 * traced image, and the boxes draw over the traced image or the edges. The faces are a copy of the glTF scene graph that
 * shares its geometry, drawn with a wireframe material in place of each mesh's own. The BVH (bounding volume hierarchy)
 * boxes are one line object per tree level, so a band of levels is shown by hiding the others. A large scene has
 * millions of BVH nodes, so each level's lines are only built the first time that level is shown. The materials skip
 * the renderer's tone mapping, so the lines keep their exact colors.
 *
 * The selection group shows one tapped triangle and only the boxes a ray passes through to reach it: its leaf box and
 * each box above that up to its mesh's root box. The tap handling is in `src/lib/hooks/useSelectedFace.ts`.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  Scene,
} from 'three'
import type { BvhHit } from './bvhRaycast'
import type { PackedScene } from './packScene'
import { bvhNodeMaxOffset, bvhNodeMinOffset, numFloatsPerBvhNode } from './sceneLayout'

const faceColor = 0xb8c0cc
const selectedFaceColor = 0xffffff

// Each box takes its own fully saturated hue, so one box stands out from its neighbours. Stepping round the color
// wheel by the golden ratio puts every box's hue far from the hues of the boxes numbered just before and after it,
// which are its neighbours in the tree.
const hueStep = 0.618034
const boxLightness = 0.5 // the brightest a hue gets before it fades toward white

// A box's 8 corners are numbered by which of x, y and z take the max side, as bits 0, 1 and 2. Each edge joins two
// corners that differ in exactly one bit.
const boxEdges = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]

export interface Wireframe {
  faces: Scene // the glTF scene's triangle edges
  boxes(minDepth: number, maxDepth: number): Group // the boxes from `minDepth` to `maxDepth`, built where missing
  selection: Group // the selected triangle and the boxes above it, empty while nothing is selected
  setSelectedFace(selected: BvhHit | null): void
  selectionVersion(): number // goes up each time the selection changes, so a redraw can be skipped while it is the same
  dispose(): void
}

// The arrays that one set of box lines is written into.
interface BoxArrays {
  positions: Float32Array // 8 corners of xyz per box
  colors: Float32Array // an rgb color per corner
  indices: Uint32Array // `boxEdges.length` corner indices per box
}

// Writes the box in BVH node slot `slot` as box number `box` of `arrays`, in the hue that slot always takes.
function writeBox(nodes: Float32Array, slot: number, box: number, arrays: BoxArrays, color: Color) {
  const min = slot * numFloatsPerBvhNode + bvhNodeMinOffset
  const max = slot * numFloatsPerBvhNode + bvhNodeMaxOffset
  color.setHSL((slot * hueStep) % 1, 1, boxLightness)
  for (let corner = 0; corner < 8; ++corner) {
    const p = (box * 8 + corner) * 3
    arrays.positions[p] = nodes[corner & 1 ? max : min]
    arrays.positions[p + 1] = nodes[(corner & 2 ? max : min) + 1]
    arrays.positions[p + 2] = nodes[(corner & 4 ? max : min) + 2]
    color.toArray(arrays.colors, p)
  }
  boxEdges.forEach((corner, i) => {
    arrays.indices[box * boxEdges.length + i] = box * 8 + corner
  })
}

function boxArrays(count: number): BoxArrays {
  return {
    positions: new Float32Array(count * 8 * 3),
    colors: new Float32Array(count * 8 * 3),
    indices: new Uint32Array(count * boxEdges.length),
  }
}

function boxLines(arrays: BoxArrays, material: LineBasicMaterial): LineSegments {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(arrays.positions, 3))
  geometry.setAttribute('color', new BufferAttribute(arrays.colors, 3))
  geometry.setIndex(new BufferAttribute(arrays.indices, 1))
  return new LineSegments(geometry, material)
}

// Builds the line object for one BVH level from the node boxes in the BVH texture's data. The nodes at the level are
// counted first, so the level's arrays are allocated once at their final size.
function buildLevel(packed: PackedScene, depth: number, material: LineBasicMaterial): LineSegments {
  const nodes = packed.bvhTexture.image.data as Float32Array
  let count = 0
  packed.bvhNodeDepths.forEach(nodeDepth => {
    if (nodeDepth === depth) {
      ++count
    }
  })

  const arrays = boxArrays(count)
  const color = new Color()
  let box = 0
  packed.bvhNodeDepths.forEach((nodeDepth, slot) => {
    if (nodeDepth === depth) {
      writeBox(nodes, slot, box++, arrays, color)
    }
  })
  return boxLines(arrays, material)
}

// The BVH node slots from a face's leaf up to its mesh's root, the boxes a ray passes through to reach the face.
function ancestorSlots(packed: PackedScene, selected: BvhHit): number[] {
  const meshStart = selected.mesh * packed.maxNumBvhNodes
  const slots: number[] = []
  let node = selected.leaf
  while (node >= 0) {
    slots.push(meshStart + node)
    node = packed.bvhParents[meshStart + node]
  }
  return slots
}

export function createWireframe(packed: PackedScene): Wireframe {
  // The clone shares the glTF geometries and keeps each node's transform. The cached `gltf.scene` is left without a
  // new parent.
  const faceMaterial = new MeshBasicMaterial({
    color: faceColor,
    wireframe: true,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
  })
  const faces = new Scene()
  faces.overrideMaterial = faceMaterial
  faces.add(packed.root.clone())

  const boxMaterial = new LineBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
  })
  const boxes = new Group()
  const levels: (LineSegments | null)[] = new Array(packed.bvhDepth + 1).fill(null) // by depth, null until built

  // Shows the levels from `minDepth` to `maxDepth` and hides the rest, building any shown level for the first time.
  function showLevels(minDepth: number, maxDepth: number): Group {
    levels.forEach((level, depth) => {
      const shown = depth >= minDepth && depth <= maxDepth
      if (shown && !level) {
        level = buildLevel(packed, depth, boxMaterial)
        levels[depth] = level
        boxes.add(level)
      }
      if (level) {
        level.visible = shown
      }
    })
    return boxes
  }

  const selectedMaterial = new LineBasicMaterial({
    color: selectedFaceColor,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
  })
  const selection = new Group()
  let selectedKey = '' // the mesh and face shown in `selection`, so tapping the same triangle again rebuilds nothing
  let selectionVersion = 0

  // Replaces the selection group's lines with the selected triangle and its boxes, or empties it.
  function setSelectedFace(selected: BvhHit | null) {
    const key = selected ? `${selected.mesh}:${selected.face}` : ''
    if (key === selectedKey) {
      return
    }
    selectedKey = key
    ++selectionVersion

    selection.children.forEach(child => (child as LineSegments).geometry.dispose())
    selection.clear()
    if (!selected) {
      return
    }

    const slots = ancestorSlots(packed, selected)
    const arrays = boxArrays(slots.length)
    const nodes = packed.bvhTexture.image.data as Float32Array
    const color = new Color()
    slots.forEach((slot, box) => writeBox(nodes, slot, box, arrays, color))
    selection.add(boxLines(arrays, boxMaterial))

    const [a, b, c] = selected.corners
    const outline = new BufferGeometry().setFromPoints([a, b, b, c, c, a])
    selection.add(new LineSegments(outline, selectedMaterial))
  }

  return {
    faces,
    boxes: showLevels,
    selection,
    setSelectedFace,
    selectionVersion: () => selectionVersion,
    // The glTF geometries belong to the `useGLTF` cache, so only what this file made is freed.
    dispose: () => {
      faceMaterial.dispose()
      boxMaterial.dispose()
      selectedMaterial.dispose()
      boxes.children.forEach(child => (child as LineSegments).geometry.dispose())
      selection.children.forEach(child => (child as LineSegments).geometry.dispose())
    },
  }
}
