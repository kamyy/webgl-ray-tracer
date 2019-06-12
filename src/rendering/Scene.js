// @flow
import objParser from 'wavefront-obj-parser';
import Vector1x4 from '../math/Vector1x4.js';

export default class Scene {
    url: string;
    tri: Object[];
    pos: Vector1x4[];
    nrm: Vector1x4[];

    constructor(url: string) {
        this.url = url;
    }

    async fetchWavefrontObj(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Cannot GET ${url} status=${response.status}`);
        }
        return response.text();
    }

    async init(): Promise<void> {
        let obj;
        try {
            obj = objParser(await this.fetchWavefrontObj(this.url));
        }
        catch (e) {
            throw e;
        }

        this.tri = [];
        this.pos = [];
        this.nrm = [];

        const idxCount = obj.vertexPositionIndices.length; // 4 elements per face
        const posCount = obj.vertexPositions.length; // 3 elements per pos
        const nrmCount = obj.vertexNormals.length;   // 3 elements per nrm

        const numVertexNormals = nrmCount / 3;

        let faceIndex = 0;

        for (let i = 0; i < idxCount; i += 4) { // each element vertex position/normal index
            this.tri.push({
                p0: obj.vertexPositionIndices[i],
                p1: obj.vertexPositionIndices[i + 1],
                p2: obj.vertexPositionIndices[i + 2],

                n0: obj.vertexNormalIndices[i],
                n1: obj.vertexNormalIndices[i + 1],
                n2: obj.vertexNormalIndices[i + 2],

                fn: numVertexNormals + faceIndex, // face normal index
                mi: 1 // material index
            });

            ++faceIndex;
        }

        for (let i = 0; i < posCount; i += 3) { // each element is x, y or z
            this.pos.push(new Vector1x4(
                obj.vertexPositions[i], 
                obj.vertexPositions[i + 1], 
                obj.vertexPositions[i + 2], 
                1.0
            ));
        }

        for (let i = 0; i < nrmCount; i += 3) { // each element is x, y or z
            this.nrm.push(new Vector1x4(
                obj.vertexNormals[i], 
                obj.vertexNormals[i + 1], 
                obj.vertexNormals[i + 2], 
                0.0
            ));
        }

        this.tri.forEach(tri => {
            const a = this.pos[tri.p1].sub(this.pos[tri.p0]);
            const b = this.pos[tri.p2].sub(this.pos[tri.p0]);
            const n = a.cross(b); n.w = 0.0;
            this.nrm.push(n);
        });

        console.log(`# of tri ${this.tri.length}`);
        console.log(`# of pos ${this.pos.length}`);
        console.log(`# of nrm ${this.nrm.length}`);
    }
}