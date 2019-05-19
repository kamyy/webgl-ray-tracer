
// @flow
import Vector1x4 from './Vector1x4.js';

export const MATERIAL_TYPE = {
    MATTE: 0,
    METAL: 1
}

export default class Material {
    typeOf: number;
    albedo: Vector1x4;

    constructor(typeOf: 0 | 1, albedo: Vector1x4) {
        this.typeOf = typeOf;
        this.albedo = albedo;
    }
}
