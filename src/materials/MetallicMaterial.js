// @flow
import Vector1x4 from '../Vector1x4.js';
import Material from './Material.js';

export default class MetallicMaterial extends Material {
    fuzziness: number;

    constructor(albedo: Vector1x4, fuzziness: number) {
        super(albedo);
        this.fuzziness = fuzziness;
    }
}
