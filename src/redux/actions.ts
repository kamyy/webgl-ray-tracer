import Scene from "../texture/Scene.js";

export const SET_SCENE = "SET_SCENE";
export const SET_LOAD_STATUS = "SET_LOAD_STATUS";
export const SET_NUM_SAMPLES = "SET_NUM_SAMPLES";
export const SET_NUM_BOUNCES = "SET_NUM_BOUNCES";
export const SET_CAMERA_FOV = "SET_CAMERA_FOV";
export const SET_SHADING_METHOD = "SET_SHADING_METHOD";
export const SET_RENDERING_PASS = "SET_RENDERING_PASS";
export const SET_ELAPSED_TIME = "SET_ELAPSED_TIME";
export const SET_ETA_TIME = "SET_ETA_TIME";
export const SET_AVG_TIME = "SET_AVG_TIME";

export const SPINNER_SHOW = 0;
export const SPINNER_HIDE = 1;
export const LOAD_FAILURE = 2;

export const FLAT_SHADING = 0;
export const PHONG_SHADING = 1;

export interface setSceneResult {
  type: string;
  scene: Scene;
}
export function setScene(scene: Scene): setSceneResult {
  return { type: SET_SCENE, scene };
}

export interface setLoadStatusResult {
  type: string;
  loadStatus: number;
}
export function setLoadStatus(loadStatus: 0 | 1 | 2): setLoadStatusResult {
  return { type: SET_LOAD_STATUS, loadStatus };
}

export interface setNumSamplesResult {
  type: string;
  numSamples: number;
}
export function setNumSamples(numSamples: number): setNumSamplesResult {
  return { type: SET_NUM_SAMPLES, numSamples };
}

export interface setNumBouncesResult {
  type: string;
  numBounces: number;
}
export function setNumBounces(numBounces: number): setNumBouncesResult {
  return { type: SET_NUM_BOUNCES, numBounces };
}

export interface setCameraFovResult {
  type: string;
  cameraFov: number;
}
export function setCameraFov(cameraFov: number): setCameraFovResult {
  return { type: SET_CAMERA_FOV, cameraFov };
}

export interface setShadingMethodResult {
  type: string;
  shadingMethod: number;
}
export function setShadingMethod(shadingMethod: number): setShadingMethodResult {
  return { type: SET_SHADING_METHOD, shadingMethod };
}

export interface setRenderingPassResult {
  type: string;
  renderingPass: number;
}
export function setRenderingPass(renderingPass: number): setRenderingPassResult {
  return { type: SET_RENDERING_PASS, renderingPass };
}

export interface setElapsedTimeResult {
  type: string;
  elapsedTime: string;
}
export function setElapsedTime(elapsedTime: string): setElapsedTimeResult {
  return { type: SET_ELAPSED_TIME, elapsedTime };
}

export interface setEtaTimeResult {
  type: string;
  etaTime: string;
}
export function setEtaTime(etaTime: string): setEtaTimeResult {
  return { type: SET_ETA_TIME, etaTime };
}

export interface setAvgTimeResult {
  type: string;
  avgTime: string;
}
export function setAvgTime(avgTime: string): setAvgTimeResult {
  return { type: SET_AVG_TIME, avgTime };
}
