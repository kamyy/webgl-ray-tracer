// @flow
export const SET_NUM_SAMPLES = 'SET_NUM_SAMPLES';
export const SET_NUM_BOUNCES = 'SET_NUM_BOUNCES';
export const SET_CAMERA_FOV  = 'SET_CAMERA_FOV';
export const SET_SHADING = 'SET_SHADING';

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

export function setShading(shading: FLAT_SHADING | PHONG_SHADING) {
    return { type: SET_SHADING, shading };
}
