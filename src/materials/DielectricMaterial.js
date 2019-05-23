// @flow
import Vector1x4 from '../Vector1x4.js';

export default class DielectricMaterial {
    attenuation:     Vector1x4;
    refractionIndex: number;

    constructor(attenuation: Vector1x4, refractionIndex: number) {
        this.attenuation     = attenuation;
        this.refractionIndex = refractionIndex;
    }
}
