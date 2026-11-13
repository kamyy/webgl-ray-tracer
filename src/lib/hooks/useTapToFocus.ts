/**
 * Sets the focus distance to the surface under a tap or click on the render.
 *
 * The thin-lens camera keeps sharp only the surfaces at the focus distance, which is hard to judge on a slider. This
 * hook casts a ray from the camera through the tapped point and walks the scene's BVH with `raycastBvh` to find the
 * nearest surface. The new focus distance goes through the same delayed restart as the focus slider. A tap does
 * nothing while the lens radius is 0, and while the selected-triangle filter is on, where a tap selects a triangle.
 */
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { Raycaster } from 'three'
import { snapToRange } from '../scenes'
import { useAppStore } from '../store/appStore'
import { raycastBvh } from '../webgl/bvhRaycast'
import type { PackedScene } from '../webgl/packScene'
import { useCanvasTap } from './useCanvasTap'

export function useTapToFocus(packed: PackedScene) {
  const camera = useThree(state => state.camera)
  const selecting = useAppStore(state => state.showBvhWireframe && state.showSelectedBoxesOnly)
  const raycaster = useMemo(() => new Raycaster(), [])

  // Focuses on the nearest surface under the point, measured along the camera's -z axis, because the shader's focus
  // distance is the distance to a plane facing the camera, not along the ray. A pinhole camera, with a lens radius of
  // 0, keeps everything sharp, so a tap then changes nothing. A new focus distance would restart the render for an
  // identical image.
  useCanvasTap(point => {
    if (useAppStore.getState().lensRadius === 0) {
      return
    }

    raycaster.setFromCamera(point, camera)
    const hit = raycastBvh(packed, raycaster.ray)
    if (!hit) {
      return
    }

    const depth = -hit.point.applyMatrix4(camera.matrixWorldInverse).z
    const { focusRange, setFocusDistance } = useAppStore.getState()
    setFocusDistance(snapToRange(depth, focusRange))
  }, !selecting)
}
