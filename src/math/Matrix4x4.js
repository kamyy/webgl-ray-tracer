// @flow
export const _00 = 0; 
export const _01 = 1; 
export const _02 = 2; 
export const _03 = 3;

export const _10 = 4; 
export const _11 = 5; 
export const _12 = 6; 
export const _13 = 7;

export const _20 = 8; 
export const _21 = 9; 
export const _22 = 10; 
export const _23 = 11;

export const _30 = 12; 
export const _31 = 13; 
export const _32 = 14; 
export const _33 = 15;

export default class Matrix4x4 {
    _m: Array<number>;

    constructor(elements: Matrix4x4 | Array<number> | void) {
        if (!elements) {
            this._m = Array.of(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        } else if (elements instanceof Matrix4x4) {
            this._m = Array.from(elements._m);
        } else if (Array.isArray(elements) && elements.length === 16) {
            this._m = Array.from(elements);
        } else {
            throw new Error('Cannot construct Matrix4x4!');
        }
    }

    static createId(): Matrix4x4 {
        return new Matrix4x4();
    }

    static createRx(theta: number) : Matrix4x4 {
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        return new Matrix4x4([
            1,         0,          0, 0,
            0, +cosTheta,  +sinTheta, 0,
            0, -sinTheta,  +cosTheta, 0,
            0,         0,          0, 1
        ]);
    }

    static createRy(theta: number): Matrix4x4 {
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        return new Matrix4x4([
            +cosTheta, 0, -sinTheta, 0,
            0,         1,         0, 0,
            +sinTheta, 0, +cosTheta, 0,
            0,         0,         0, 1
        ]);
    }

    static createRz(theta: number): Matrix4x4 {
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        return new Matrix4x4([
            +cosTheta, +sinTheta, 0, 0,
            -sinTheta, +cosTheta, 0, 0,
                    0,         0, 1, 0,
                    0,         0, 0, 1
        ]);
    }

    mul(rhs: Matrix4x4): Matrix4x4 {
        return new Matrix4x4([
            this._m[_00] * rhs._m[_00] + this._m[_01] * rhs._m[_10] + this._m[_02] * rhs._m[_20] + this._m[_03] * rhs._m[_30],
            this._m[_00] * rhs._m[_01] + this._m[_01] * rhs._m[_11] + this._m[_02] * rhs._m[_21] + this._m[_03] * rhs._m[_31],
            this._m[_00] * rhs._m[_02] + this._m[_01] * rhs._m[_12] + this._m[_02] * rhs._m[_22] + this._m[_03] * rhs._m[_32],
            this._m[_00] * rhs._m[_03] + this._m[_01] * rhs._m[_13] + this._m[_02] * rhs._m[_23] + this._m[_03] * rhs._m[_33],

            this._m[_10] * rhs._m[_00] + this._m[_11] * rhs._m[_10] + this._m[_12] * rhs._m[_20] + this._m[_13] * rhs._m[_30],
            this._m[_10] * rhs._m[_01] + this._m[_11] * rhs._m[_11] + this._m[_12] * rhs._m[_21] + this._m[_13] * rhs._m[_31],
            this._m[_10] * rhs._m[_02] + this._m[_11] * rhs._m[_12] + this._m[_12] * rhs._m[_22] + this._m[_13] * rhs._m[_32],
            this._m[_10] * rhs._m[_03] + this._m[_11] * rhs._m[_13] + this._m[_12] * rhs._m[_23] + this._m[_13] * rhs._m[_33],

            this._m[_20] * rhs._m[_00] + this._m[_21] * rhs._m[_10] + this._m[_22] * rhs._m[_20] + this._m[_23] * rhs._m[_30],
            this._m[_20] * rhs._m[_01] + this._m[_21] * rhs._m[_11] + this._m[_22] * rhs._m[_21] + this._m[_23] * rhs._m[_31],
            this._m[_20] * rhs._m[_02] + this._m[_21] * rhs._m[_12] + this._m[_22] * rhs._m[_22] + this._m[_23] * rhs._m[_32],
            this._m[_20] * rhs._m[_03] + this._m[_21] * rhs._m[_13] + this._m[_22] * rhs._m[_23] + this._m[_23] * rhs._m[_33],

            this._m[_30] * rhs._m[_00] + this._m[_31] * rhs._m[_10] + this._m[_32] * rhs._m[_20] + this._m[_33] * rhs._m[_30],
            this._m[_30] * rhs._m[_01] + this._m[_31] * rhs._m[_11] + this._m[_32] * rhs._m[_21] + this._m[_33] * rhs._m[_31],
            this._m[_30] * rhs._m[_02] + this._m[_31] * rhs._m[_12] + this._m[_32] * rhs._m[_22] + this._m[_33] * rhs._m[_32],
            this._m[_30] * rhs._m[_03] + this._m[_31] * rhs._m[_13] + this._m[_32] * rhs._m[_23] + this._m[_33] * rhs._m[_33]
        ]);
    }

    inverse(): Matrix4x4 {
        return new Matrix4x4([
            this._m[_00], this._m[_10], this._m[_20], 0,
            this._m[_01], this._m[_11], this._m[_21], 0,
            this._m[_02], this._m[_12], this._m[_22], 0,
            -(this._m[_30] * this._m[_00] + this._m[_31] * this._m[_01] + this._m[_32] * this._m[_02]),
            -(this._m[_30] * this._m[_10] + this._m[_31] * this._m[_11] + this._m[_32] * this._m[_12]),
            -(this._m[_30] * this._m[_20] + this._m[_31] * this._m[_21] + this._m[_32] * this._m[_22]), 1
        ]);
    }

    postCatTxyz(tx: number, ty: number, tz: number): Matrix4x4 {
        return new Matrix4x4([
            this._m[_00], this._m[_01], this._m[_02], this._m[_03],
            this._m[_10], this._m[_11], this._m[_12], this._m[_13],
            this._m[_20], this._m[_21], this._m[_22], this._m[_23],
            this._m[_30] + tx, this._m[_31] + ty, this._m[_32] + tz, this._m[_33]
        ]);
    }

    postCatSxyz(sx: number, sy: number, sz: number): Matrix4x4 {
        return new Matrix4x4([
            this._m[_00] * sx, this._m[_01] * sy, this._m[_02] * sz, this._m[_03],
            this._m[_10] * sx, this._m[_11] * sy, this._m[_12] * sz, this._m[_13],
            this._m[_20] * sx, this._m[_21] * sy, this._m[_22] * sz, this._m[_23],
            this._m[_30] * sx, this._m[_31] * sy, this._m[_32] * sz, this._m[_33]
        ]);
    }

    toFloat32Array(): Float32Array {
        return new Float32Array(this._m);
    }

    toString(): string {
        return "[Matrix4x4 " + 
                this._m[_00] + ", " + this._m[_01] + ", " + this._m[_02] + ", " + this._m[_03] + ", " + 
                this._m[_10] + ", " + this._m[_11] + ", " + this._m[_12] + ", " + this._m[_13] + ", " + 
                this._m[_20] + ", " + this._m[_21] + ", " + this._m[_22] + ", " + this._m[_23] + ", " +
                this._m[_30] + ", " + this._m[_31] + ", " + this._m[_32] + ", " + this._m[_33] + "]";
    }
}
