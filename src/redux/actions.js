// @flow

import Scene from '../texture/Scene.js';

export const SET_SCENE = 'SET_SCENE';
export const SET_LOAD_STATUS = 'SET_LOAD_STATUS';
export const SET_NUM_SAMPLES = 'SET_NUM_SAMPLES';
export const SET_NUM_BOUNCES = 'SET_NUM_BOUNCES';
export const SET_CAMERA_FOV  = 'SET_CAMERA_FOV';
export const SET_SHADING_METHOD = 'SET_SHADING_METHOD';
export const SET_RENDERING_PASS = 'SET_RENDERING_PASS';
export const SET_ELAPSED_TIME = 'SET_ELAPSED_TIME';
export const SET_ETA_TIME = 'SET_ETA_TIME';
export const SET_AVG_TIME = 'SET_AVG_TIME';

export const SPINNER_SHOW = 0;
export const SPINNER_HIDE = 1;
export const LOAD_FAILURE = 2;

export const FLAT_SHADING  = 0;
export const PHONG_SHADING = 1;

export function setScene(scene: Scene) {
    return { type: SET_SCENE, scene };
}

export function setLoadStatus(loadStatus: 0 | 1 | 2) {
    return { type: SET_LOAD_STATUS, loadStatus };
}

export function setNumSamples(numSamples: number) {
    return { type: SET_NUM_SAMPLES, numSamples };
}

export function setNumBounces(numBounces: number) {
    return { type: SET_NUM_BOUNCES, numBounces };
}

export function setCameraFov(cameraFov: number) {
    return { type: SET_CAMERA_FOV, cameraFov };
}

export function setShadingMethod(shadingMethod: 0 | 1) {
    return { type: SET_SHADING_METHOD, shadingMethod };
}

export function setRenderingPass(renderingPass: number) {
    return { type: SET_RENDERING_PASS, renderingPass };
}

export function setElapsedTime(elapsedTime: number) {
    return { type: SET_ELAPSED_TIME, elapsedTime };
}

export function setEtaTime(etaTime: number) {
    return { type: SET_ETA_TIME, etaTime };
}

export function setAvgTime(avgTime: number) {
    return { type: SET_AVG_TIME, avgTime };
}
