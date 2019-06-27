// @flow
import Vector1x4 from '../math/Vector1x4.js';

export const METALLIC_MATERIAL_CLASS = 0;
export const LAMBERTIAN_MATERIAL_CLASS = 1;
export const DIELECTRIC_MATERIAL_CLASS = 2;

export default class Material {
    materialClass: number;
    id:            string;
    albedo:        Vector1x4;
    shininess:     number;
    refractionIdx: number;

    constructor(materialClass: number, id: string, albedo: Vector1x4, shininess: number = 0.0, refractionIdx: number = 1.0) {
        this.materialClass = materialClass;
        this.id            = id;
        this.albedo        = albedo;
        this.shininess     = shininess;
        this.refractionIdx = refractionIdx;
    }
}
