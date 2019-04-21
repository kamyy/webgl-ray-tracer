// @flow
import Vector1x4 from './Vector1x4.js';

export default class Sphere {
    _center:        Vector1x4;
    _radius:        number;
    _radiusSquared: number;

    constructor(center: Vector1x4, radius: number) {
        this._center        = center;
        this._radius        = radius;
        this._radiusSquared = radius * radius;
    }

    get center(): Vector1x4 {
        return this._center;
    }

    set center(center: Vector1x4) {
        this._center = center;
    }

    get radius(): number {
        return this._radius;
    }

    set radius(radius: number) {
        this._radius        = radius;
        this._radiusSquared = radius * radius;
    }

    get radiusSquared(): number {
        return this._radiusSquared;
    }
}
