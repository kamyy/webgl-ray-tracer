import { useCallback, useRef } from 'react';
import Vector1x4 from '../math/Vector1x4';
import { appActions, initialAppState, LoadingSpinner } from '../redux/appSlice';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import CanvasShader from '../scene/CanvasShader';
import ColorTextures from '../scene/ColorTextures';
import RandomTexture from '../scene/RandomTexture';
import SampleShader from '../scene/SampleShader';
import Scene, { SceneStatus } from '../scene/Scene';

export interface CanvasVars {
  lx: number;
  ly: number;
  canvasWd: number;
  canvasHt: number;

  cameraFov: number;
  numSamples: number;
  numBounces: number;
  shadingMethod: number;

  renderingPass: number;
  TXYZ_SCALAR: number;
  RXYZ_SCALAR: number;
  lButtonDown: boolean;
  rButtonDown: boolean;
  restartRenderTimestamp: number;

  GL: WebGL2RenderingContext | null;
  colorTextures: ColorTextures | null;
  randomTexture: RandomTexture | null;
  sampleShader: SampleShader | null;
  canvasShader: CanvasShader | null;
  scene: Scene | null;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180.0;
}

function GPU_MeetsRequirements(GL: WebGL2RenderingContext) {
  if (!GL.getExtension('EXT_color_buffer_float')) {
    console.log('EXT_color_buffer_float not supported');
    return false;
  }

  const MAX_ARRAY_TEXTURE_LAYERS = GL.getParameter(GL.MAX_ARRAY_TEXTURE_LAYERS);
  const MAX_TEXTURE_IMAGE_UNITS = GL.getParameter(GL.MAX_TEXTURE_IMAGE_UNITS);
  const MAX_RENDERBUFFER_SIZE = GL.getParameter(GL.MAX_RENDERBUFFER_SIZE);
  const MAX_TEXTURE_SIZE = GL.getParameter(GL.MAX_TEXTURE_SIZE);

  console.log(`MAX_ARRAY_TEXTURE_LAYERS = ${MAX_ARRAY_TEXTURE_LAYERS}`);
  console.log(`MAX_TEXTURE_IMAGE_UNITS = ${MAX_TEXTURE_IMAGE_UNITS}`);
  console.log(`MAX_RENDERBUFFER_SIZE = ${MAX_RENDERBUFFER_SIZE}`);
  console.log(`MAX_TEXTURE_SIZE = ${MAX_TEXTURE_SIZE}`);

  if (
    MAX_ARRAY_TEXTURE_LAYERS < 2048 ||
    MAX_TEXTURE_IMAGE_UNITS < 16 ||
    MAX_RENDERBUFFER_SIZE < 16384 ||
    MAX_TEXTURE_SIZE < 16384
  ) {
    return false;
  }

  return true;
}

interface CanvasProps {
  canvasWd: number;
  canvasHt: number;
}

