// @flow
import {
    reduxStore
}   from '../redux/reducers.js';

import {
    GL, camera
}   from '../components/Canvas.js';

import Scene from './Scene.js';
import Matrix4x4 from '../math/Matrix4x4.js';

import NoiseTexture from './NoiseTexture.js';
import MetallicMaterial from './MetallicMaterial.js';
import LambertianMaterial from './LambertianMaterial.js';
import DielectricMaterial from './DielectricMaterial.js';

const vertShaderURL = '/vert.glsl';
const fragShaderURL = '/frag.glsl';

const SIZEOF_I32 = 4;
const SIZEOF_F32 = 4;
const SIZEOF_TRI = 32;
const SIZEOF_POS = 16;
const SIZEOF_NRM = 16;
const MAX_TRI_COUNT = 1024;
const MAX_POS_COUNT = MAX_TRI_COUNT * 3;
const MAX_NRM_COUNT = MAX_TRI_COUNT * 3 + MAX_TRI_COUNT;

export default class Shader {
    initialized: boolean;
    wd: number;
    ht: number;

    scene: Scene;
    typedArrayF: Int32Array;
    typedArrayP: Float32Array;
    typedArrayN: Float32Array;

    vs: WebGLShader;
    fs: WebGLShader;
    program: WebGLProgram;
    vtxBuff: WebGLBuffer;
    bufferF: WebGLBuffer;
    bufferP: WebGLBuffer;
    bufferN: WebGLBuffer;

    noiseTexture: NoiseTexture;

    constructor(wd: number, ht: number) {
        this.initialized = false;
        this.wd = wd;
        this.ht = ht;
    }

