// @flow
export const _11 = 0; 
export const _12 = 1; 
export const _13 = 2; 
export const _14 = 3;

export const _21 = 4; 
export const _22 = 5; 
export const _23 = 6; 
export const _24 = 7;

export const _31 = 8; 
export const _32 = 9; 
export const _33 = 10; 
export const _34 = 11;

export const _41 = 12; 
export const _42 = 13; 
export const _43 = 14; 
export const _44 = 15;

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
            this._m[_11] * rhs._m[_11] + this._m[_12] * rhs._m[_21] + this._m[_13] * rhs._m[_31] + this._m[_14] * rhs._m[_41],
            this._m[_11] * rhs._m[_12] + this._m[_12] * rhs._m[_22] + this._m[_13] * rhs._m[_32] + this._m[_14] * rhs._m[_42],
            this._m[_11] * rhs._m[_13] + this._m[_12] * rhs._m[_23] + this._m[_13] * rhs._m[_33] + this._m[_14] * rhs._m[_43],
            this._m[_11] * rhs._m[_14] + this._m[_12] * rhs._m[_24] + this._m[_13] * rhs._m[_34] + this._m[_14] * rhs._m[_44],

            this._m[_21] * rhs._m[_11] + this._m[_22] * rhs._m[_21] + this._m[_23] * rhs._m[_31] + this._m[_24] * rhs._m[_41],
            this._m[_21] * rhs._m[_12] + this._m[_22] * rhs._m[_22] + this._m[_23] * rhs._m[_32] + this._m[_24] * rhs._m[_42],
            this._m[_21] * rhs._m[_13] + this._m[_22] * rhs._m[_23] + this._m[_23] * rhs._m[_33] + this._m[_24] * rhs._m[_43],
            this._m[_21] * rhs._m[_14] + this._m[_22] * rhs._m[_24] + this._m[_23] * rhs._m[_34] + this._m[_24] * rhs._m[_44],

            this._m[_31] * rhs._m[_11] + this._m[_32] * rhs._m[_21] + this._m[_33] * rhs._m[_31] + this._m[_34] * rhs._m[_41],
            this._m[_31] * rhs._m[_12] + this._m[_32] * rhs._m[_22] + this._m[_33] * rhs._m[_32] + this._m[_34] * rhs._m[_42],
            this._m[_31] * rhs._m[_13] + this._m[_32] * rhs._m[_23] + this._m[_33] * rhs._m[_33] + this._m[_34] * rhs._m[_43],
            this._m[_31] * rhs._m[_14] + this._m[_32] * rhs._m[_24] + this._m[_33] * rhs._m[_34] + this._m[_34] * rhs._m[_44],

            this._m[_41] * rhs._m[_11] + this._m[_42] * rhs._m[_21] + this._m[_43] * rhs._m[_31] + this._m[_44] * rhs._m[_41],
            this._m[_41] * rhs._m[_12] + this._m[_42] * rhs._m[_22] + this._m[_43] * rhs._m[_32] + this._m[_44] * rhs._m[_42],
            this._m[_41] * rhs._m[_13] + this._m[_42] * rhs._m[_23] + this._m[_43] * rhs._m[_33] + this._m[_44] * rhs._m[_43],
            this._m[_41] * rhs._m[_14] + this._m[_42] * rhs._m[_24] + this._m[_43] * rhs._m[_34] + this._m[_44] * rhs._m[_44]
        ]);
    }

    inverse(): Matrix4x4 {
        return new Matrix4x4([
            this._m[_11], this._m[_21], this._m[_31], 0,
            this._m[_12], this._m[_22], this._m[_32], 0,
            this._m[_13], this._m[_23], this._m[_33], 0,
            -(this._m[_41] * this._m[_11] + this._m[_42] * this._m[_12] + this._m[_43] * this._m[_13]),
            -(this._m[_41] * this._m[_21] + this._m[_42] * this._m[_22] + this._m[_43] * this._m[_23]),
            -(this._m[_41] * this._m[_31] + this._m[_42] * this._m[_32] + this._m[_43] * this._m[_33]), 1
        ]);
    }

    postCatTxyz(tx: number, ty: number, tz: number): Matrix4x4 {
        return new Matrix4x4([
            this._m[_11], this._m[_12], this._m[_13], this._m[_14],
            this._m[_21], this._m[_22], this._m[_23], this._m[_24],
            this._m[_31], this._m[_32], this._m[_33], this._m[_34],
            this._m[_41] + tx, this._m[_42] + ty, this._m[_43] + tz, this._m[_44]
        ]);
    }

    postCatSxyz(sx: number, sy: number, sz: number): Matrix4x4 {
        return new Matrix4x4([
            this._m[_11] * sx, this._m[_12] * sy, this._m[_13] * sz, this._m[_14],
            this._m[_21] * sx, this._m[_22] * sy, this._m[_23] * sz, this._m[_24],
            this._m[_31] * sx, this._m[_32] * sy, this._m[_33] * sz, this._m[_34],
            this._m[_41] * sx, this._m[_42] * sy, this._m[_43] * sz, this._m[_44]
        ]);
    }

    toFloat32Array(): Float32Array {
        return new Float32Array(this._m);
    }

    toString(): string {
        return "[Matrix4x4 " + 
                this._m[_11] + ", " + this._m[_12] + ", " + this._m[_13] + ", " + this._m[_14] + ", " + 
                this._m[_21] + ", " + this._m[_22] + ", " + this._m[_23] + ", " + this._m[_24] + ", " + 
                this._m[_31] + ", " + this._m[_32] + ", " + this._m[_33] + ", " + this._m[_34] + ", " +
                this._m[_41] + ", " + this._m[_42] + ", " + this._m[_43] + ", " + this._m[_44] + "]";
    }
}
