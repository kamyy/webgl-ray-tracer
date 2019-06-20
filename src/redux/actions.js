// @flow
export const SET_NUM_SAMPLES = 'SET_NUM_SAMPLES';
export const SET_NUM_BOUNCES = 'SET_NUM_BOUNCES';
export const SET_CAMERA_FOV  = 'SET_CAMERA_FOV';

export function setNumSamples(numSamples: number) {
    return { type: SET_NUM_SAMPLES, numSamples };
}

export function setNumBounces(numBounces: number) {
    return { type: SET_NUM_BOUNCES, numBounces };
}

export function setCameraFov(cameraFov: number) {
    return { type: SET_CAMERA_FOV, cameraFov };
}
