import React from "react";

import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import { css } from "@emotion/css";
import { createScenes } from "./SceneTabs.js";
import { SCENE_INITIALIZED } from "../texture/Scene.js";

import {
  setRenderingPass,
  setElapsedTime,
  setLoadStatus,
  setEtaTime,
  setAvgTime,
  LOAD_FAILURE,
} from "../redux/actions.js";

import Vector1x4 from "../math/Vector1x4.js";

import ColorTextures from "../texture/ColorTextures.js";
import RandomTexture from "../texture/RandomTexture.js";
import SampleShader from "../shader/SampleShader.js";
import CanvasShader from "../shader/CanvasShader.js";

import { reduxStore } from "../redux/reducers.js";

export const canvasWd = 1280;
export const canvasHt = 720;

interface CanvasProps {
  loadStatus: number;
  numSamples: number;
  numBounces: number;
  cameraFov: number;
  shadingMethod: number;

  setRenderingPass: (a: number) => void;
  setElapsedTime: (a: string) => void;
  setLoadStatus: (a: number) => void;
  setEtaTime: (a: string) => void;
  setAvgTime: (a: string) => void;
}

const cssCanvas = css`
  border-style: groove;
  border-width: thin;
`;

class Canvas extends React.Component<CanvasProps> {
  lx: number;
  ly: number;

  TXYZ_SCALAR: number;
  RXYZ_SCALAR: number;
  lButtonDown: boolean;
  rButtonDown: boolean;
  restartRenderTimestamp: number;

  canvas: HTMLCanvasElement;
  GL: WebGL2RenderingContext;
  colorTextures: ColorTextures;
  randomTexture: RandomTexture;
  sampleShader: SampleShader;
  canvasShader: CanvasShader;

  constructor(props: CanvasProps) {
    super(props);

    this.lx = 0;
    this.ly = 0;
    this.TXYZ_SCALAR = 0.01;
    this.RXYZ_SCALAR = 0.25;
    this.lButtonDown = false;
    this.rButtonDown = false;
  }

  render() {
    return (
      <canvas id="Canvas" className={cssCanvas} width={canvasWd} height={canvasHt}>
        Please use a GPU and browser that supports WebGL 2
      </canvas>
    );
  }

  refreshTimers() {
    const renderPass = reduxStore.getState().renderingPass;
    const { numSamples } = reduxStore.getState();

    if (renderPass > 1) {
      const durationMs = Date.now() - this.restartRenderTimestamp;
      const avg = durationMs / renderPass;
      const eta = (numSamples - renderPass) * avg;

      this.props.setElapsedTime(new Date(durationMs).toISOString().substr(11, 8));
      this.props.setEtaTime(new Date(eta).toISOString().substr(11, 8));
      this.props.setAvgTime(`${avg.toFixed(0)}ms`);
    }
  }

  restartTimers() {
    this.restartRenderTimestamp = Date.now();
    this.props.setElapsedTime("00:00:00");
    this.props.setEtaTime("??:??:??");
    this.props.setAvgTime("????");
  }

  restartRender() {
    if (this.GL) {
      this.props.setRenderingPass(0);
      this.restartTimers();
    }
  }

  executeRenderingPass() {
    requestAnimationFrame(() => {
      const { scene } = reduxStore.getState();

      if (scene && scene.sceneStatus === SCENE_INITIALIZED) {
        let renderPass = reduxStore.getState().renderingPass;
        const { numSamples } = reduxStore.getState();

        if (renderPass < numSamples) {
          if (renderPass === 0 || (!this.lButtonDown && !this.rButtonDown)) {
            // render 1st pass only if still moving camera around
            renderPass++;
            this.sampleShader.draw(this.GL, scene, renderPass, scene.cameraNode.modelMatrix);
            this.canvasShader.draw(this.GL, renderPass);
            this.props.setRenderingPass(renderPass);
          }
          this.refreshTimers();
        }
      }
      this.executeRenderingPass();
    });
  }

