// @flow
import Vector1x4 from './Vector1x4.js';

export default class Ray {
    _origin: Vector1x4;
    _dir:    Vector1x4;

    constructor(origin: Vector1x4, dir: Vector1x4) {
        this._origin = origin;
        this._dir    = dir;
    }

    get origin(): Vector1x4 {
        return this._origin;
    }

    set origin(v: Vector1x4) {
        this._origin = v;
    }

    get dir(): Vector1x4 {
        return this._dir;
    }

    set dir(v: Vector1x4) {
        this._dir = v;
    }

    getPos(t: number): Vector1x4 {
        return this._origin.add(this._dir.mul(t));
    }
}
