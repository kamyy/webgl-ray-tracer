/**
 * Runs the path-tracing loop on a timer, and draws the display pass once per screen refresh.
 *
 * Tracing runs on a timer instead of the screen refresh, so a fast GPU is not held to one sample per refresh. The
 * display pass stays on the refresh, because the browser shows the canvas once per refresh. React Three Fiber draws
 * its own scene each frame unless a render callback has a priority above 0, so this hook's callback takes over the
 * drawing.
 */
import { useFrame } from '@react-three/fiber'
import { RefObject, useEffect } from 'react'
import { drawDisplayIfNeeded, idlePollMs, TracerInputs, TracerState, traceStep } from '../webgl/tracer'

const errorRetryMs = 1000 // how long the loop waits after a step throws

export function useTracingLoop(state: TracerState, inputs: TracerInputs | null, interactingRef: RefObject<boolean>) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      let delay = idlePollMs
      try {
        delay = inputs ? traceStep(state, inputs, interactingRef.current) : idlePollMs
      } catch (error) {
        // One failed draw does not stop the render for good. A step that keeps failing is retried slowly, so the
        // console is not flooded.
        console.error('A tracing step failed.', error)
        delay = errorRetryMs
      }
      timer = setTimeout(tick, delay)
    }
    tick()
    return () => clearTimeout(timer)
  }, [state, inputs, interactingRef])

  // The display pass runs once per screen refresh, however many samples were traced since the last one.
  useFrame(() => {
    if (inputs) {
      drawDisplayIfNeeded(state, inputs)
    }
  }, 1)
}
