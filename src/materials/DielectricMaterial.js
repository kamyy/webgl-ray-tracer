// @flow
import Vector1x4 from '../math/Vector1x4.js';

export default class DielectricMaterial {
    id: string;
    albedo: Vector1x4;
    refractionIndex: number;

    constructor(id: string, albedo: Vector1x4, refractionIndex: number) {
        this.id = id;
        this.albedo = albedo;
        this.refractionIndex = refractionIndex;
    }
}
