import Matrix4x4, { i00, i01, i02, i03, i10, i11, i12, i13, i20, i21, i22, i23, i30, i31, i32, i33 } from "./Matrix4x4";

export default class Vector1x4 {
  elements: number[];

  constructor(x = 0.0, y = 0.0, z = 0.0, w = 1.0) {
    this.elements = [x, y, z, w];
  }

  get xyzw(): number[] {
    return this.elements;
  }

  get rgba(): number[] {
    return this.elements;
  }

  get xyz(): number[] {
    return this.elements.slice(0, 3);
  }

  get rgb(): number[] {
    return this.elements.slice(0, 3);
  }

  get x(): number {
    return this.elements[0];
  }
  set x(x: number) {
    this.elements[0] = x;
  }

  get y(): number {
    return this.elements[1];
  }
  set y(a: number) {
    this.elements[1] = y;
  }

  get z(): number {
    return this.elements[2];
  }
  set z(z: number) {
    this.elements[2] = z;
  }

  get w(): number {
    return this.elements[3];
  }
  set w(w: number) {
    this.elements[3] = w;
  }

  get r(): number {
    return this.elements[0];
  }
  set r(r: number) {
    this.elements[0] = r;
  }

  get g(): number {
    return this.elements[1];
  }
  set g(g: number) {
    this.elements[1] = g;
  }

  get b(): number {
    return this.elements[2];
  }
  set b(b: number) {
    this.elements[2] = b;
  }

  get a(): number {
    return this.elements[3];
  }
  set a(a: number) {
    this.elements[3] = a;
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

  mul(rhs: number | Matrix4x4): Vector1x4 {
    if (typeof rhs === "number") {
      return new Vector1x4(this.x * rhs, this.y * rhs, this.z * rhs);
    }
    const x = this.x * rhs.m[i00] + this.y * rhs.m[i10] + this.z * rhs.m[i20] + this.w * rhs.m[i30];
    const y = this.x * rhs.m[i01] + this.y * rhs.m[i11] + this.z * rhs.m[i21] + this.w * rhs.m[i31];
    const z = this.x * rhs.m[i02] + this.y * rhs.m[i12] + this.z * rhs.m[i22] + this.w * rhs.m[i32];
    const w = this.x * rhs.m[i03] + this.y * rhs.m[i13] + this.z * rhs.m[i23] + this.w * rhs.m[i33];
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
    return new Vector1x4(
      this.y * rhs.z - this.z * rhs.y,
      this.z * rhs.x - this.x * rhs.z,
      this.x * rhs.y - this.y * rhs.x
    );
  }

  dot(rhs: Vector1x4): number {
    return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
  }

  toString(): string {
    return `[Vector1x4 ${this.x}, ${this.y}, ${this.z}, ${this.w}]`;
  }
}
