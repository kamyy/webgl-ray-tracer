// @flow
import Matrix4x4, {
    _00, _01, _02, _03, 
    _10, _11, _12, _13, 
    _20, _21, _22, _23, 
    _30, _31, _32, _33 
} 
from './Matrix4x4.js';

export default class Vector1x4 {
    elements: number[];

    constructor(x: number = 0.0, y: number = 0.0, z: number = 0.0, w: number = 1.0) {
        this.elements = [x, y, z, w];
    }

    get xyzw(): number[] { return this.elements; } 
    get rgba(): number[] { return this.elements; }
    get xyz(): number[] { return this.elements.slice(0, 3); } 
    get rgb(): number[] { return this.elements.slice(0, 3); }

    get x(): number { return this.elements[0]; }
    get y(): number { return this.elements[1]; }
    get z(): number { return this.elements[2]; }
    get w(): number { return this.elements[3]; }

    set x(x: number) { this.elements[0] = x; }
    set y(y: number) { this.elements[1] = y; }
    set z(z: number) { this.elements[2] = z; }
    set w(w: number) { this.elements[3] = w; }

    get r(): number { return this.elements[0]; }
    get g(): number { return this.elements[1]; }
    get b(): number { return this.elements[2]; }
    get a(): number { return this.elements[3]; }

    set r(r: number) { this.elements[0] = r; }
    set g(g: number) { this.elements[1] = g; }
    set b(b: number) { this.elements[2] = b; }
    set a(a: number) { this.elements[3] = a; }

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
