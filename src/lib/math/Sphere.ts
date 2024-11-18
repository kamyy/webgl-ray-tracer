import Vector1x4 from "./Vector1x4";
import Ray from "./Ray";

export class RayIntersectSphereResult {
  t0: number;
  t1: number;
  pos0: Vector1x4;
  pos1: Vector1x4;

  constructor(t0: number, t1: number, pos0: Vector1x4, pos1: Vector1x4) {
    this.t0 = t0;
    this.t1 = t1;
    this.pos0 = pos0;
    this.pos1 = pos1;
  }
}

export default class Sphere {
  materialId: string;
  center: Vector1x4;
  radius: number;
  id: string;

  constructor(id: string, center: Vector1x4, radius: number, materialId: string) {
    this.id = id;
    this.center = center;
    this.radius = radius;
    this.materialId = materialId;
  }

  get radiusSquared(): number {
    return this.radius * this.radius;
  }

  rayIntersectSphere(ray: Ray): RayIntersectSphereResult | null {
    const l: Vector1x4 = ray.origin.sub(this.center);
    const a: number = ray.dir.dot(ray.dir);
    const b: number = ray.dir.dot(l) * 2;
    const c: number = l.dot(l) - this.radiusSquared;

    const discriminant = b * b - 4 * a * c;
    if (discriminant > 0) {
      const aa = 1 / (2 * a);
      const sq = Math.sqrt(discriminant);
      const t0 = (-b - sq) * aa;
      const t1 = (-b + sq) * aa;
      const pos0 = ray.getPos(t0);
      const pos1 = ray.getPos(t1);

      return new RayIntersectSphereResult(t0, t1, pos0, pos1);
    }
    return null;
  }
}