  GPU_MeetsRequirements() {
    const MAX_ARRAY_TEXTURE_LAYERS = this.GL.getParameter(this.GL.MAX_ARRAY_TEXTURE_LAYERS);
    const MAX_TEXTURE_IMAGE_UNITS = this.GL.getParameter(this.GL.MAX_TEXTURE_IMAGE_UNITS);
    const MAX_RENDERBUFFER_SIZE = this.GL.getParameter(this.GL.MAX_RENDERBUFFER_SIZE);
    const MAX_TEXTURE_SIZE = this.GL.getParameter(this.GL.MAX_TEXTURE_SIZE);

    console.log(`MAX_ARRAY_TEXTURE_LAYERS = ${MAX_ARRAY_TEXTURE_LAYERS}`);
    console.log(`MAX_TEXTURE_IMAGE_UNITS = ${MAX_TEXTURE_IMAGE_UNITS}`);
    console.log(`MAX_RENDERBUFFER_SIZE = ${MAX_RENDERBUFFER_SIZE}`);
    console.log(`MAX_TEXTURE_SIZE = ${MAX_TEXTURE_SIZE}`);

    if (!this.GL.getExtension("EXT_color_buffer_float")) {
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

  componentDidMount() {
    this.canvas = document.getElementById("Canvas") as HTMLCanvasElement;
    if (this.canvas instanceof HTMLCanvasElement) {
      this.GL = this.canvas.getContext("webgl2", {
        depth: false,
        alpha: false,
      });

      if (this.GL instanceof WebGL2RenderingContext && this.GPU_MeetsRequirements()) {
        this.canvas.oncontextmenu = (event) => event.preventDefault(); // disable right click context menu
        this.canvas.onmousedown = (e) => this.onMouseDown(e);
        window.onmousemove = (e) => this.onMouseMove(e);
        window.onmouseup = (e) => this.onMouseUp(e);

        this.colorTextures = new ColorTextures(this.GL, canvasWd, canvasHt);
        this.randomTexture = new RandomTexture(this.GL, canvasWd, canvasHt);

        this.sampleShader = new SampleShader(this.GL, this.colorTextures, this.randomTexture, canvasWd, canvasHt);
        this.canvasShader = new CanvasShader(this.colorTextures);

        Promise.all([
          this.sampleShader.init(this.GL, "/sample-vs.glsl", "/sample-fs.glsl"),
          this.canvasShader.init(this.GL, "/canvas-vs.glsl", "/canvas-fs.glsl"),
        ]).then(() => {
          this.executeRenderingPass();
          createScenes(this.GL);
        });
        return;
      }
      this.props.setLoadStatus(LOAD_FAILURE);
      this.GL = null;
    }
  }

  shouldComponentUpdate() {
    this.restartRender();
    return true;
  }

  degreesToRadians(degrees: number) {
    return (degrees * Math.PI) / 180.0;
  }

  onMouseUp(event: MouseEvent) {
    switch (event.button) {
      case 0:
        this.lButtonDown = false;
        break;
      case 2:
        this.rButtonDown = false;
        break;
      default:
        break;
    }
  }

  onMouseDown(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
      switch (event.button) {
        case 0:
          this.lButtonDown = true;
          break;
        case 2:
          this.rButtonDown = true;
          break;
        default:
          break;
      }
      this.lx = x;
      this.ly = y;
    }
  }

  onMouseMove(event: MouseEvent) {
    if (this.lButtonDown || this.rButtonDown) {
      const x = event.clientX;
      const y = event.clientY;
      const { scene } = reduxStore.getState();

      if ((this.lButtonDown && this.rButtonDown) || (this.lButtonDown && event.shiftKey)) {
        // dolly
        if (x !== this.lx) {
          scene.cameraNode.translate(new Vector1x4(0, (x - this.lx) * this.TXYZ_SCALAR, 0));
          this.lx = x;
          this.ly = y;
          this.restartRender();
        }
      } else if ((this.lButtonDown && event.ctrlKey) || this.rButtonDown) {
        // move
        if (x !== this.lx || y !== this.ly) {
          const dx = (this.lx - x) * this.TXYZ_SCALAR;
          const dz = (y - this.ly) * this.TXYZ_SCALAR;
          const dv = scene.cameraNode.mapPos(new Vector1x4(dx, 0, dz, 0), scene.parentNode);
          scene.parentNode.translate(dv); // move parent in camera space
          this.lx = x;
          this.ly = y;
          this.restartRender();
        }
      } else if (this.lButtonDown) {
        // rotate
        if (x !== this.lx || y !== this.ly) {
          scene.parentNode.rotateZ(this.degreesToRadians(this.lx - x) * this.RXYZ_SCALAR); // yaw camera target around it's own z-axis
          scene.cameraNode.rotateX(this.degreesToRadians(this.ly - y) * this.RXYZ_SCALAR, scene.parentNode); // pitch around camera's parent x-axis
          this.lx = x;
          this.ly = y;
          this.restartRender();
        }
      }
    }
  }
}

function mapStateToProps(state) {
  const props = {
    scene: state.scene,
    loadStatus: state.loadStatus,
    numSamples: state.numSamples,
    numBounces: state.numBounces,
    cameraFov: state.cameraFov,
    shadingMethod: state.shadingMethod,
  };
  return props;
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      setRenderingPass,
      setElapsedTime,
      setLoadStatus,
      setEtaTime,
      setAvgTime,
    },
    dispatch
  );
}

// triggers Canvas.shouldComponentUpdate() when redux state changes
export default connect(mapStateToProps, mapDispatchToProps)(Canvas);
