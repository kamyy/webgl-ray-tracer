/**
 * Selects the triangle under a tap or click on the render, for the wireframe's selected-triangle filter.
 *
 * While the BVH boxes and the filter are both on, a tap casts a ray from the camera through the tapped point and walks
 * the scene's BVH with `raycastBvh`, which returns the triangle nearest the camera and the leaf box that holds it. The
 * wireframe shows that triangle and the boxes around it until another tap selects a different one. A tap on empty
 * space clears the selection. Turning the filter off clears it too.
 */
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Raycaster } from 'three'
import { useAppStore } from '../store/appStore'
import { raycastBvh } from '../webgl/bvhRaycast'
import type { PackedScene } from '../webgl/packScene'
import type { Wireframe } from '../webgl/wireframe'
import { useCanvasTap } from './useCanvasTap'

export function useSelectedFace(packed: PackedScene | null, wireframe: Wireframe | null) {
  const camera = useThree(state => state.camera)
  const active = useAppStore(state => state.showBvhWireframe && state.showSelectedBoxesOnly)
  const raycaster = useMemo(() => new Raycaster(), [])

  // A selection only lasts while the filter is on, so turning it off and on again starts empty.
  useEffect(() => {
    if (active) {
      return () => wireframe?.setSelectedFace(null)
    }
  }, [active, wireframe])

  useCanvasTap(point => {
    if (!packed || !wireframe) {
      return
    }

    raycaster.setFromCamera(point, camera)
    wireframe.setSelectedFace(raycastBvh(packed, raycaster.ray))
  }, active)
}
