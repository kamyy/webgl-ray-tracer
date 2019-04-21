// @flow
import Vector1x4 from './Vector1x4.js';
import Ray from './Ray.js'

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

    hitTest(ray: Ray): boolean {
        const l = ray.origin.sub(this._center);
        const a = ray.dir.dot(ray.dir);
        const b = ray.dir.dot(l) * 2;
        const c = l.dot(l) - this._radiusSquared;
        const discriminant = (b * b) - (4 * a * c);

        return (discriminant > 0);
    }
}
