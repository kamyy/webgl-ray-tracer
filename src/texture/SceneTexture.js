// @flow

import objParser from 'wavefront-obj-parser';

import Material from '../material/Material.js';
import {
    METALLIC_MATERIAL_CLASS,
    LAMBERTIAN_MATERIAL_CLASS,
    DIELECTRIC_MATERIAL_CLASS,
}   from '../material/Material.js';

import Vector1x4 from '../math/Vector1x4.js';
import { GL } from '../component/Canvas.js';

const X_AXIS = 0;
const Y_AXIS = 1;
const Z_AXIS = 2;
const BV_MIN_DELTA = 0.01;

export const SIZEOF_MAT = 32;

type Face = {
    p0: Vector1x4, // vertex position 0
    p1: Vector1x4, // vertex position 1
    p2: Vector1x4, // vertex position 2

    n0: Vector1x4, // vertex normal 0
    n1: Vector1x4, // vertex normal 1
    n2: Vector1x4, // vertex normal 2

    fn: Vector1x4, // face normal
    fi: number,    // index into root face array
    mi: number,    // index into material array
};

class BV { // AABB bounding volume
    min: Vector1x4; // min corner
    max: Vector1x4; // max corner
    lt: number; // lt child bounding volume index (cast to int in shader)
    rt: number; // rt child bounding volume index (cast to int in shader)
    fi: number[]; // face indices

    constructor(min: Vector1x4, max: Vector1x4) {
        this.min = min;
        this.max = max;
        this.lt = -1.5; // cast to int in shader
        this.rt = -1.5; // cast to int in shader
        this.fi = [ -1.5, -1.5 ]; // these indices are cast to int in shader
    }

    subDivide(faceArray: Face[], bvhArray: BV[]) {
        if (faceArray.length <= this.fi.length) { // all the faces fit in this node
            faceArray.forEach((face, i) => this.fi[i] = face.fi + 0.5); // cast to int in shader
        } else { // split the AABB into two across the longest AABB axis
            const dx = Math.abs(this.max.x - this.min.x);
            const dy = Math.abs(this.max.y - this.min.y);
            const dz = Math.abs(this.max.z - this.min.z);
            const largestDelta = Math.max(dx, dy, dz);

            if (largestDelta === dx) {
                this.splitAcross(X_AXIS, faceArray, bvhArray); // split BV AABB across x axis
            } else {
                if (largestDelta === dy) {
                    this.splitAcross(Y_AXIS, faceArray, bvhArray); // split BV AABB across y axis
                } else {
                    this.splitAcross(Z_AXIS, faceArray, bvhArray); // split BV AABB across z axis
                }
            }
        }
    }

