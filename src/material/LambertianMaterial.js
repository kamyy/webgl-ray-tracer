// @flow
import Vector1x4 from '../math/Vector1x4.js';

export default class LambertianMaterial {
    id: string;
    albedo: Vector1x4;

    constructor(id: string, albedo: Vector1x4) {
        this.id = id;
        this.albedo = albedo;
    }
}
