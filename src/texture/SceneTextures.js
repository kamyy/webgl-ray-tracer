// @flow

import wavefrontObjParser from 'obj-file-parser';
import wavefrontMtlParser from 'mtl-file-parser';

import Material from '../material/Material.js';
import {
    EMISSIVE_MATERIAL,
    METALLIC_MATERIAL,
    LAMBERTIAN_MATERIAL,
    DIELECTRIC_MATERIAL,
}   from '../material/Material.js';

import Vector1x4 from '../math/Vector1x4.js';

const X_AXIS = 0;
const Y_AXIS = 1;
const Z_AXIS = 2;
const BV_MIN_DELTA = 0.01;

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
    lt: number; // lt child BV index
    rt: number; // rt child BV index
    fi: number[]; // face indices

    constructor(min: Vector1x4, max: Vector1x4) {
        this.min = min;
        this.max = max;
        this.lt = -2.0;
        this.rt = -2.0;
        this.fi = [ -2.0, -2.0 ];
    }

    subDivide(faces: Face[], AABBs: BV[]) {
        if (faces.length <= this.fi.length) { // all the faces fit in this node
            faces.forEach((face, i) => this.fi[i] = face.fi);
        } else { // split the AABB into two across the longest AABB axis
            const dx = Math.abs(this.max.x - this.min.x);
            const dy = Math.abs(this.max.y - this.min.y);
            const dz = Math.abs(this.max.z - this.min.z);
            const largestDelta = Math.max(dx, dy, dz);

            if (largestDelta === dx) {
                this.splitAcross(X_AXIS, faces, AABBs); // split BV AABB across x axis
            } else {
                if (largestDelta === dy) {
                    this.splitAcross(Y_AXIS, faces, AABBs); // split BV AABB across y axis
                } else {
                    this.splitAcross(Z_AXIS, faces, AABBs); // split BV AABB across z axis
                }
            }
        }
    }

    splitAcross(axis: 0 | 1 | 2, faces: Face[], AABBs: BV[]) {
        const sorted = [...faces].sort((faceA, faceB) => {
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
        const ltFaces = sorted.slice(0, h); // left faces
        const rtFaces = sorted.slice(h, l); // right faces
        let ltBV = null;
        let rtBV = null;

        if (ltFaces.length > 0) {
            const min = new Vector1x4(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
            const max = new Vector1x4(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
            ltFaces.forEach(f => {
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

            this.lt = AABBs.length;
            ltBV = new BV(min, max);
            AABBs.push(ltBV);
        }

        if (rtFaces.length > 0) {
            const min = new Vector1x4(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
            const max = new Vector1x4(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
            rtFaces.forEach(f => {
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

            this.rt = AABBs.length;
            rtBV = new BV(min, max);
            AABBs.push(rtBV);
        }

        if (ltBV) { ltBV.subDivide(ltFaces, AABBs); }
        if (rtBV) { rtBV.subDivide(rtFaces, AABBs); }
    }
}

export default class SceneTextures {
    objUrl: string;
    mtlUrl: string;
    objCount: number;
    mtlCount: number;
    facesTexture: WebGLTexture;
    AABBsTexture: WebGLTexture;
    mtlsTexture: WebGLTexture;

    constructor(GL: any, objUrl: string, mtlUrl: string) {
        this.objUrl = objUrl;
        this.mtlUrl = mtlUrl;
        this.objCount = 0;
        this.mtlCount = 0
        this.facesTexture = GL.createTexture();
        this.AABBsTexture = GL.createTexture();
        this.mtlsTexture = GL.createTexture();
    }

    async fetchTextFile(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Cannot GET ${url} status=${response.status}`);
        }
        return response.text();
    }

    async init(GL: any): Promise<void> {
        let wavefrontObj;
        let wavefrontMtl;
        try {
            const _wavefrontObjParser = new wavefrontObjParser(await this.fetchTextFile(this.objUrl));
            const _wavefrontMtlParser = new wavefrontMtlParser(await this.fetchTextFile(this.mtlUrl));
            wavefrontObj = _wavefrontObjParser.parse();
            wavefrontMtl = _wavefrontMtlParser.parse();
        }
        catch (e) {
            throw e;
        }

        let posArray = [];
        let nrmArray = [];

        const parsedObjs = wavefrontObj.models.map(({ vertices, vertexNormals, faces }) => {
            const outFaces = [];
            posArray = posArray.concat(vertices);
            nrmArray = nrmArray.concat(vertexNormals);

            faces.forEach((f, i) => {
                let p0 = (f.vertices[0].vertexIndex - 1); p0 = posArray[p0]; p0 = new Vector1x4(p0.x, p0.y, p0.z);
                let p1 = (f.vertices[1].vertexIndex - 1); p1 = posArray[p1]; p1 = new Vector1x4(p1.x, p1.y, p1.z);
                let p2 = (f.vertices[2].vertexIndex - 1); p2 = posArray[p2]; p2 = new Vector1x4(p2.x, p2.y, p2.z);

                let n0 = (f.vertices[0].vertexNormalIndex - 1); n0 = nrmArray[n0]; n0 = new Vector1x4(n0.x, n0.y, n0.z);
                let n1 = (f.vertices[1].vertexNormalIndex - 1); n1 = nrmArray[n1]; n1 = new Vector1x4(n1.x, n1.y, n1.z);
                let n2 = (f.vertices[2].vertexNormalIndex - 1); n2 = nrmArray[n2]; n2 = new Vector1x4(n2.x, n2.y, n2.z);

                const fn = p1.sub(p0).cross(p2.sub(p0)).normalize(); // face normal
                const mi = wavefrontMtl.findIndex(m => m.name === f.material); // material index
                const fi = outFaces.length; // face index

                outFaces.push({
                    p0, p1, p2,
                    n0, n1, n2,
                    fn, mi, fi,
                });
            });
            const outAABBs = [];
            const min = new Vector1x4(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
            const max = new Vector1x4(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
            outFaces.forEach(f => { // calculate min/max for root AABB bounding volume
                min.x = Math.min(min.x, f.p0.x, f.p1.x, f.p2.x);
                min.y = Math.min(min.y, f.p0.y, f.p1.y, f.p2.y);
                min.z = Math.min(min.z, f.p0.z, f.p1.z, f.p2.z);
                max.x = Math.max(max.x, f.p0.x, f.p1.x, f.p2.x);
                max.y = Math.max(max.y, f.p0.y, f.p1.y, f.p2.y);
                max.z = Math.max(max.z, f.p0.z, f.p1.z, f.p2.z);
            });

            if (max.x - min.x < BV_MIN_DELTA) { max.x += BV_MIN_DELTA; } // don't allow a 2D AABB
            if (max.y - min.y < BV_MIN_DELTA) { max.y += BV_MIN_DELTA; }
            if (max.z - min.z < BV_MIN_DELTA) { max.z += BV_MIN_DELTA; }
            const bv = new BV(min, max); outAABBs.push(bv);
            bv.subDivide(outFaces, outAABBs);

            console.log(`# faces ${outFaces.length}`);
            console.log(`# AABBs ${outAABBs.length}`);
            return { // a parsed obj containing faces and its corresponding BVH tree
                faces: outFaces,
                AABBs: outAABBs,
            };
        });

        const parsedMtls = wavefrontMtl.map(mtl => {
            const mat = new Material(new Vector1x4(mtl.Kd.red, mtl.Kd.green, mtl.Kd.blue));
            // 'Metal 0', 0.95, 'Glass 0', 0.00, 1.33
            switch (mtl.name) {
            case 'teapot':
                mat.mtlCls = METALLIC_MATERIAL;
                mat.reflectionGloss = 1.0;
                break;
            case 'light':
                mat.mtlCls = EMISSIVE_MATERIAL;
                mat.albedo.r = 2.5;
                mat.albedo.g = 2.5;
                mat.albedo.b = 2.5;
                break;
            default:
                break;
            }
            return mat;
        });
        console.log(`# mtls ${parsedMtls.length}`);

        this.initTextures(GL, parsedObjs, parsedMtls);
        this.objCount = parsedObjs.length;
        this.mtlCount = parsedMtls.length;
    }

    initTextures(GL: any, parsedObjs: Object[], parsedMtls: Object[]) {
        const maxNumFaces = parsedObjs.reduce((max, obj) => Math.max(max, obj.faces.length), 0); // max number of faces
        const numTexelsPerFace = 8; // RGBA texel
        const numFloatsPerFace = 24;

        let data = new Float32Array(numFloatsPerFace * maxNumFaces * parsedObjs.length);
        parsedObjs.forEach((obj, id) => {
            let i = numFloatsPerFace * maxNumFaces * id; // index to start of texture slice for object's faces
            obj.faces.forEach(face => {
                data[i++] = face.fn.x; data[i++] = face.fn.y; data[i++] = face.fn.z; // face unit normal

                data[i++] = face.p0.x; data[i++] = face.p0.y; data[i++] = face.p0.z; // vertex positions
                data[i++] = face.p1.x; data[i++] = face.p1.y; data[i++] = face.p1.z;
                data[i++] = face.p2.x; data[i++] = face.p2.y; data[i++] = face.p2.z;

                data[i++] = face.n0.x; data[i++] = face.n0.y; data[i++] = face.n0.z; // vertex normals
                data[i++] = face.n1.x; data[i++] = face.n1.y; data[i++] = face.n1.z;
                data[i++] = face.n2.x; data[i++] = face.n2.y; data[i++] = face.n2.z;

                data[i] = face.mi + 0.5; // material index is cast to int in fragment shader
                i += 3;
            });
        });
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D_ARRAY, this.facesTexture);
        GL.texParameteri(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texImage3D(GL.TEXTURE_2D_ARRAY, 0, GL.RGB32F, numTexelsPerFace, maxNumFaces, parsedObjs.length, 0, GL.RGB, GL.FLOAT, data);

        const maxNumBVs = parsedObjs.reduce((val, obj) => Math.max(val, obj.AABBs.length), 0); // max number of BV nodes
        const numTexelsPerBV = 3; // RGBA texel
        const numFloatsPerBV = 12;

        data = new Float32Array(numFloatsPerBV * maxNumBVs * parsedObjs.length);
        parsedObjs.forEach((obj, id) => {
            let i = numFloatsPerBV * maxNumBVs * id; // index to start of texture slice for the object's BVH tree
            obj.AABBs.forEach(bv => {
                data[i++] = bv.min.x;
                data[i++] = bv.min.y;
                data[i++] = bv.min.z;
                data[i++] = 1.0;

                data[i++] = bv.max.x;
                data[i++] = bv.max.y;
                data[i++] = bv.max.z;
                data[i++] = 1.0;

                data[i++] = bv.lt + 0.5; // lt node index is cast to int in fragment shader
                data[i++] = bv.rt + 0.5; // rt node index is cast to int in fragment shader
                data[i++] = bv.fi[0] + 0.5; // face index is cast to int in fragment shader
                data[i++] = bv.fi[1] + 0.5; // face index is cast to int in fragment shader
            })
        });
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D_ARRAY, this.AABBsTexture);
        GL.texParameteri(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texImage3D(GL.TEXTURE_2D_ARRAY, 0, GL.RGBA32F, numTexelsPerBV, maxNumBVs, parsedObjs.length, 0, GL.RGBA, GL.FLOAT, data);

        const numTexelsPerMtl = 2;
        const numFloatsPerMtl = 8;
        data = new Float32Array(numFloatsPerMtl * parsedMtls.length);
        parsedMtls.forEach((mtl, id) => {
            let i = numFloatsPerMtl * id;
            data[i++] = mtl.albedo.x;
            data[i++] = mtl.albedo.y;
            data[i++] = mtl.albedo.z;
            data[i++] = mtl.albedo.w;

            data[i++] = mtl.mtlCls + 0.5; // material type is cast to int in fragment shader
            data[i++] = mtl.reflectionGloss;
            data[i++] = mtl.refractionIndex;
        });
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D, this.mtlsTexture);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32F, numTexelsPerMtl, parsedMtls.length, 0, GL.RGBA, GL.FLOAT, data);
    }

    bindToSampleShader(GL: any, program: WebGLProgram) {
        GL.activeTexture(GL.TEXTURE3);
        GL.bindTexture(GL.TEXTURE_2D_ARRAY, this.facesTexture);
        GL.uniform1i(GL.getUniformLocation(program, 'u_face_sampler'), 3);

        GL.activeTexture(GL.TEXTURE4);
        GL.bindTexture(GL.TEXTURE_2D_ARRAY, this.AABBsTexture);
        GL.uniform1i(GL.getUniformLocation(program, 'u_aabb_sampler'), 4);

        GL.activeTexture(GL.TEXTURE5);
        GL.bindTexture(GL.TEXTURE_2D, this.mtlsTexture);
        GL.uniform1i(GL.getUniformLocation(program, 'u_mtl_sampler'), 5);
    }
}