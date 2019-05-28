// @flow

import Matrix4x4, {_00, _01, _02, _10, _22, _12, _20, _21, _33, _30, _31, _32 } from './Matrix4x4.js';
import Vector1x4 from './Vector1x4.js';

export default class RefFrame {
    validSubtree: boolean;
    parent: any;
    child:  any;
    next:   any;
    localM: Matrix4x4;
    modelM: Matrix4x4;

    constructor(parent: RefFrame | null = null, node: RefFrame | null = null) {
        this.validSubtree = true;
        this.parent       = null;
        this.child        = null;
        this.next         = null;
        this.localM       = new Matrix4x4();
        this.modelM       = new Matrix4x4();

        if (parent instanceof RefFrame) {
            this.validSubtree  = false;
            this.parent        = parent;
            this.next          = parent.child;
            this.parent.child  = this;
        }

        if (node) {
           this.modelMatrix = new Matrix4x4(node.modelMatrix); 
        }
    }

    invalidateSubtree() {
        if (this.validSubtree) {
            for (let i = this.child; i !== null; i = i.next) {
                i.invalidateSubtree();
            }
            this.validSubtree = false;
        }
    }

    validateAscending() {
        if (!this.validSubtree) {
            if (this.parent) {
                this.parent.validateAscending();
                this.modelM = this.localM.mul(this.parent.modelM);
            }
            this.validSubtree = true;
        }
    }

    *children(): Generator<any, any, any> {
        for (let sibling = this.child; sibling !== null; sibling = sibling.next) { yield sibling; }
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

    translate(v: Vector1x4, relative2: RefFrame | null) {
        if (relative2 === this || !relative2) { // relative to own axes
            const x = this.localM._m[_30];
            const y = this.localM._m[_31];
            const z = this.localM._m[_32];
            this.localM._m[_30] = x + (v.x * this.localM._m[_00]) + (v.y * this.localM._m[_10]) + (v.z * this.localM._m[_20]);
            this.localM._m[_31] = y + (v.x * this.localM._m[_01]) + (v.y * this.localM._m[_22]) + (v.z * this.localM._m[_21]);
            this.localM._m[_32] = z + (v.x * this.localM._m[_02]) + (v.y * this.localM._m[_12]) + (v.z * this.localM._m[_33]);

        } else if (relative2.parent === null) { // relative to root axes
            const d = relative2.mapPos(new Vector1x4(v.x, v.y, v.z, 0.0), this.parent);
            this.localM._m[_30] += d.x;
            this.localM._m[_31] += d.y;
            this.localM._m[_32] += d.z;

        } else if (relative2 === this.parent) { // relative to parent axes
            this.localM._m[_30] += v.x;
            this.localM._m[_31] += v.y;
            this.localM._m[_32] += v.z;

        } else { // relative to arbitrary axes
            const d = relative2.mapPos(new Vector1x4(v.x, v.y, v.z, 0.0), this.parent);
            this.localM._m[_30] += d.x;
            this.localM._m[_31] += d.y;
            this.localM._m[_32] += d.z;
        }
        this.invalidateSubtree();
    }

    rotateX(theta: number, relative2: RefFrame | null) {
        if (relative2 === this || !relative2) { // relative to own axes
            const rotx = Matrix4x4.createRx(theta);
            this.localMatrix = rotx.mul(this.localMatrix);
        } else if (relative2 === this.parent) { // relative to parent
            const rotx = Matrix4x4.createRx(theta);
            this.localMatrix = this.localMatrix.mul(rotx);
        } else { // relative to arbitrary axes
            throw new Error('Cannot rotate relative to arbitrary axis!');
        }
        this.invalidateSubtree();
    }

    rotateY(theta: number, relative2: RefFrame | null) {
        if (relative2 === this || !relative2) { // relative to own axes
            const roty = Matrix4x4.createRy(theta);
            this.localMatrix = roty.mul(this.localMatrix);
        } else if (relative2 === this.parent) { // relative to parent
            const roty = Matrix4x4.createRy(theta);
            this.localMatrix = this.localMatrix.mul(roty);
        } else { // relative to arbitrary axes
            throw new Error('Cannot rotate relative to arbitrary axis!');
        }
        this.invalidateSubtree();
    }

    rotateZ(theta: number, relative2: RefFrame | null) {
        if (relative2 === this || !relative2) { // relative to own axes
            const rotz = Matrix4x4.createRz(theta);
            this.localMatrix = rotz.mul(this.localMatrix);
        } else if (relative2 === this.parent) { // relative to parent
            const rotz = Matrix4x4.createRz(theta);
            this.localMatrix = this.localMatrix.mul(rotz);
        } else { // relative to arbitrary axes
            throw new Error('Cannot rotate relative to arbitrary axis!');
        }
        this.invalidateSubtree();
    }

    mapPos(v: Vector1x4, tgt: RefFrame) {
        if (tgt === this.parent) {
            return v.mul(this.localMatrix);
        } else if (tgt.parent === null) {
            return v.mul(this.modelMatrix);
        } else {
            return v.mul(this.modelMatrix).mul(tgt.modelMatrix.inverse());
        }
    }
}

