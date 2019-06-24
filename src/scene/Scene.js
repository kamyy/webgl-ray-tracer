// @flow

import objParser from 'wavefront-obj-parser';

import Vector1x4 from '../math/Vector1x4.js';
import MetallicMaterial from '../material/MetallicMaterial.js';
import LambertianMaterial from '../material/LambertianMaterial.js';
import DielectricMaterial from '../material/DielectricMaterial.js';

const SIZEOF_INT32 = 4;
const SIZEOF_FLOAT32 = 4;

const X_AXIS = 0;
const Y_AXIS = 1;
const Z_AXIS = 2;

export const SIZEOF_TRI = 32;
export const SIZEOF_POS = 16;
export const SIZEOF_NRM = 16;
export const SIZEOF_MAT = 32;
export const SIZEOF_BV  = 48;

type Tri = {
    p0: number, // indices into posArray
    p1: number,
    p2: number,

    n0: number, // indices into nrmArray
    n1: number,
    n2: number,
    fn: number,

    fi: number, // index into triArray
    mi: number, // index into matArray
};

class BV { // AABB bounding volume
    min: Vector1x4; // min corner
    max: Vector1x4; // max corner
    lt: number; // lt child bounding volume index
    rt: number; // rt child bounding volume index
    fi: number[]; // face indices

    constructor(min: Vector1x4, max: Vector1x4) {
        this.min = min;
        this.max = max;
        this.lt = -1;
        this.rt = -1;
        this.fi = [ -1, -1 ];
    }

    subDivide(triArray: Tri[], posArray: Vector1x4[], bvhArray: BV[]) {
        if (triArray.length <= this.fi.length) { // all the faces fit in this node
            triArray.forEach((tri, i) => this.fi[i] = tri.fi);
        } else { // split the AABB into two across the longest AABB axis
            const dx = Math.abs(this.max.x - this.min.x);
            const dy = Math.abs(this.max.y - this.min.y);
            const dz = Math.abs(this.max.z - this.min.z);
            const largestDelta = Math.max(dx, dy, dz);

            if (largestDelta === dx) {
                this.splitAcross(X_AXIS, triArray, posArray, bvhArray); // split BV AABB across x axis
            } else {
                if (largestDelta === dy) {
                    this.splitAcross(Y_AXIS, triArray, posArray, bvhArray); // split BV AABB across y axis
                } else { 
                    this.splitAcross(Z_AXIS, triArray, posArray, bvhArray); // split BV AABB across z axis
                }
            }
        }
    }

