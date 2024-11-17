import Matrix4x4, { i00, i01, i02, i10, i12, i20, i21, i22, i30, i31, i32, i33 } from "./Matrix4x4";
import Vector1x4 from "./Vector1x4";

export default class RefFrame {
  parent: RefFrame | null;
  child: RefFrame | null;
  next: RefFrame | null;
  validSubtree: boolean;
  localM: Matrix4x4;
  modelM: Matrix4x4;

  constructor(parent?: RefFrame) {
    this.validSubtree = true;
    this.parent = null;
    this.child = null;
    this.next = null;
    this.localM = new Matrix4x4();
    this.modelM = new Matrix4x4();

    if (parent instanceof RefFrame) {
      this.validSubtree = false;
      this.parent = parent;
      this.next = parent.child;
      this.parent.child = this;
    }
  }

  invalidateSubtree(): void {
    if (this.validSubtree) {
      for (let i = this.child; i !== null; i = i.next) {
        i.invalidateSubtree();
      }
      this.validSubtree = false;
    }
  }

  validateAscending(): void {
    if (!this.validSubtree) {
      if (this.parent) {
        this.parent.validateAscending();
        this.modelM = this.localM.mul(this.parent.modelM);
      }
      this.validSubtree = true;
    }
  }

  get localMatrix(): Matrix4x4 {
    return this.localM;
  }

  set localMatrix(matrix: Matrix4x4) {
    this.localM = new Matrix4x4(matrix);
    this.invalidateSubtree();
  }

  get modelMatrix(): Matrix4x4 {
    this.validateAscending();
    return this.modelM;
  }

  set modelMatrix(matrix: Matrix4x4) {
    // worldMatrix = localMatrix * parent->worldMatrix
    // worldMatrix / parent->worldMatrix = localMatrix
    if (this.parent instanceof RefFrame) {
      this.localM = matrix.mul(this.parent.modelMatrix.inverse());
      this.invalidateSubtree();
    }
  }

  translate(v: Vector1x4, relative2?: RefFrame): void {
    if (!relative2 || relative2 === this) {
      const x = this.localM.m[i30];
      const y = this.localM.m[i31];
      const z = this.localM.m[i32];
      this.localM.m[i30] = x + v.x * this.localM.m[i00] + v.y * this.localM.m[i10] + v.z * this.localM.m[i20];
      this.localM.m[i31] = y + v.x * this.localM.m[i01] + v.y * this.localM.m[i22] + v.z * this.localM.m[i21];
      this.localM.m[i32] = z + v.x * this.localM.m[i02] + v.y * this.localM.m[i12] + v.z * this.localM.m[i33];
      this.invalidateSubtree(); // relative to own axis
    } else if (!relative2.parent && this.parent) {
      const d = relative2.mapPos(new Vector1x4(v.x, v.y, v.z, 0.0), this.parent);
      this.localM.m[i30] += d.x;
      this.localM.m[i31] += d.y;
      this.localM.m[i32] += d.z;
      this.invalidateSubtree(); // relative to root axes
    } else if (relative2 === this.parent) {
      this.localM.m[i30] += v.x;
      this.localM.m[i31] += v.y;
      this.localM.m[i32] += v.z;
      this.invalidateSubtree(); // relative to parent axes
    } else if (this.parent) {
      const d = relative2.mapPos(new Vector1x4(v.x, v.y, v.z, 0.0), this.parent);
      this.localM.m[i30] += d.x;
      this.localM.m[i31] += d.y;
      this.localM.m[i32] += d.z;
      this.invalidateSubtree(); // relative to arbitrary axes
    }
  }

  rotateX(theta: number, relative2?: RefFrame): void {
    if (!(relative2 instanceof RefFrame) || relative2 === this) {
      // relative to own axes
      const rotx = Matrix4x4.createRx(theta);
      this.localMatrix = rotx.mul(this.localMatrix);
    } else if (relative2 === this.parent) {
      // relative to parent
      const rotx = Matrix4x4.createRx(theta);
      this.localMatrix = this.localMatrix.mul(rotx);
    } else {
      // relative to arbitrary axes
      throw new Error("Cannot rotate relative to arbitrary axis!");
    }
    this.invalidateSubtree();
  }

  rotateY(theta: number, relative2?: RefFrame): void {
    if (!(relative2 instanceof RefFrame) || relative2 === this) {
      // relative to own axes
      const roty = Matrix4x4.createRy(theta);
      this.localMatrix = roty.mul(this.localMatrix);
    } else if (relative2 === this.parent) {
      // relative to parent
      const roty = Matrix4x4.createRy(theta);
      this.localMatrix = this.localMatrix.mul(roty);
    } else {
      // relative to arbitrary axes
      throw new Error("Cannot rotate relative to arbitrary axis!");
    }
    this.invalidateSubtree();
  }

  rotateZ(theta: number, relative2?: RefFrame): void {
    if (!(relative2 instanceof RefFrame) || relative2 === this) {
      // relative to own axes
      const rotz = Matrix4x4.createRz(theta);
      this.localMatrix = rotz.mul(this.localMatrix);
    } else if (relative2 === this.parent) {
      // relative to parent
      const rotz = Matrix4x4.createRz(theta);
      this.localMatrix = this.localMatrix.mul(rotz);
    } else {
      // relative to arbitrary axes
      throw new Error("Cannot rotate relative to arbitrary axis!");
    }
    this.invalidateSubtree();
  }

  mapPos(v: Vector1x4, tgt: RefFrame): Vector1x4 {
    if (tgt === this.parent) {
      return v.mul(this.localMatrix);
    }
    if (tgt.parent === null) {
      return v.mul(this.modelMatrix);
    }
    return v.mul(this.modelMatrix).mul(tgt.modelMatrix.inverse());
  }
}