    splitAcross(axis: number, faceArray: Face[], bvhArray: BV[]) {
        const sorted = [...faceArray].sort((faceA, faceB) => {
            const a0 = faceA.p0.xyzw[axis];
            const a1 = faceA.p1.xyzw[axis];
            const a2 = faceA.p2.xyzw[axis];

            const b0 = faceB.p0.xyzw[axis];
            const b1 = faceB.p1.xyzw[axis];
            const b2 = faceB.p2.xyzw[axis];

            return ((a0 + a1 + a2) / 3.0) - ((b0 + b1 + b2) / 3.0);
        });

        const h = sorted.length / 2;
        const l = sorted.length;
        const ltFaceArray = sorted.slice(0, h);
        const rtFaceArray = sorted.slice(h, l);
        let ltBV = null;
        let rtBV = null;

        if (ltFaceArray.length > 0) {
            const min = new Vector1x4(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            const max = new Vector1x4(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
            ltFaceArray.forEach(face => {
                min.x = Math.min(min.x, face.p0.x, face.p1.x, face.p2.x);
                min.y = Math.min(min.y, face.p0.y, face.p1.y, face.p2.y);
                min.z = Math.min(min.z, face.p0.z, face.p1.z, face.p2.z);
                max.x = Math.max(max.x, face.p0.x, face.p1.x, face.p2.x);
                max.y = Math.max(max.y, face.p0.y, face.p1.y, face.p2.y);
                max.z = Math.max(max.z, face.p0.z, face.p1.z, face.p2.z);
            });
            if (max.x - min.x < BV_MIN_DELTA) { max.x += BV_MIN_DELTA; }
            if (max.y - min.y < BV_MIN_DELTA) { max.y += BV_MIN_DELTA; }
            if (max.z - min.z < BV_MIN_DELTA) { max.z += BV_MIN_DELTA; }

            this.lt = bvhArray.length + 0.5;
            ltBV = new BV(min, max);
            bvhArray.push(ltBV);
        }

        if (rtFaceArray.length > 0) {
            const min = new Vector1x4(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            const max = new Vector1x4(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
            rtFaceArray.forEach(face => {
                min.x = Math.min(min.x, face.p0.x, face.p1.x, face.p2.x);
                min.y = Math.min(min.y, face.p0.y, face.p1.y, face.p2.y);
                min.z = Math.min(min.z, face.p0.z, face.p1.z, face.p2.z);
                max.x = Math.max(max.x, face.p0.x, face.p1.x, face.p2.x);
                max.y = Math.max(max.y, face.p0.y, face.p1.y, face.p2.y);
                max.z = Math.max(max.z, face.p0.z, face.p1.z, face.p2.z);
            });
            if (max.x - min.x < BV_MIN_DELTA) { max.x += BV_MIN_DELTA; }
            if (max.y - min.y < BV_MIN_DELTA) { max.y += BV_MIN_DELTA; }
            if (max.z - min.z < BV_MIN_DELTA) { max.z += BV_MIN_DELTA; }

            this.rt = bvhArray.length + 0.5;
            rtBV = new BV(min, max);
            bvhArray.push(rtBV);
        }

        if (ltBV) { ltBV.subDivide(ltFaceArray, bvhArray); }
        if (rtBV) { rtBV.subDivide(rtFaceArray, bvhArray); }
    }
}

export default class SceneTexture {
    url: string;

    faceArray: Face[];
    posArray: Vector1x4[];
    nrmArray: Vector1x4[];

    faceTexture: WebGLTexture;
    matArrayBuffer: ArrayBuffer;

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
        this.initFaceTexture(obj);
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

    initFaceTexture(obj: Object) {
        const posArray = [];
        const nrmArray = [];
        this.faceArray = [];

        for (let i = 0; i < obj.vertexPositions.length; i += 3) {
            posArray.push(new Vector1x4( // for each wavefront obj vertex position
                obj.vertexPositions[i], // x coordinate
                obj.vertexPositions[i + 1], // y coordinate
                obj.vertexPositions[i + 2], // z coordinate
            ));
        }
        for (let i = 0; i < obj.vertexNormals.length; i += 3) {
            nrmArray.push(new Vector1x4( // for each wavefront obj vertex normal
                obj.vertexNormals[i], // x coordinate
                obj.vertexNormals[i + 1], // y coordinate
                obj.vertexNormals[i + 2], // z coordinate
            ));
        }

        for (let i = 0; i < obj.vertexPositionIndices.length; i += 4) { // for each wavefront obj face
            const p0 = posArray[obj.vertexPositionIndices[i]]; // vertex 0 position
            const p1 = posArray[obj.vertexPositionIndices[i + 1]]; // vertex 1 position
            const p2 = posArray[obj.vertexPositionIndices[i + 2]]; // vertex 2 position

            const n0 = nrmArray[obj.vertexNormalIndices[i]]; // vertex 0 normal
            const n1 = nrmArray[obj.vertexNormalIndices[i + 1]]; // vertex 1 normal
            const n2 = nrmArray[obj.vertexNormalIndices[i + 2]]; // vertex 2 normal

            const fn = p1.sub(p0).cross(p2.sub(p0)).normalize(); // face normal
            const fi = this.faceArray.length; // face index
            const mi = 1.5;

            this.faceArray.push({
                p0, p1, p2,
                n0, n1, n2,
                fn, fi, mi,
            });
        }

        const data = new Float32Array(this.faceArray.length * 8 * 3);
        let i = 0;
        this.faceArray.forEach(f => {
            data[i++] = f.fn.x; data[i++] = f.fn.y; data[i++] = f.fn.z;

            data[i++] = f.p0.x; data[i++] = f.p0.y; data[i++] = f.p0.z;
            data[i++] = f.p1.x; data[i++] = f.p1.y; data[i++] = f.p1.z;
            data[i++] = f.p2.x; data[i++] = f.p2.y; data[i++] = f.p2.z;

            data[i++] = f.n0.x; data[i++] = f.n0.y; data[i++] = f.n0.z;
            data[i++] = f.n1.x; data[i++] = f.n1.y; data[i++] = f.n1.z;
            data[i++] = f.n2.x; data[i++] = f.n2.y; data[i++] = f.n2.z;

            data[i++] = f.mi;
            data[i++] = 0.0; // pad
            data[i++] = 0.0; // pad
        });

        this.faceTexture = GL.createTexture();
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D, this.faceTexture);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGB32F, 8, this.faceArray.length, 0, GL.RGB, GL.FLOAT, data);

        console.log(`# of tri ${this.faceArray.length}`);
    }

    initBVH() {
        const min = new Vector1x4(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        const max = new Vector1x4(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
        this.faceArray.forEach(f => { // calculate min/max for root AABB bounding volume
            min.x = Math.min(min.x, f.p0.x, f.p1.x, f.p2.x);
            min.y = Math.min(min.y, f.p0.y, f.p1.y, f.p2.y);
            min.z = Math.min(min.z, f.p0.z, f.p1.z, f.p2.z);
            max.x = Math.max(max.x, f.p0.x, f.p1.x, f.p2.x);
            max.y = Math.max(max.y, f.p0.y, f.p1.y, f.p2.y);
            max.z = Math.max(max.z, f.p0.z, f.p1.z, f.p2.z);
        });

        if (max.x - min.x < BV_MIN_DELTA) { max.x += BV_MIN_DELTA; }
        if (max.y - min.y < BV_MIN_DELTA) { max.y += BV_MIN_DELTA; }
        if (max.z - min.z < BV_MIN_DELTA) { max.z += BV_MIN_DELTA; }

        const bv = new BV(min, max);
        const bvhArray = [];
        bvhArray.push(bv);

        bv.subDivide(this.faceArray, bvhArray);

        const data = new Float32Array(bvhArray.length * 3 * 4);
        let i = 0;
        bvhArray.forEach(bv => {
            data[i++] = bv.min.x;
            data[i++] = bv.min.y;
            data[i++] = bv.min.z;
            data[i++] = 1.0;

            data[i++] = bv.max.x;
            data[i++] = bv.max.y;
            data[i++] = bv.max.z;
            data[i++] = 1.0;

            data[i++] = bv.lt;
            data[i++] = bv.rt;
            data[i++] = bv.fi[0];
            data[i++] = bv.fi[1];
        });

        this.bvhTexture = GL.createTexture();
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D, this.bvhTexture);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32F, 3, bvhArray.length, 0, GL.RGBA, GL.FLOAT, data);

        console.log(`# of BV ${bvhArray.length}`);
    }

    initMat() {
        const matArray : Material[] = [
            new Material(
                METALLIC_MATERIAL_CLASS,
                'Metal 0',
                new Vector1x4(0.9, 0.9, 0.9),
                0.95,
            ),
            new Material(
                LAMBERTIAN_MATERIAL_CLASS,
                'Matte 0',
                new Vector1x4(0.4, 0.4, 0.8)
            ),
            new Material(
                LAMBERTIAN_MATERIAL_CLASS,
                'Matte 1',
                new Vector1x4(0.5, 0.1, 0.1)
            ),
            new Material(
                LAMBERTIAN_MATERIAL_CLASS,
                'Matte 2',
                new Vector1x4(0.8, 0.1, 0.8)
            ),
            new Material(
                DIELECTRIC_MATERIAL_CLASS,
                'Glass 0',
                new Vector1x4(1.0, 1.0, 1.0),
                0.00,
                1.33
            ),
        ];

        const data = new Float32Array(matArray.length * 2 * 3);
        let i = 0;
        matArray.forEach(mat => {
            data[i++] = mat.albedo.x;
            data[i++] = mat.albedo.y;
            data[i++] = mat.albedo.z;

            data[i++] = mat.shininess;
            data[i++] = mat.refractionIdx;
            data[i++] = mat.materialClass + 0.5;
        });

        this.matTexture = GL.createTexture();
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D, this.matTexture);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGB32F, 2, matArray.length, 0, GL.RGB, GL.FLOAT, data);

        console.log(`# of mat ${matArray.length}`);
    }

    bindToSampleShader(program: WebGLProgram) {
        GL.activeTexture(GL.TEXTURE3);
        GL.bindTexture(GL.TEXTURE_2D, this.faceTexture);
        GL.uniform1i(GL.getUniformLocation(program, 'u_face_sampler'), 3);

        GL.activeTexture(GL.TEXTURE4);
        GL.bindTexture(GL.TEXTURE_2D, this.bvhTexture);
        GL.uniform1i(GL.getUniformLocation(program, 'u_bvh_sampler'), 4);

        GL.activeTexture(GL.TEXTURE5);
        GL.bindTexture(GL.TEXTURE_2D, this.matTexture);
        GL.uniform1i(GL.getUniformLocation(program, 'u_mat_sampler'), 5);
    }
}