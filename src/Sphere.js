// @flow
import Vector1x4 from './Vector1x4.js';

export default class Sphere {
    center:        Vector1x4;
    radius:        number;

    constructor(center: Vector1x4, radius: number) {
        this.center = center;
        this.radius = radius;
    }

    get radiusSquared(): number {
        return this.radius * this.radius;
    }
}
