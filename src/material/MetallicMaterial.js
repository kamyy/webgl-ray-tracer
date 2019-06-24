// @flow
import Vector1x4 from '../math/Vector1x4.js';

export default class MetallicMaterial {
    id: string;
    albedo: Vector1x4;
    shininess: number;

    constructor(id: string, albedo: Vector1x4, shininess: number) {
        this.id = id;
        this.albedo = albedo;
        this.shininess = shininess;
    }
}
