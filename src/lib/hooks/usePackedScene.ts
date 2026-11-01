/**
 * Suspends until a loaded glTF scene has been packed into shader textures.
 *
 * Packing waits for the BVH worker, so it is asynchronous. The hook caches one promise per scene object and reads it
 * with React's `use`, which lets the nearest `<Suspense>` boundary show its fallback until the textures are ready.
 */
import { use } from 'react'
import type { Object3D } from 'three'
import { packScene, type PackedScene } from '../webgl/packScene'

const packedScenes = new WeakMap<Object3D, Promise<PackedScene>>()

export function usePackedScene(root: Object3D): PackedScene {
  let packed = packedScenes.get(root)
  if (!packed) {
    packed = packScene(root)
    packedScenes.set(root, packed)
  }

  return use(packed)
}
