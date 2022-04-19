import { css } from "@emotion/css";
import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import Vector1x4 from "../math/Vector1x4";
import {
  LOAD_FAILURE,
  setAvgTime,
  setElapsedTime,
  setEtaTime,
  setLoadStatus,
  setRenderingPass,
} from "../redux/actions";
import { reduxStore, RootState } from "../redux/reducers";
import CanvasShader from "../shader/CanvasShader";
import SampleShader from "../shader/SampleShader";
import ColorTextures from "../texture/ColorTextures";
import RandomTexture from "../texture/RandomTexture";
import { SCENE_INITIALIZED } from "../texture/Scene";
import { createScenes } from "./SceneTabs";

export const canvasWd = 1280;
export const canvasHt = 720;

const cssCanvas = css`
  border-style: groove;
  border-width: thin;
`;

interface CanvasState {
  lx: number;
  ly: number;

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
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180.0;
}

export default function Canvas(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<CanvasState>({
    lx: 0,
    ly: 0,
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
  });

  const dispatch = useDispatch();
  const cameraFov = useSelector((state: RootState) => state.cameraFov);
  const numSamples = useSelector((state: RootState) => state.numSamples);
  const numBounces = useSelector((state: RootState) => state.numBounces);
  const shadingMethod = useSelector((state: RootState) => state.shadingMethod);

  function GPU_MeetsRequirements() {
    if (state.current.GL) {
      const MAX_ARRAY_TEXTURE_LAYERS = state.current.GL.getParameter(state.current.GL.MAX_ARRAY_TEXTURE_LAYERS);
      const MAX_TEXTURE_IMAGE_UNITS = state.current.GL.getParameter(state.current.GL.MAX_TEXTURE_IMAGE_UNITS);
      const MAX_RENDERBUFFER_SIZE = state.current.GL.getParameter(state.current.GL.MAX_RENDERBUFFER_SIZE);
      const MAX_TEXTURE_SIZE = state.current.GL.getParameter(state.current.GL.MAX_TEXTURE_SIZE);

      console.log(`MAX_ARRAY_TEXTURE_LAYERS = ${MAX_ARRAY_TEXTURE_LAYERS}`);
      console.log(`MAX_TEXTURE_IMAGE_UNITS = ${MAX_TEXTURE_IMAGE_UNITS}`);
      console.log(`MAX_RENDERBUFFER_SIZE = ${MAX_RENDERBUFFER_SIZE}`);
      console.log(`MAX_TEXTURE_SIZE = ${MAX_TEXTURE_SIZE}`);

      if (!state.current.GL.getExtension("EXT_color_buffer_float")) {
        console.log("EXT_color_buffer_float not supported");
        return false;
      }
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

    return false;
  }

  function restartRender() {
    if (state.current.GL) {
      state.current.restartRenderTimestamp = Date.now();
      state.current.renderingPass = 0;
      dispatch(setRenderingPass(0));
      dispatch(setElapsedTime("00:00:00"));
      dispatch(setEtaTime("??:??:??"));
      dispatch(setAvgTime("????"));
    }
  }

  function onMouseDown(event: MouseEvent) {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;

      if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
        switch (event.button) {
          case 0:
            state.current.lButtonDown = true;
            break;
          case 2:
            state.current.rButtonDown = true;
            break;
          default:
            break;
        }
        state.current.lx = x;
        state.current.ly = y;
      }
    }
  }

  function onMouseMove(event: MouseEvent) {
    const { scene } = reduxStore.getState();

    if (scene && (state.current.lButtonDown || state.current.rButtonDown)) {
      const x = event.clientX;
      const y = event.clientY;

      if ((state.current.lButtonDown && state.current.rButtonDown) || (state.current.lButtonDown && event.shiftKey)) {
        // dolly
        if (x !== state.current.lx) {
          scene.cameraNode.translate(new Vector1x4(0, (x - state.current.lx) * state.current.TXYZ_SCALAR, 0));
          state.current.lx = x;
          state.current.ly = y;
          restartRender();
        }
      } else if ((state.current.lButtonDown && event.ctrlKey) || state.current.rButtonDown) {
        // move
        if (x !== state.current.lx || y !== state.current.ly) {
          const dx = (state.current.lx - x) * state.current.TXYZ_SCALAR;
          const dz = (y - state.current.ly) * state.current.TXYZ_SCALAR;
          const dv = scene.cameraNode.mapPos(new Vector1x4(dx, 0, dz, 0), scene.parentNode);
          scene.parentNode.translate(dv); // move parent in camera space
          state.current.lx = x;
          state.current.ly = y;
          restartRender();
        }
      } else if (state.current.lButtonDown) {
        // rotate
        if (x !== state.current.lx || y !== state.current.ly) {
          scene.parentNode.rotateZ(degreesToRadians(state.current.lx - x) * state.current.RXYZ_SCALAR); // yaw camera target around it's own z-axis
          scene.cameraNode.rotateX(
            degreesToRadians(state.current.ly - y) * state.current.RXYZ_SCALAR,
            scene.parentNode
          ); // pitch around camera's parent x-axis
          state.current.lx = x;
          state.current.ly = y;
          restartRender();
        }
      }
    }
  }

  function onMouseUp(event: MouseEvent) {
    switch (event.button) {
      case 0:
        state.current.lButtonDown = false;
        break;
      case 2:
        state.current.rButtonDown = false;
        break;
      default:
        break;
    }
  }

  function renderScene() {
    requestAnimationFrame(() => {
      const { scene, numSamples } = reduxStore.getState();

      if (scene?.sceneStatus === SCENE_INITIALIZED && state.current.renderingPass < numSamples) {
        if (state.current.renderingPass === 0 || (!state.current.lButtonDown && !state.current.rButtonDown)) {
          ++state.current.renderingPass; // render 1st pass only if still moving camera around

          if (state.current.GL && state.current.sampleShader && state.current.canvasShader) {
            state.current.sampleShader.draw(
              state.current.GL,
              scene,
              state.current.renderingPass,
              scene.cameraNode.modelMatrix
            );
            state.current.canvasShader.draw(state.current.GL, state.current.renderingPass);
          }
          dispatch(setRenderingPass(state.current.renderingPass));
        }

        if (state.current.renderingPass > 1) {
          const durationMs = Date.now() - state.current.restartRenderTimestamp;
          const avg = durationMs / state.current.renderingPass;
          const eta = (numSamples - state.current.renderingPass) * avg;

          dispatch(setElapsedTime(new Date(durationMs).toISOString().substr(11, 8)));
          dispatch(setEtaTime(new Date(eta).toISOString().substr(11, 8)));
          dispatch(setAvgTime(`${avg.toFixed(0)}ms`));
        }
      }

      renderScene();
    });
  }

  useEffect(() => {
    if (canvasRef.current instanceof HTMLCanvasElement) {
      state.current.GL = canvasRef.current.getContext("webgl2", {
        depth: false,
        alpha: false,
      });

      if (state.current.GL instanceof WebGL2RenderingContext && GPU_MeetsRequirements()) {
        canvasRef.current.oncontextmenu = (event) => event.preventDefault(); // disable right click context menu
        canvasRef.current.onmousedown = (e) => onMouseDown(e);
        window.onmousemove = (e) => onMouseMove(e);
        window.onmouseup = (e) => onMouseUp(e);

        state.current.colorTextures = new ColorTextures(state.current.GL, canvasWd, canvasHt);
        state.current.randomTexture = new RandomTexture(state.current.GL, canvasWd, canvasHt);

        state.current.sampleShader = new SampleShader(
          state.current.GL,
          state.current.colorTextures,
          state.current.randomTexture,
          canvasWd,
          canvasHt
        );
        state.current.canvasShader = new CanvasShader(state.current.colorTextures);

        Promise.all([
          state.current.sampleShader.init(state.current.GL, "/sample-vs.glsl", "/sample-fs.glsl"),
          state.current.canvasShader.init(state.current.GL, "/canvas-vs.glsl", "/canvas-fs.glsl"),
        ]).then(() => {
          if (state.current.GL) {
            createScenes(state.current.GL);
            renderScene();
          }
        });
      } else {
        dispatch(setLoadStatus(LOAD_FAILURE));
        state.current.GL = null;
      }
    }
  }, [canvasRef.current]);

  useEffect(() => {
    restartRender();
  }, [cameraFov, numSamples, numBounces, shadingMethod]);

  return (
    <canvas ref={canvasRef} id="Canvas" className={cssCanvas} width={canvasWd} height={canvasHt}>
      Please use a GPU and browser that supports WebGL 2
    </canvas>
  );
}
