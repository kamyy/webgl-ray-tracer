// @flow
import Vector1x4 from '../Vector1x4.js';
import Material from './Material.js';

export default class LambertianMaterial extends Material {
    constructor(albedo: Vector1x4) {
        super(albedo);
    }
}
