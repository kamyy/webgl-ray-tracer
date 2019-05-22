// @flow
import Vector1x4 from '../Vector1x4.js';

export default class Material {
    albedo: Vector1x4;

    constructor(albedo: Vector1x4) {
        this.albedo = albedo;
    }
}
