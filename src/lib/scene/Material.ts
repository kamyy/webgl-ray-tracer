import Vector1x4 from "../math/Vector1x4";

export const EMISSIVE_MATERIAL = 0;
export const REFLECTIVE_MATERIAL = 1;
export const DIELECTRIC_MATERIAL = 2;

export default class Material {
  albedo: Vector1x4;
  mtlCls: 0 | 1 | 2;

  reflectionRatio: number; // rays reflected vs rays scattered
  reflectionGloss: number; // sharpness of reflection
  refractionIndex: number; // for dielectric material

  constructor(
    albedo: Vector1x4,
    mtlCls: 0 | 1 | 2 = REFLECTIVE_MATERIAL,
    reflectionRatio = 0.0,
    reflectionGloss = 1.0,
    refractionIndex = 1.0
  ) {
    this.albedo = albedo;
    this.mtlCls = mtlCls;
    this.reflectionRatio = reflectionRatio;
    this.reflectionGloss = reflectionGloss;
    this.refractionIndex = refractionIndex;
  }
}
