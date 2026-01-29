export const i00 = 0;
export const i01 = 1;
export const i02 = 2;
export const i03 = 3;

export const i10 = 4;
export const i11 = 5;
export const i12 = 6;
export const i13 = 7;

export const i20 = 8;
export const i21 = 9;
export const i22 = 10;
export const i23 = 11;

export const i30 = 12;
export const i31 = 13;
export const i32 = 14;
export const i33 = 15;

export default class Matrix4x4 {
  m: number[];

  constructor(arg: void | Matrix4x4 | number[]) {
    if (!arg) {
      this.m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    } else if (arg instanceof Matrix4x4) {
      this.m = [...arg.m];
    } else if (arg.length === 16) {
      this.m = [...arg];
    } else {
      throw new Error("Cannot construct Matrix4x4!");
    }
  }

  static createId(): Matrix4x4 {
    return new Matrix4x4();
  }

  static createRx(theta: number): Matrix4x4 {
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    return new Matrix4x4([1, 0, 0, 0, 0, +cosTheta, +sinTheta, 0, 0, -sinTheta, +cosTheta, 0, 0, 0, 0, 1]);
  }

  static createRy(theta: number): Matrix4x4 {
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    return new Matrix4x4([+cosTheta, 0, -sinTheta, 0, 0, 1, 0, 0, +sinTheta, 0, +cosTheta, 0, 0, 0, 0, 1]);
  }

  static createRz(theta: number): Matrix4x4 {
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    return new Matrix4x4([+cosTheta, +sinTheta, 0, 0, -sinTheta, +cosTheta, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  mul(rhs: Matrix4x4): Matrix4x4 {
    return new Matrix4x4([
      this.m[i00] * rhs.m[i00] + this.m[i01] * rhs.m[i10] + this.m[i02] * rhs.m[i20] + this.m[i03] * rhs.m[i30],
      this.m[i00] * rhs.m[i01] + this.m[i01] * rhs.m[i11] + this.m[i02] * rhs.m[i21] + this.m[i03] * rhs.m[i31],
      this.m[i00] * rhs.m[i02] + this.m[i01] * rhs.m[i12] + this.m[i02] * rhs.m[i22] + this.m[i03] * rhs.m[i32],
      this.m[i00] * rhs.m[i03] + this.m[i01] * rhs.m[i13] + this.m[i02] * rhs.m[i23] + this.m[i03] * rhs.m[i33],

      this.m[i10] * rhs.m[i00] + this.m[i11] * rhs.m[i10] + this.m[i12] * rhs.m[i20] + this.m[i13] * rhs.m[i30],
      this.m[i10] * rhs.m[i01] + this.m[i11] * rhs.m[i11] + this.m[i12] * rhs.m[i21] + this.m[i13] * rhs.m[i31],
      this.m[i10] * rhs.m[i02] + this.m[i11] * rhs.m[i12] + this.m[i12] * rhs.m[i22] + this.m[i13] * rhs.m[i32],
      this.m[i10] * rhs.m[i03] + this.m[i11] * rhs.m[i13] + this.m[i12] * rhs.m[i23] + this.m[i13] * rhs.m[i33],

      this.m[i20] * rhs.m[i00] + this.m[i21] * rhs.m[i10] + this.m[i22] * rhs.m[i20] + this.m[i23] * rhs.m[i30],
      this.m[i20] * rhs.m[i01] + this.m[i21] * rhs.m[i11] + this.m[i22] * rhs.m[i21] + this.m[i23] * rhs.m[i31],
      this.m[i20] * rhs.m[i02] + this.m[i21] * rhs.m[i12] + this.m[i22] * rhs.m[i22] + this.m[i23] * rhs.m[i32],
      this.m[i20] * rhs.m[i03] + this.m[i21] * rhs.m[i13] + this.m[i22] * rhs.m[i23] + this.m[i23] * rhs.m[i33],

      this.m[i30] * rhs.m[i00] + this.m[i31] * rhs.m[i10] + this.m[i32] * rhs.m[i20] + this.m[i33] * rhs.m[i30],
      this.m[i30] * rhs.m[i01] + this.m[i31] * rhs.m[i11] + this.m[i32] * rhs.m[i21] + this.m[i33] * rhs.m[i31],
      this.m[i30] * rhs.m[i02] + this.m[i31] * rhs.m[i12] + this.m[i32] * rhs.m[i22] + this.m[i33] * rhs.m[i32],
      this.m[i30] * rhs.m[i03] + this.m[i31] * rhs.m[i13] + this.m[i32] * rhs.m[i23] + this.m[i33] * rhs.m[i33],
    ]);
  }

  inverse(): Matrix4x4 {
    return new Matrix4x4([
      this.m[i00],
      this.m[i10],
      this.m[i20],
      0,
      this.m[i01],
      this.m[i11],
      this.m[i21],
      0,
      this.m[i02],
      this.m[i12],
      this.m[i22],
      0,
      -(this.m[i30] * this.m[i00] + this.m[i31] * this.m[i01] + this.m[i32] * this.m[i02]),
      -(this.m[i30] * this.m[i10] + this.m[i31] * this.m[i11] + this.m[i32] * this.m[i12]),
      -(this.m[i30] * this.m[i20] + this.m[i31] * this.m[i21] + this.m[i32] * this.m[i22]),
      1,
    ]);
  }

  postCatTxyz(tx: number, ty: number, tz: number): Matrix4x4 {
    return new Matrix4x4([
      this.m[i00],
      this.m[i01],
      this.m[i02],
      this.m[i03],
      this.m[i10],
      this.m[i11],
      this.m[i12],
      this.m[i13],
      this.m[i20],
      this.m[i21],
      this.m[i22],
      this.m[i23],
      this.m[i30] + tx,
      this.m[i31] + ty,
      this.m[i32] + tz,
      this.m[i33],
    ]);
  }

  postCatSxyz(sx: number, sy: number, sz: number): Matrix4x4 {
    return new Matrix4x4([
      this.m[i00] * sx,
      this.m[i01] * sy,
      this.m[i02] * sz,
      this.m[i03],
      this.m[i10] * sx,
      this.m[i11] * sy,
      this.m[i12] * sz,
      this.m[i13],
      this.m[i20] * sx,
      this.m[i21] * sy,
      this.m[i22] * sz,
      this.m[i23],
      this.m[i30] * sx,
      this.m[i31] * sy,
      this.m[i32] * sz,
      this.m[i33],
    ]);
  }

  toFloat32Array(): Float32Array {
    return new Float32Array(this.m);
  }

  toString(): string {
    return `[Matrix4x4 ${this.m[i00]}, ${this.m[i01]}, ${this.m[i02]}, ${this.m[i03]}, ${this.m[i10]}, ${this.m[i11]}, ${this.m[i12]}, ${this.m[i13]}, ${this.m[i20]}, ${this.m[i21]}, ${this.m[i22]}, ${this.m[i23]}, ${this.m[i30]}, ${this.m[i31]}, ${this.m[i32]}, ${this.m[i33]}]`;
  }
}
