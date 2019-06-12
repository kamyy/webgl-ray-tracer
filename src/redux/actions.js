// @flow
import Vector1x4 from '../math/Vector1x4.js';

export const SET_NUM_SAMPLES = 'SET_NUM_SAMPLES';
export const SET_NUM_BOUNCES = 'SET_NUM_BOUNCES';
export const SET_CAMERA_FOV  = 'SET_CAMERA_FOV';

export const CREATE_MATERIAL = 'CREATE_MATERIAL';
export const REMOVE_MATERIAL = 'REMOVE_MATERIAL';

export const CREATE_SPHERE = 'CREATE_SPHERE';
export const REMOVE_SPHERE = 'REMOVE_SPHERE';

export const INSERT_SCENE = 'INSERT_SCENE';
export const CHANGE_SCENE = 'CHANGE_SCENE';

export function setNumSamples(numSamples: number) {
    return { type: SET_NUM_SAMPLES, numSamples };
}

export function setNumBounces(numBounces: number) {
    return { type: SET_NUM_BOUNCES, numBounces };
}

export function setCameraFov(cameraFov: number) {
    return { type: SET_CAMERA_FOV, cameraFov };
}

export function createMaterial(
    materialClass: 0 | 1 | 2,
    r: number, 
    g: number, 
    b: number) {
    return { type: CREATE_MATERIAL, materialClass, r, g, b };
}

export function createSphere(id: string, center: Vector1x4, radius: number, materialId: string) {
    return { type: CREATE_SPHERE, id, center, radius, materialId }
}

export function insertScene(id: string, scene: Object) {
    return { type: INSERT_SCENE, id, scene };
}

export function changeScene(id: string) {
    return { type: CHANGE_SCENE, id };
}
