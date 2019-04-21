// @flow
import Matrix4x4, {_11, _12, _13, _14, _21, _22, _23, _24, _31, _32, _33, _34, _41, _42, _43, _44 } from './Matrix4x4.js';

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
        const x = this.x * rhs._m[_11] + this.y * rhs._m[_21] + this.z * rhs._m[_31] + this.w * rhs._m[_41];
        const y = this.x * rhs._m[_12] + this.y * rhs._m[_22] + this.z * rhs._m[_32] + this.w * rhs._m[_42];
        const z = this.x * rhs._m[_13] + this.y * rhs._m[_23] + this.z * rhs._m[_33] + this.w * rhs._m[_43];
        const w = this.x * rhs._m[_14] + this.y * rhs._m[_24] + this.z * rhs._m[_34] + this.w * rhs._m[_44];
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

