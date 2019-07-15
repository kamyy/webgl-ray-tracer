// @flow
export const SET_NUM_SAMPLES = 'SET_NUM_SAMPLES';
export const SET_NUM_BOUNCES = 'SET_NUM_BOUNCES';
export const SET_CAMERA_FOV  = 'SET_CAMERA_FOV';
export const SET_SHADING_METHOD = 'SET_SHADING_METHOD';
export const SET_RENDERING_PASS = 'SET_RENDERING_PASS';

export const FLAT_SHADING  = 0;
export const PHONG_SHADING = 1;

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