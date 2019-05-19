// @flow
import Vector1x4 from './Vector1x4.js'

export const CREATE_SPHERE = 'CREATE_SPHERE';
export const REMOVE_SPHERE = 'REMOVE_SPHERE';
export const CREATE_MATERIAL = 'CREATE_MATERIAL';
export const REMOVE_MATERIAL = 'REMOVE_MATERIAL';

export const MATERIAL_TYPE_MATTE = 0;
export const MATERIAL_TYPE_METAL = 1;

export function createSphere(center: Vector1x4, radius: number) {
    return { type: CREATE_SPHERE, center, radius, }
}

export function removeSphere(id: number) {
    return { type: REMOVE_SPHERE, id }
}

export function createMaterial(
    materialType: 0 | 1,
    r: number, 
    g: number, 
    b: number) {
    return { type: CREATE_MATERIAL, materialType, r, g, b };
}

export function removeMaterial(id: number) {
    return { type: REMOVE_MATERIAL, id }
}