    splitAcross(axis: number, triArray: Tri[], posArray: Vector1x4[], bvhArray: BV[]) {
        const sorted = [...triArray].sort((a, b) => {
            let a0 = posArray[a.p0].xyzw[axis];
            let a1 = posArray[a.p1].xyzw[axis];
            let a2 = posArray[a.p2].xyzw[axis];

            let b0 = posArray[b.p0].xyzw[axis];
            let b1 = posArray[b.p1].xyzw[axis];
            let b2 = posArray[b.p2].xyzw[axis];

            return ((a0 + a1 + a2) / 3.0) - ((b0 + b1 + b2) / 3.0);
        });

        const h = Math.floor(sorted.length / 2);
        const l = sorted.length;
        const ltTriArray = sorted.slice(0, h);
        const rtTriArray = sorted.slice(h, l);
        let ltBV = null;
        let rtBV = null;

        if (ltTriArray.length > 0) {
            const min = new Vector1x4(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            const max = new Vector1x4(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
            ltTriArray.forEach(tri => {
                const p0 = posArray[tri.p0];
                const p1 = posArray[tri.p1];
                const p2 = posArray[tri.p2];
                min.x = Math.min(min.x, p0.x, p1.x, p2.x);
                min.y = Math.min(min.y, p0.y, p1.y, p2.y);
                min.z = Math.min(min.z, p0.z, p1.z, p2.z);
                max.x = Math.max(max.x, p0.x, p1.x, p2.x);
                max.y = Math.max(max.y, p0.y, p1.y, p2.y);
                max.z = Math.max(max.z, p0.z, p1.z, p2.z);
            });
            this.lt = bvhArray.length;
            ltBV = new BV(min, max);
            bvhArray.push(ltBV);
        }

        if (rtTriArray.length > 0) {
            const min = new Vector1x4(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            const max = new Vector1x4(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
            rtTriArray.forEach(tri => {
                const p0 = posArray[tri.p0];
                const p1 = posArray[tri.p1];
                const p2 = posArray[tri.p2];
                min.x = Math.min(min.x, p0.x, p1.x, p2.x);
                min.y = Math.min(min.y, p0.y, p1.y, p2.y);
                min.z = Math.min(min.z, p0.z, p1.z, p2.z);
                max.x = Math.max(max.x, p0.x, p1.x, p2.x);
                max.y = Math.max(max.y, p0.y, p1.y, p2.y);
                max.z = Math.max(max.z, p0.z, p1.z, p2.z);
            });
            this.rt = bvhArray.length;
            rtBV = new BV(min, max);
            bvhArray.push(rtBV);
        }

        if (ltBV) { ltBV.subDivide(ltTriArray, posArray, bvhArray); }
        if (rtBV) { rtBV.subDivide(rtTriArray, posArray, bvhArray); }
    }
}

export default class Scene {
    url: string;

    triArray: Tri[];
    posArray: Vector1x4[];
    nrmArray: Vector1x4[];

    triTypedArray: Int32Array;
    posTypedArray: Float32Array;
    nrmTypedArray: Float32Array;
    matArrayBuffer: ArrayBuffer;
    bvhArrayBuffer: ArrayBuffer;

    constructor(url: string) {
        this.url = url;
    }

    async init(): Promise<void> {
        let obj;
        try {
            obj = objParser(await this.fetchWavefrontObj(this.url));
        }
        catch (e) {
            throw e;
        }
        this.initTri(obj);
        this.initPos(obj);
        this.initNrm(obj);
        this.initMat();
        this.initBVH();
    }

    async fetchWavefrontObj(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Cannot GET ${url} status=${response.status}`);
        }
        return response.text();
    }

    isLittleEndian() {
        const arrayA = new Uint32Array([0x11223344]);
        const arrayB = new Uint8Array(arrayA.buffer);
        return (arrayB[0] === 0x44);
    }

    initTri(obj: Object) {
        const numVertexNormals = obj.vertexNormals.length / 3;
        let f = 0;

        this.triArray = [];

        for (let i = 0; i < obj.vertexPositionIndices.length; i += 4) { // for each vertex position index
            this.triArray.push({
                p0: obj.vertexPositionIndices[i],   // indices into this.posArray
                p1: obj.vertexPositionIndices[i + 1],
                p2: obj.vertexPositionIndices[i + 2],

                n0: obj.vertexNormalIndices[i],     // indices into this.nrmArray  
                n1: obj.vertexNormalIndices[i + 1],
                n2: obj.vertexNormalIndices[i + 2],
                fn: numVertexNormals + f,

                fi: f, // index into this.triArray
                mi: 1, // index into this.matArray
            });

            ++f;
        }

        this.triTypedArray = new Int32Array(this.triArray.length * SIZEOF_TRI / SIZEOF_INT32);
        let i = 0;
        this.triArray.forEach(tri => {
            this.triTypedArray[i++] = tri.p0;
            this.triTypedArray[i++] = tri.p1;
            this.triTypedArray[i++] = tri.p2;
            this.triTypedArray[i++] = tri.n0;
            this.triTypedArray[i++] = tri.n1;
            this.triTypedArray[i++] = tri.n2;
            this.triTypedArray[i++] = tri.fn;
            this.triTypedArray[i++] = tri.mi;
        });

        console.log(`# of tri ${this.triArray.length}`);
    }

    initPos(obj) {
        this.posArray = [];

        for (let i = 0; i < obj.vertexPositions.length; i += 3) { // each element is x, y or z
            this.posArray.push(new Vector1x4(
                obj.vertexPositions[i], 
                obj.vertexPositions[i + 1], 
                obj.vertexPositions[i + 2], 
                1.0
            ));
        }

        this.posTypedArray = new Float32Array(this.posArray.length * SIZEOF_POS / SIZEOF_FLOAT32);
        let i = 0;
        this.posArray.forEach(p => {
            this.posTypedArray[i++] = p.x;
            this.posTypedArray[i++] = p.y;
            this.posTypedArray[i++] = p.z;
            ++i; // padding
        });

        console.log(`# of pos ${this.posArray.length}`);
    }

    initNrm(obj) {
        this.nrmArray = [];

        for (let i = 0; i < obj.vertexNormals.length; i += 3) { // each element is x, y or z
            this.nrmArray.push(new Vector1x4(
                obj.vertexNormals[i], 
                obj.vertexNormals[i + 1], 
                obj.vertexNormals[i + 2], 
                0.0
            ));
        }

        this.triArray.forEach(tri => {
            const a = this.posArray[tri.p1].sub(this.posArray[tri.p0]);
            const b = this.posArray[tri.p2].sub(this.posArray[tri.p0]);
            const n = a.cross(b).normalize(); n.w = 0.0;
            this.nrmArray.push(n);
        });

        this.nrmTypedArray = new Float32Array(this.nrmArray.length * SIZEOF_NRM / SIZEOF_FLOAT32);
        let i = 0;
        this.nrmArray.forEach(n => {
            this.nrmTypedArray[i++] = n.x;
            this.nrmTypedArray[i++] = n.y;
            this.nrmTypedArray[i++] = n.z;
            ++i; // padding
        });

        console.log(`# of nrm ${this.nrmArray.length}`);
    }

    initMat() {
        const matArray = [
            new MetallicMaterial(
                'Metal 0',
                new Vector1x4(0.9, 0.9, 0.9), 
                0.95,
            ),
            new LambertianMaterial(
                'Matte 0',
                new Vector1x4(0.4, 0.4, 0.8)
            ),
            new LambertianMaterial(
                'Matte 1',
                new Vector1x4(0.5, 0.1, 0.1)
            ),
            new LambertianMaterial(
                'Matte 2',
                new Vector1x4(0.8, 0.1, 0.8)
            ),
            new DielectricMaterial(
                'Glass 0',
                new Vector1x4(1.0, 1.0, 1.0), 
                1.33
            ),
        ];

        const littleEndian = this.isLittleEndian();

        this.matArrayBuffer = new ArrayBuffer(matArray.length * SIZEOF_MAT);
        matArray.forEach((mat, i) => {
            const dv = new DataView(this.matArrayBuffer, i * SIZEOF_MAT, SIZEOF_MAT);
            dv.setFloat32( 0, mat.albedo.x, littleEndian);
            dv.setFloat32( 4, mat.albedo.y, littleEndian);
            dv.setFloat32( 8, mat.albedo.z, littleEndian);
            dv.setFloat32(12, 1.0, littleEndian);

            if (mat.shininess !== undefined) 
                dv.setFloat32(16, mat.shininess, littleEndian);
            if (mat.refractionIndex !== undefined) 
                dv.setFloat32(20, mat.refractionIndex, littleEndian);

            dv.setInt32(24, mat.materialClass, littleEndian);
        });

        console.log(`# of mat ${matArray.length}`);
    }

    initBVH() {
        const littleEndian = this.isLittleEndian();
        const bvhArray = [];

        const min = new Vector1x4(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        const max = new Vector1x4(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
        this.posArray.forEach(p => { // calculate min/max for root AABB bounding volume
            min.x = Math.min(min.x, p.x);
            min.y = Math.min(min.y, p.y);
            min.z = Math.min(min.z, p.z);
            max.x = Math.max(max.x, p.x);
            max.y = Math.max(max.y, p.y);
            max.z = Math.max(max.z, p.z);
        });

        const bv = new BV(min, max);
        bvhArray.push(bv);
        bv.subDivide(this.triArray, this.posArray, bvhArray);

        this.bvhArrayBuffer = new ArrayBuffer(bvhArray.length * SIZEOF_BV);
        bvhArray.forEach((bv, i) => {
            const dv = new DataView(this.bvhArrayBuffer, i * SIZEOF_BV, SIZEOF_BV);
            dv.setFloat32( 0, bv.min.x, littleEndian);
            dv.setFloat32( 4, bv.min.y, littleEndian);
            dv.setFloat32( 8, bv.min.z, littleEndian);
            dv.setFloat32(12, 1.0, littleEndian);

            dv.setFloat32(16, bv.max.x, littleEndian);
            dv.setFloat32(20, bv.max.y, littleEndian);
            dv.setFloat32(24, bv.max.z, littleEndian);
            dv.setFloat32(28, 1.0, littleEndian);

            dv.setInt32(32, bv.lt, littleEndian);
            dv.setInt32(36, bv.rt, littleEndian);

            dv.setInt32(40, bv.fi[0], littleEndian);
            dv.setInt32(44, bv.fi[1], littleEndian);
        });

        console.log(`# of BV ${bvhArray.length}`);
    }
}