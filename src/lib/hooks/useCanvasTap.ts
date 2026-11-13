/**
 * Calls a function when the render is tapped or clicked, with the point in normalized device coordinates.
 *
 * A press on the canvas is usually a camera drag, which `CameraControls` handles, so only a short, still press with
 * the primary button counts as a tap. The right and middle mouse buttons pan and zoom, and a touch or a pen always
 * reports the primary button. A press that takes part in a pinch is never a tap. The point is handed over in normalized
 * device coordinates, -1 to 1 across the canvas with y up, which is what three.js's `Raycaster.setFromCamera` takes.
 */
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector2 } from 'three'

const maxTapMovePx = 6 // a press that moves farther than this is a drag
const maxTapMs = 300 // a press held longer than this is a drag that has not moved yet

/** Calls `onTap` for each tap or click on the canvas while `enabled` is true. */
export function useCanvasTap(onTap: (point: Vector2) => void, enabled: boolean) {
  const canvas = useThree(state => state.gl.domElement)

  // The latest `onTap`, so a new function each render does not re-add the listeners.
  const onTapRef = useRef(onTap)
  useEffect(() => {
    onTapRef.current = onTap
  })

  useEffect(() => {
    if (!enabled) {
      return
    }

    const pressed = new Map<number, { x: number; y: number; at: number }>() // the pointers that are down, by id
    let multiTouch = false // set when a second pointer goes down, so lifting the first after a pinch is not a tap

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return
      }

      pressed.set(event.pointerId, { x: event.clientX, y: event.clientY, at: performance.now() })
      multiTouch = pressed.size > 1 || multiTouch
    }

    function onPointerUp(event: PointerEvent) {
      const start = pressed.get(event.pointerId)
      pressed.delete(event.pointerId)
      if (!start || multiTouch) {
        multiTouch = pressed.size > 0 && multiTouch
        return
      }

      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
      if (moved > maxTapMovePx || performance.now() - start.at > maxTapMs) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      onTapRef.current(
        new Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
      )
    }

    // The browser cancels a pointer that a system gesture takes over, often both fingers of a pinch at once. A pinch
    // ends once no pointer is left, or the next tap would still count as part of it.
    function onPointerCancel(event: PointerEvent) {
      pressed.delete(event.pointerId)
      if (pressed.size === 0) {
        multiTouch = false
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [canvas, enabled])
}
