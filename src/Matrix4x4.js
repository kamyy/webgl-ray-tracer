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
    m: Array<number>;

    constructor(elements: Matrix4x4 | Array<number> | void) {
        if (!elements) {
            this.m = Array.of(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        } else if (elements instanceof Matrix4x4) {
            this.m = Array.from(elements.m);
        } else if (Array.isArray(elements) && elements.length === 16) {
            this.m = Array.from(elements);
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
            this.m[_11] * rhs.m[_11] + this.m[_12] * rhs.m[_21] + this.m[_13] * rhs.m[_31] + this.m[_14] * rhs.m[_41],
            this.m[_11] * rhs.m[_12] + this.m[_12] * rhs.m[_22] + this.m[_13] * rhs.m[_32] + this.m[_14] * rhs.m[_42],
            this.m[_11] * rhs.m[_13] + this.m[_12] * rhs.m[_23] + this.m[_13] * rhs.m[_33] + this.m[_14] * rhs.m[_43],
            this.m[_11] * rhs.m[_14] + this.m[_12] * rhs.m[_24] + this.m[_13] * rhs.m[_34] + this.m[_14] * rhs.m[_44],

            this.m[_21] * rhs.m[_11] + this.m[_22] * rhs.m[_21] + this.m[_23] * rhs.m[_31] + this.m[_24] * rhs.m[_41],
            this.m[_21] * rhs.m[_12] + this.m[_22] * rhs.m[_22] + this.m[_23] * rhs.m[_32] + this.m[_24] * rhs.m[_42],
            this.m[_21] * rhs.m[_13] + this.m[_22] * rhs.m[_23] + this.m[_23] * rhs.m[_33] + this.m[_24] * rhs.m[_43],
            this.m[_21] * rhs.m[_14] + this.m[_22] * rhs.m[_24] + this.m[_23] * rhs.m[_34] + this.m[_24] * rhs.m[_44],

            this.m[_31] * rhs.m[_11] + this.m[_32] * rhs.m[_21] + this.m[_33] * rhs.m[_31] + this.m[_34] * rhs.m[_41],
            this.m[_31] * rhs.m[_12] + this.m[_32] * rhs.m[_22] + this.m[_33] * rhs.m[_32] + this.m[_34] * rhs.m[_42],
            this.m[_31] * rhs.m[_13] + this.m[_32] * rhs.m[_23] + this.m[_33] * rhs.m[_33] + this.m[_34] * rhs.m[_43],
            this.m[_31] * rhs.m[_14] + this.m[_32] * rhs.m[_24] + this.m[_33] * rhs.m[_34] + this.m[_34] * rhs.m[_44],

            this.m[_41] * rhs.m[_11] + this.m[_42] * rhs.m[_21] + this.m[_43] * rhs.m[_31] + this.m[_44] * rhs.m[_41],
            this.m[_41] * rhs.m[_12] + this.m[_42] * rhs.m[_22] + this.m[_43] * rhs.m[_32] + this.m[_44] * rhs.m[_42],
            this.m[_41] * rhs.m[_13] + this.m[_42] * rhs.m[_23] + this.m[_43] * rhs.m[_33] + this.m[_44] * rhs.m[_43],
            this.m[_41] * rhs.m[_14] + this.m[_42] * rhs.m[_24] + this.m[_43] * rhs.m[_34] + this.m[_44] * rhs.m[_44]
        ]);
    }

    inverse(): Matrix4x4 {
        return new Matrix4x4([
            this.m[_11], this.m[_21], this.m[_31], 0,
            this.m[_12], this.m[_22], this.m[_32], 0,
            this.m[_13], this.m[_23], this.m[_33], 0,
            -(this.m[_41] * this.m[_11] + this.m[_42] * this.m[_12] + this.m[_43] * this.m[_13]),
            -(this.m[_41] * this.m[_21] + this.m[_42] * this.m[_22] + this.m[_43] * this.m[_23]),
            -(this.m[_41] * this.m[_31] + this.m[_42] * this.m[_32] + this.m[_43] * this.m[_33]), 1
        ]);
    }

    postCatTxyz(tx: number, ty: number, tz: number): Matrix4x4 {
        return new Matrix4x4([
            this.m[_11], this.m[_12], this.m[_13], this.m[_14],
            this.m[_21], this.m[_22], this.m[_23], this.m[_24],
            this.m[_31], this.m[_32], this.m[_33], this.m[_34],
            this.m[_41] + tx, this.m[_42] + ty, this.m[_43] + tz, this.m[_44]
        ]);
    }

    postCatSxyz(sx: number, sy: number, sz: number): Matrix4x4 {
        return new Matrix4x4([
            this.m[_11] * sx, this.m[_12] * sy, this.m[_13] * sz, this.m[_14],
            this.m[_21] * sx, this.m[_22] * sy, this.m[_23] * sz, this.m[_24],
            this.m[_31] * sx, this.m[_32] * sy, this.m[_33] * sz, this.m[_34],
            this.m[_41] * sx, this.m[_42] * sy, this.m[_43] * sz, this.m[_44]
        ]);
    }

    toFloat32Array(): Float32Array {
        return new Float32Array(this.m);
    }

    toString(): string {
        return "[Matrix4x4 " + 
                this.m[_11] + ", " + this.m[_12] + ", " + this.m[_13] + ", " + this.m[_14] + ", " + 
                this.m[_21] + ", " + this.m[_22] + ", " + this.m[_23] + ", " + this.m[_24] + ", " + 
                this.m[_31] + ", " + this.m[_32] + ", " + this.m[_33] + ", " + this.m[_34] + ", " +
                this.m[_41] + ", " + this.m[_42] + ", " + this.m[_43] + ", " + this.m[_44] + "]";
    }
}
