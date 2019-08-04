import Vector1x4 from '../math/Vector1x4';

export enum MaterialType {
    EMISSIVE = 0,
    REFLECTIVE = 1,
    DIELECTRIC = 2,
}

export default class Material {
    albedo: Vector1x4;
    mtlCls: MaterialType;
    reflectionRatio: number; // rays reflected vs rays scattered
    reflectionGloss: number; // sharpness of reflection
    refractionIndex: number; // for dielectric material

    constructor(
        albedo: Vector1x4,
        mtlCls: MaterialType = MaterialType.REFLECTIVE,
        reflectionRatio: number = 0.0,
        reflectionGloss: number = 1.0,
        refractionIndex: number = 1.0,
    ) {
        this.albedo = albedo;
        this.mtlCls = mtlCls;
        this.reflectionRatio = reflectionRatio;
        this.reflectionGloss = reflectionGloss;
        this.refractionIndex = refractionIndex;
    }
}