    async fetchShader(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Cannot GET ${url} status=${response.status}`);
        }
        return response.text();
    }

    updateBufferF() {
        let i = 0;

        this.scene.tri.forEach(tri => {
            this.typedArrayF[i] = tri.p0; ++i;
            this.typedArrayF[i] = tri.p1; ++i;
            this.typedArrayF[i] = tri.p2; ++i;
            this.typedArrayF[i] = tri.n0; ++i;
            this.typedArrayF[i] = tri.n1; ++i;
            this.typedArrayF[i] = tri.n2; ++i;
            this.typedArrayF[i] = tri.fn; ++i;
            this.typedArrayF[i] = tri.mi; ++i;
        });

        GL.bindBuffer(GL.UNIFORM_BUFFER, this.bufferF);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, this.typedArrayF); // upload to GPU
    }

    updateBufferP(viewMatrix: Matrix4x4) {
        let i = 0;

        this.scene.pos.forEach(pos => {
            const p = pos.mul(viewMatrix);
            this.typedArrayP[i] = p.x; ++i;
            this.typedArrayP[i] = p.y; ++i;
            this.typedArrayP[i] = p.z; ++i;
            ++i; // padding
        });

        GL.bindBuffer(GL.UNIFORM_BUFFER, this.bufferP);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, this.typedArrayP); // upload to GPU
    }

    updateBufferN(viewMatrix: Matrix4x4) {
        let i = 0;

        this.scene.nrm.forEach(nrm => {
            const n = nrm.mul(viewMatrix);
            this.typedArrayN[i] = n.x; ++i;
            this.typedArrayN[i] = n.y; ++i;
            this.typedArrayN[i] = n.z; ++i;
            ++i; // padding
        });

        GL.bindBuffer(GL.UNIFORM_BUFFER, this.bufferN);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, this.typedArrayN); // upload to GPU
    }

    initVSData() {
        // vertex buffer for clip space rectangle
        this.vtxBuff = GL.createBuffer();
        GL.bindBuffer(GL.ARRAY_BUFFER, this.vtxBuff);
        GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([
            -1, -1, 
            +1, -1,
            +1, +1, 
            -1, +1,
            ]), 
            GL.STATIC_DRAW
        );

        // vertex shader attributes
        const desc = {
            length: 2,
            stride: 8,
            offset: 0
        };
        const loc = GL.getAttribLocation(this.program, 'a_vert_data');
        GL.vertexAttribPointer(
            loc,
            desc.length,
            GL.FLOAT,
            false,
            desc.stride,
            desc.offset,
        );
        GL.enableVertexAttribArray(loc);

        // vertex shader uniforms
        GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_wd'), this.wd * 0.5);
        GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_ht'), this.ht * 0.5);
    }

    initFSData() {
        this.bufferF = GL.createBuffer();
        GL.bindBuffer(GL.UNIFORM_BUFFER, this.bufferF);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_TRI_COUNT * SIZEOF_TRI, GL.STATIC_DRAW);
        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_tri'), 0);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 0, this.bufferF);

        this.bufferP = GL.createBuffer();
        GL.bindBuffer(GL.UNIFORM_BUFFER, this.bufferP);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_POS_COUNT * SIZEOF_POS, GL.DYNAMIC_DRAW);
        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_pos'), 1);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 1, this.bufferP);

        this.bufferN = GL.createBuffer();
        GL.bindBuffer(GL.UNIFORM_BUFFER, this.bufferN);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_NRM_COUNT * SIZEOF_NRM, GL.DYNAMIC_DRAW);
        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_nrm'), 2);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 2, this.bufferN);

        this.noiseTexture = new NoiseTexture(this.wd, this.ht);
    }

    async init(scene: Scene): Promise<void> {
        this.typedArrayF = new Int32Array(scene.tri.length * SIZEOF_TRI / SIZEOF_I32);
        this.typedArrayP = new Float32Array(scene.pos.length * SIZEOF_POS / SIZEOF_F32);
        this.typedArrayN = new Float32Array(scene.nrm.length * SIZEOF_NRM / SIZEOF_F32);
        this.scene = scene;

        try {
            const responses = await Promise.all([
                this.fetchShader(vertShaderURL),
                this.fetchShader(fragShaderURL),
            ]);

            this.vs = GL.createShader(GL.VERTEX_SHADER);
            this.fs = GL.createShader(GL.FRAGMENT_SHADER);
            GL.shaderSource(this.vs, responses[0]);
            GL.shaderSource(this.fs, responses[1]);
            GL.compileShader(this.vs);
            GL.compileShader(this.fs);

            if (!GL.getShaderParameter(this.vs, GL.COMPILE_STATUS)) {
                throw new Error(`Error compiling ${vertShaderURL} !\n ${GL.getShaderInfoLog(this.vs)}\n`);
            }
            if (!GL.getShaderParameter(this.fs, GL.COMPILE_STATUS)) {
                throw new Error(`Error compiling ${fragShaderURL} !\n ${GL.getShaderInfoLog(this.fs)}\n`);
            }

            this.program = GL.createProgram();
            GL.attachShader(this.program, this.vs);
            GL.attachShader(this.program, this.fs);
            GL.linkProgram(this.program);
            if (!GL.getProgramParameter(this.program, GL.LINK_STATUS)) {
                const log = GL.getProgramInfoLog(this.program);
                throw new Error(`Error linking shader program!\n ${log}\n`);
            } else {
                GL.useProgram(this.program);
            }

            this.initVSData();
            this.initFSData();
            this.updateBufferF();
            this.initialized = true;
        } 
        catch(e) {
            throw e;
        }
    }

    drawScene() {
        const {
            numSamples,
            numBounces,
            cameraFov,
            materials,
            spheres,
        } = reduxStore.getState();

        const viewMatrix: Matrix4x4 = camera.modelMatrix.inverse();

        const sortAscending = (a, b) => {
            if (a.id < b.id) return -1;
            if (a.id > b.id) return +1;
            return 0;
        };

        const sortedMaterials = [...materials].sort(sortAscending);
        sortedMaterials.forEach((m, i) => {
            if (m instanceof MetallicMaterial) {
                GL.uniform1i(GL.getUniformLocation(this.program, `u_materials[${i}].materialClass`), 0);
            } else if (m instanceof LambertianMaterial) {
                GL.uniform1i(GL.getUniformLocation(this.program, `u_materials[${i}].materialClass`), 1);
            } else if (m instanceof DielectricMaterial) {
                GL.uniform1i(GL.getUniformLocation(this.program, `u_materials[${i}].materialClass`), 2);
            }

            if (typeof m.albedo !== 'undefined') {
                GL.uniform3fv(
                    GL.getUniformLocation(this.program, `u_materials[${i}].albedo`),
                    m.albedo.rgb
                );
            }
            if (typeof m.shininess !== 'undefined') {
                GL.uniform1f(
                    GL.getUniformLocation(this.program, `u_materials[${i}].shininess`),
                    m.shininess
                );
            }
            if (typeof m.refractionIndex !== 'undefined') {
                GL.uniform1f(
                    GL.getUniformLocation(this.program, `u_materials[${i}].refractionIndex`),
                    m.refractionIndex
                );
            }
        });

        const sortedSpheres = [...spheres].sort(sortAscending);
        sortedSpheres.forEach((s, i) => {
            GL.uniform3fv(
                GL.getUniformLocation(this.program, `u_spheres[${i}].center`),
                s.center.mul(viewMatrix).xyz,
            );
            GL.uniform1f(
                GL.getUniformLocation(this.program, `u_spheres[${i}].radius`),
                s.radius
            );
            GL.uniform1f(
                GL.getUniformLocation(this.program, `u_spheres[${i}].radiusSquared`),
                s.radiusSquared
            );
            GL.uniform1i(
                GL.getUniformLocation(this.program, `u_spheres[${i}].materialIndex`),
                sortedMaterials.findIndex(m => m.id === s.materialId)
            );
        });

        // ----------------------------------------------------------------
        // fragment shader uniforms
        //
        GL.uniform1i(
            GL.getUniformLocation(this.program, 'u_num_tris'),
            this.scene.tri.length
        );
        GL.uniform1i(
            GL.getUniformLocation(this.program, 'u_num_samples'),
            numSamples
        );
        GL.uniform1i(
            GL.getUniformLocation(this.program, 'u_num_bounces'),
            numBounces
        );
        GL.uniform1i(
            GL.getUniformLocation(this.program, 'u_num_spheres'),
            spheres.length
        );
        GL.uniform1f(
            GL.getUniformLocation(this.program, 'u_eye_to_y'),
            this.ht * 0.5 / (Math.tan(cameraFov * 0.5 * Math.PI / 180))
        );

        this.updateBufferP(viewMatrix);
        this.updateBufferN(viewMatrix);
        this.noiseTexture.activate(this.program);
 
        // ----------------------------------------------------------------
        // draw clip-space rectangle over entire canvas
        //
        GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}
