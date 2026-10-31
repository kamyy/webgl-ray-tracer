import { useCallback, useEffect, useRef } from 'react'
import { shallow } from 'zustand/shallow'
import Vector1x4 from '../lib/math/vector1x4'
import { LoadingSpinner, useAppStore } from '../lib/store/appStore'
import CanvasShader from '../lib/webgl/canvasShader'
import ColorTextures from '../lib/webgl/colorTextures'
import RandomTexture from '../lib/webgl/randomTexture'
import SampleShader from '../lib/webgl/sampleShader'
import Scene from '../lib/webgl/scene'
import displayFragmentShader from '../shaders/display.frag.glsl?raw'
import displayVertexShader from '../shaders/display.vert.glsl?raw'
import pathTraceFragmentShader from '../shaders/pathTrace.frag.glsl?raw'
import pathTraceVertexShader from '../shaders/pathTrace.vert.glsl?raw'
import { CanvasVars, defaultCanvasVars } from '../types/canvasVars'

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180.0
}

function renderReset(cv: CanvasVars) {
  cv.renderingPass = 0
  cv.restartRenderTimestamp = Date.now()
  useAppStore.getState().resetStatus()
}

function checkGpuLimits(gl: WebGL2RenderingContext) {
  if (!gl.getExtension('EXT_color_buffer_float')) {
    console.log('EXT_color_buffer_float not supported')
    return false
  }

  const MAX_ARRAY_TEXTURE_LAYERS = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)
  const MAX_TEXTURE_IMAGE_UNITS = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
  const MAX_RENDERBUFFER_SIZE = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)
  const MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE)

  console.log(`MAX_ARRAY_TEXTURE_LAYERS = ${MAX_ARRAY_TEXTURE_LAYERS}`)
  console.log(`MAX_TEXTURE_IMAGE_UNITS = ${MAX_TEXTURE_IMAGE_UNITS}`)
  console.log(`MAX_RENDERBUFFER_SIZE = ${MAX_RENDERBUFFER_SIZE}`)
  console.log(`MAX_TEXTURE_SIZE = ${MAX_TEXTURE_SIZE}`)

  if (
    MAX_ARRAY_TEXTURE_LAYERS < 2048 ||
    MAX_TEXTURE_IMAGE_UNITS < 16 ||
    MAX_RENDERBUFFER_SIZE < 16384 ||
    MAX_TEXTURE_SIZE < 16384
  ) {
    return false
  }

  return true
}

