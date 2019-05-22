// @flow
import Matrix4x4, {
    _00, _01, _02, _03, 
    _10, _11, _12, _13, 
    _20, _21, _22, _23, 
    _30, _31, _32, _33 
} 
from './Matrix4x4.js';

export default class Vector1x4 {
    x: number;
    y: number;
    z: number;
    w: number;

    constructor(x: number = 0.0, y: number = 0.0, z: number = 0.0, w: number = 1.0) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    get r(): number { return this.x; }
    get g(): number { return this.y; }
    get b(): number { return this.z; }
    get a(): number { return this.w; }

    set r(r: number) { this.x = r; }
    set g(g: number) { this.y = g; }
    set b(b: number) { this.z = b; }
    set a(a: number) { this.w = a; }

    add(rhs: Vector1x4): Vector1x4 {
        return new Vector1x4(this.x + rhs.x, this.y + rhs.y, this.z + rhs.z);
    }

    sub(rhs: Vector1x4): Vector1x4 {
        return new Vector1x4(this.x - rhs.x, this.y - rhs.y, this.z - rhs.z);
    }

    neg(): Vector1x4 {
        return new Vector1x4(-this.x, -this.y, -this.z);
    }

    mul(rhs: number | Matrix4x4) {
        if (typeof rhs === 'number') {
            return new Vector1x4(this.x * rhs, this.y * rhs, this.z * rhs);
        } 
        const x = this.x * rhs._m[_00] + this.y * rhs._m[_10] + this.z * rhs._m[_20] + this.w * rhs._m[_30];
        const y = this.x * rhs._m[_01] + this.y * rhs._m[_11] + this.z * rhs._m[_21] + this.w * rhs._m[_31];
        const z = this.x * rhs._m[_02] + this.y * rhs._m[_12] + this.z * rhs._m[_22] + this.w * rhs._m[_32];
        const w = this.x * rhs._m[_03] + this.y * rhs._m[_13] + this.z * rhs._m[_23] + this.w * rhs._m[_33];
        return new Vector1x4(x, y, z, w);
    }

    div(rhs: number): Vector1x4 {
        return new Vector1x4(this.x / rhs, this.y / rhs, this.z / rhs);
    }

    normalize(): Vector1x4 {
        const l = 1.0 / this.magnitude();
        return new Vector1x4(this.x * l, this.y * l, this.z * l);
    }

    magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    cross(rhs: Vector1x4): Vector1x4 {
        return new Vector1x4(this.y * rhs.z - this.z * rhs.y,
                             this.z * rhs.x - this.x * rhs.z,
                             this.x * rhs.y - this.y * rhs.x);
    }

    dot(rhs: Vector1x4): number {
        return (this.x * rhs.x) + (this.y * rhs.y) + (this.z * rhs.z);
    }

    toString(): string {
        return "[Vector1x4 " + this.x + ", " + this.y + ", " + this.z + ", " + this.w + "]"; 
    }
}