export default function Canvas({ canvasWd, canvasHt }: CanvasProps) {
  const canvasVars = useRef<CanvasVars>({
    lx: 0,
    ly: 0,
    canvasWd,
    canvasHt,

    cameraFov: initialAppState.cameraFov,
    numSamples: initialAppState.numSamples,
    numBounces: initialAppState.numBounces,
    shadingMethod: initialAppState.shadingMethod,
    renderingPass: 0,
    TXYZ_SCALAR: 0.01,
    RXYZ_SCALAR: 0.25,
    lButtonDown: false,
    rButtonDown: false,
    restartRenderTimestamp: Date.now(),

    GL: null,
    colorTextures: null,
    randomTexture: null,
    sampleShader: null,
    canvasShader: null,
    scene: null,
  });
  const cv = canvasVars.current;

  const cameraFov = useAppSelector((state) => state.cameraFov);
  const numSamples = useAppSelector((state) => state.numSamples);
  const numBounces = useAppSelector((state) => state.numBounces);
  const shadingMethod = useAppSelector((state) => state.shadingMethod);
  const dispatch = useAppDispatch();

  const render = useCallback(() => {
    if (cv.scene?.status === SceneStatus.initialized && cv.renderingPass < cv.numSamples) {
      if (cv.renderingPass === 0 || (!cv.lButtonDown && !cv.rButtonDown)) {
        ++cv.renderingPass; // render 1st pass only if still moving camera around

        if (cv.GL && cv.sampleShader && cv.canvasShader) {
          cv.sampleShader.draw(cv);
          cv.canvasShader.draw(cv);
        }
        dispatch(appActions.setRenderingPass(cv.renderingPass));
      }
      if (cv.renderingPass > 0 /* prevents divide by zero */) {
        const durationMs = Date.now() - cv.restartRenderTimestamp;
        const avg = durationMs / cv.renderingPass;
        const eta = (cv.numSamples - cv.renderingPass) * avg;

        dispatch(appActions.setElapsedTime(new Date(durationMs).toISOString().slice(11, 19)));
        dispatch(appActions.setEtaTime(new Date(eta).toISOString().slice(11, 19)));
        dispatch(appActions.setAvgTime(`${avg.toFixed(0)}ms`));
      }
    }
    requestAnimationFrame(render);
  }, [cv, dispatch]);

  const resetRender = useCallback(() => {
    if (cv.GL) {
      cv.cameraFov = cameraFov;
      cv.numSamples = numSamples;
      cv.numBounces = numBounces;
      cv.shadingMethod = shadingMethod;
      cv.renderingPass = 0;
      cv.restartRenderTimestamp = Date.now();
      dispatch(appActions.setRenderingPass(0));
      dispatch(appActions.setElapsedTime('00:00:00'));
      dispatch(appActions.setEtaTime('??:??:??'));
      dispatch(appActions.setAvgTime('????'));
    }
  }, [cv, cameraFov, numSamples, numBounces, shadingMethod, dispatch]);

  const canvasRef = useCallback(
    (htmlCanvasElement: HTMLCanvasElement) => {
      function onMouseMove(event: MouseEvent) {
        if (cv.scene?.cameraNode && cv.scene?.parentNode) {
          const x = event.clientX;
          const y = event.clientY;

          if ((cv.lButtonDown && cv.rButtonDown) || (cv.lButtonDown && event.shiftKey)) {
            // dolly
            if (x !== cv.lx && cv.scene.cameraNode) {
              cv.scene.cameraNode.translate(new Vector1x4(0, (x - cv.lx) * cv.TXYZ_SCALAR, 0));
              cv.lx = x;
              cv.ly = y;
              resetRender();
            }
          } else if ((cv.lButtonDown && event.ctrlKey) || cv.rButtonDown) {
            // move
            if (x !== cv.lx || y !== cv.ly) {
              const dx = (cv.lx - x) * cv.TXYZ_SCALAR;
              const dz = (y - cv.ly) * cv.TXYZ_SCALAR;
              const dv = cv.scene.cameraNode.mapPos(new Vector1x4(dx, 0, dz, 0), cv.scene.parentNode);
              cv.scene.parentNode.translate(dv); // move parent in camera space
              cv.lx = x;
              cv.ly = y;
              resetRender();
            }
          } else if (cv.lButtonDown) {
            // rotate
            if (x !== cv.lx || y !== cv.ly) {
              cv.scene.parentNode.rotateZ(degreesToRadians(cv.lx - x) * cv.RXYZ_SCALAR); // yaw camera target around it's own z-axis
              cv.scene.cameraNode.rotateX(degreesToRadians(cv.ly - y) * cv.RXYZ_SCALAR, cv.scene.parentNode); // pitch around camera's parent x-axis
              cv.lx = x;
              cv.ly = y;
              resetRender();
            }
          }
        }
      }

      function onMouseDown(event: MouseEvent) {
        const rect = htmlCanvasElement.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;

        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
          switch (event.button) {
            case 0:
              cv.lButtonDown = true;
              break;
            case 2:
              cv.rButtonDown = true;
              break;
            default:
              break;
          }
          cv.lx = x;
          cv.ly = y;
        }
      }

      function onMouseUp(event: MouseEvent) {
        switch (event.button) {
          case 0:
            cv.lButtonDown = false;
            break;
          case 2:
            cv.rButtonDown = false;
            break;
          default:
            break;
        }
      }

      if (cv.GL) {
        resetRender();
      } else {
        cv.GL = htmlCanvasElement.getContext('webgl2', {
          depth: false,
          alpha: false,
        });

        if (cv.GL && GPU_MeetsRequirements(cv.GL)) {
          window.oncontextmenu = (e: MouseEvent) => e.preventDefault();
          window.onmousemove = onMouseMove;
          window.onmousedown = onMouseDown;
          window.onmouseup = onMouseUp;

          cv.colorTextures = new ColorTextures(cv.GL, canvasWd, canvasHt);
          cv.randomTexture = new RandomTexture(cv.GL, canvasWd, canvasHt);
          cv.sampleShader = new SampleShader(cv.GL);
          cv.canvasShader = new CanvasShader();

          Promise.all([
            cv.sampleShader.init(cv.GL, '/sample-vs.glsl', '/sample-fs.glsl'),
            cv.canvasShader.init(cv.GL, '/canvas-vs.glsl', '/canvas-fs.glsl'),
          ])
            .then(() => {
              dispatch(appActions.setLoadingSpinner(LoadingSpinner.show));
              cv.scene = new Scene(cv.GL, '/suzanne.obj', '/suzanne.mtl');
              return cv.scene.init();
            })
            .then(() => {
              dispatch(appActions.setLoadingSpinner(LoadingSpinner.hide));
              requestAnimationFrame(render);
            })
            .catch(() => {
              dispatch(appActions.setLoadingSpinner(LoadingSpinner.fail));
            });
        }
      }
    },
    [cv, canvasHt, canvasWd, render, resetRender, dispatch],
  );

  return (
    <canvas ref={canvasRef} width={canvasWd} height={canvasHt}>
      Please use a GPU and browser that supports WebGL 2
    </canvas>
  );
}
