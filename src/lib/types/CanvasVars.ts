import { initialAppState } from '../redux/appSlice';
import CanvasShader from '../scene/CanvasShader';
import ColorTextures from '../scene/ColorTextures';
import RandomTexture from '../scene/RandomTexture';
import SampleShader from '../scene/SampleShader';
import Scene from '../scene/Scene';

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
