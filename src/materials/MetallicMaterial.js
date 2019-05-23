// @flow
import Vector1x4 from '../Vector1x4.js';

export default class MetallicMateriall {
    attenuation: Vector1x4;
    shininess:   number;

    constructor(attenuation: Vector1x4, shininess: number) {
        this.attenuation = attenuation;
        this.shininess   = shininess;
    }
}
