// @flow
import Vector1x4 from '../Vector1x4.js';

export default class LambertianMaterial {
    attenuation: Vector1x4;

    constructor(attenuation: Vector1x4) {
        this.attenuation = attenuation;
    }
}
