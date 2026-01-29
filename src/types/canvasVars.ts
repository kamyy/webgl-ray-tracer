import { initialAppState } from '../lib/store/appSlice';
import CanvasShader from '../lib/webgl/canvasShader';
import ColorTextures from '../lib/webgl/colorTextures';
import RandomTexture from '../lib/webgl/randomTexture';
import SampleShader from '../lib/webgl/sampleShader';
import Scene from '../lib/webgl/scene';

export interface CanvasVars {
  canvasWd: number;
  canvasHt: number;

  cameraFov: number;
  numSamples: number;
  numBounces: number;
  shadingMethod: number;

  renderingPass: number;
  restartRenderTimestamp: number;

  x: number;
  y: number;
  lButtonDown: boolean;
  rButtonDown: boolean;
  lButtonDownOnCanvas: boolean;
  rButtonDownOnCanvas: boolean;
  TXYZ_SCALAR: number;
  RXYZ_SCALAR: number;

  GL: WebGL2RenderingContext | null;
  colorTextures: ColorTextures | null;
  randomTexture: RandomTexture | null;
  sampleShader: SampleShader | null;
  canvasShader: CanvasShader | null;
  scene: Scene | null;
}

export const defaultCanvasVars: Readonly<CanvasVars> = {
  canvasWd: 1280,
  canvasHt: 720,

  cameraFov: initialAppState.cameraFov,
  numSamples: initialAppState.numSamples,
  numBounces: initialAppState.numBounces,
  shadingMethod: initialAppState.shadingMethod,

  renderingPass: 0,
  restartRenderTimestamp: Date.now(),

  x: 0,
  y: 0,
  lButtonDown: false,
  rButtonDown: false,
  lButtonDownOnCanvas: false,
  rButtonDownOnCanvas: false,
  TXYZ_SCALAR: 0.01,
  RXYZ_SCALAR: 0.25,

  GL: null,
  colorTextures: null,
  randomTexture: null,
  sampleShader: null,
  canvasShader: null,
  scene: null,
};