export default function Canvas() {
  const loadingSpinner = useAppStore(state => state.loadingSpinner)
  const cvRef = useRef<CanvasVars>({ ...defaultCanvasVars })

  useEffect(() => {
    const cv = cvRef.current
    renderReset(cv)

    // Any setting that changes the image restarts accumulation at pass 0.
    return useAppStore.subscribe(
      state => [state.cameraFov, state.numSamples, state.numBounces, state.shadingMethod],
      () => renderReset(cv),
      { equalityFn: shallow },
    )
  }, [])

  const canvasCb = useCallback((htmlCanvasElement: HTMLCanvasElement) => {
    const cv = cvRef.current
    function render() {
      const { numSamples } = useAppStore.getState()
      if (cv.renderingPass < numSamples) {
        if (cv.renderingPass === 0 || (!cv.lButtonDown && !cv.mButtonDown && !cv.rButtonDown)) {
          ++cv.renderingPass // always render pass 0 even if a mouse button is down

          if (cv.sampleShader && cv.canvasShader) {
            cv.sampleShader.draw(cv)
            cv.canvasShader.draw(cv)
          }

          const elapsed = Date.now() - cv.restartRenderTimestamp
          const average = elapsed / cv.renderingPass
          const eta = (numSamples - cv.renderingPass) * average

          useAppStore.getState().setStatus({
            renderingPass: cv.renderingPass,
            elapsedTime: new Date(elapsed).toISOString().slice(11, 19),
            etaTime: new Date(eta).toISOString().slice(11, 19),
            avgTime: `${average.toFixed(0)}ms`,
          })
        }
      }
      requestAnimationFrame(render)
    }

    function dollyCamera(delta: number) {
      if (delta !== 0 && cv.scene?.cameraNode) {
        cv.scene.cameraNode.translate(new Vector1x4(0, delta * cv.TXYZ_SCALAR, 0))
        renderReset(cv)
      }
    }

    function onMouseMove(event: MouseEvent) {
      if (cv.scene?.cameraNode && cv.scene?.parentNode) {
        const x = event.clientX
        const y = event.clientY

        if (cv.mButtonDownOnCanvas) {
          dollyCamera(cv.y - y)
        } else if ((cv.lButtonDownOnCanvas && event.ctrlKey) || cv.rButtonDownOnCanvas) {
          // move
          if (x !== cv.x || y !== cv.y) {
            const dx = (cv.x - x) * cv.TXYZ_SCALAR
            const dz = (y - cv.y) * cv.TXYZ_SCALAR
            const dv = cv.scene.cameraNode.mapPos(new Vector1x4(dx, 0, dz, 0), cv.scene.parentNode)
            cv.scene.parentNode.translate(dv) // move parent in camera space
            renderReset(cv)
          }
        } else if (cv.lButtonDownOnCanvas) {
          // rotate
          if (x !== cv.x || y !== cv.y) {
            cv.scene.parentNode.rotateZ(degreesToRadians(cv.x - x) * cv.RXYZ_SCALAR) // yaw camera target around it's own z-axis
            cv.scene.cameraNode.rotateX(degreesToRadians(cv.y - y) * cv.RXYZ_SCALAR, cv.scene.parentNode) // pitch around camera's parent x-axis
            renderReset(cv)
          }
        }
        cv.x = x
        cv.y = y
      }
    }

    function onMouseWheel(event: WheelEvent) {
      if (cv.scene?.cameraNode) {
        event.preventDefault()
        dollyCamera(-event.deltaY * 0.25)
      }
    }

    function onMouseDown(event: MouseEvent) {
      const rect = htmlCanvasElement.getBoundingClientRect()
      cv.x = event.clientX
      cv.y = event.clientY
      const onCanvas = cv.x > rect.left && cv.x < rect.right && cv.y > rect.top && cv.y < rect.bottom

      switch (event.button) {
        case 0:
          cv.lButtonDown = true
          cv.lButtonDownOnCanvas = onCanvas
          break
        case 1:
          if (onCanvas) {
            event.preventDefault()
          }
          cv.mButtonDown = true
          cv.mButtonDownOnCanvas = onCanvas
          break
        case 2:
          cv.rButtonDown = true
          cv.rButtonDownOnCanvas = onCanvas
          break
        default:
          break
      }
    }

    function onMouseUp(event: MouseEvent) {
      switch (event.button) {
        case 0:
          cv.lButtonDown = false
          cv.lButtonDownOnCanvas = false
          break
        case 1:
          cv.mButtonDown = false
          cv.mButtonDownOnCanvas = false
          break
        case 2:
          cv.rButtonDown = false
          cv.rButtonDownOnCanvas = false
          break
        default:
          break
      }
    }

    if (!cv.gl) {
      cv.gl = htmlCanvasElement.getContext('webgl2', {
        depth: false,
        alpha: false,
      })

      if (cv.gl && checkGpuLimits(cv.gl)) {
        window.oncontextmenu = (e: MouseEvent) => e.preventDefault()
        window.onmousemove = onMouseMove
        window.onmousedown = onMouseDown
        window.onmouseup = onMouseUp
        htmlCanvasElement.onwheel = onMouseWheel

        const gl = cv.gl
        const sampleShader = new SampleShader(gl)
        const canvasShader = new CanvasShader()
        cv.colorTextures = new ColorTextures(gl, cv.canvasWd, cv.canvasHt)
        cv.randomTexture = new RandomTexture(gl, cv.canvasWd, cv.canvasHt)
        cv.sampleShader = sampleShader
        cv.canvasShader = canvasShader

        Promise.resolve()
          .then(() => {
            sampleShader.init(gl, pathTraceVertexShader, pathTraceFragmentShader)
            canvasShader.init(gl, displayVertexShader, displayFragmentShader)
            useAppStore.getState().setLoadingSpinner(LoadingSpinner.show)
            cv.scene = new Scene(gl, '/suzanne.obj', '/suzanne.mtl')
            return cv.scene.init()
          })
          .then(() => {
            useAppStore.getState().setLoadingSpinner(LoadingSpinner.hide)
            requestAnimationFrame(render)
          })
          .catch(() => {
            useAppStore.getState().setLoadingSpinner(LoadingSpinner.fail)
          })
      }
    }
  }, [])

  return (
    <>
      {loadingSpinner === LoadingSpinner.show && (
        <div className="absolute top-[28%] left-1/2 m-auto h-3 w-3 animate-spin rounded-full border-[16px] border-t-[blue] border-r-[green] border-b-[red] border-l-[yellow]" />
      )}
      <canvas ref={canvasCb} width={defaultCanvasVars.canvasWd} height={defaultCanvasVars.canvasHt}>
        Please use a GPU and browser that supports WebGL 2
      </canvas>
    </>
  )
}
