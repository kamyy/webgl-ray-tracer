// @flow
import Vector1x4 from '../math/Vector1x4.js';

export const EMISSIVE_MATERIAL = 0;
export const METALLIC_MATERIAL = 1;
export const LAMBERTIAN_MATERIAL = 2;
export const DIELECTRIC_MATERIAL = 3;

export default class Material {
    albedo: Vector1x4;
    mtlCls: 0 | 1 | 2 | 3;
    reflectionGloss: number;
    refractionIndex: number;

    constructor(
        albedo: Vector1x4,
        mtlCls: 0 | 1 | 2 | 3 = LAMBERTIAN_MATERIAL,
        reflectionGloss: number = 1.0,
        refractionIndex: number = 1.0,
    ) {
        this.albedo = albedo;
        this.mtlCls = mtlCls;
        this.reflectionGloss = reflectionGloss;
        this.refractionIndex = refractionIndex;
    }
}
