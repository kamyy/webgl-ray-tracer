import Vector1x4 from "./Vector1x4";

export default class Ray {
  origin: Vector1x4;
  dir: Vector1x4;

  constructor(origin: Vector1x4, dir: Vector1x4) {
    this.origin = origin;
    this.dir = dir;
  }

  getPos(t: number): Vector1x4 {
    return this.origin.add(this.dir.mul(t));
  }
}
