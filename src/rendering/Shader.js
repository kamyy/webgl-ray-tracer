// @flow

import {
    reduxStore
}   from '../redux/reducers.js';

import {
    GL
}   from '../components/Canvas.js';

import Vector1x4 from '../math/Vector1x4.js'

import {
    SIZEOF_TRI,
    SIZEOF_POS,
    SIZEOF_NRM,
    SIZEOF_MAT,
    SIZEOF_BV,
}   from './Scene.js';

import Scene from './Scene.js';
import NoiseTexture from './NoiseTexture.js';

const vertShaderURL = '/vert.glsl';
const fragShaderURL = '/frag.glsl';

const MAX_TRI_COUNT = 1024;
const MAX_POS_COUNT = MAX_TRI_COUNT * 3;
const MAX_NRM_COUNT = MAX_TRI_COUNT * 3 + MAX_TRI_COUNT; // 1 normal and 3 vertex normals per face
const MAX_MAT_COUNT = 8;
const MAX_BV_COUNT  = MAX_TRI_COUNT + 1;

export default class Shader {
    initialized: boolean;
    wd: number;
    ht: number;

    vs: WebGLShader;
    fs: WebGLShader;
    program: WebGLProgram;

    vtxBuf: WebGLBuffer;
    triBuf: WebGLBuffer;
    posBuf: WebGLBuffer;
    nrmBuf: WebGLBuffer;

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

    initVSData() {
        this.vtxBuf = GL.createBuffer();
        GL.bindBuffer(GL.ARRAY_BUFFER, this.vtxBuf);
        GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([
            // vertices for for clip space rectangle covering entire canvas
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

    initFSData(scene: Scene) {
        this.triBuf = GL.createBuffer();
        GL.bindBuffer(GL.UNIFORM_BUFFER, this.triBuf);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_TRI_COUNT * SIZEOF_TRI, GL.STATIC_DRAW);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, scene.triTypedArray); // upload to GPU once only, the data doesn't change

        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_tri'), 0);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 0, this.triBuf);

        this.posBuf = GL.createBuffer();
        GL.bindBuffer(GL.UNIFORM_BUFFER, this.posBuf);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_POS_COUNT * SIZEOF_POS, GL.STATIC_DRAW);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, scene.posTypedArray); // upload to GPU

        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_pos'), 1);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 1, this.posBuf);

        this.nrmBuf = GL.createBuffer();
        GL.bindBuffer(GL.UNIFORM_BUFFER, this.nrmBuf);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_NRM_COUNT * SIZEOF_NRM, GL.STATIC_DRAW);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, scene.nrmTypedArray); // upload to GPU

        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_nrm'), 2);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 2, this.nrmBuf);

        this.matBuf = GL.createBuffer();
        GL.bindBuffer(GL.UNIFORM_BUFFER, this.matBuf);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_MAT_COUNT * SIZEOF_MAT, GL.STATIC_DRAW);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, scene.matArrayBuffer); // upload to GPU

        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_mat'), 3);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 3, this.matBuf);

        this.bvhBuf = GL.createBuffer();
        GL.bindBuffer(GL.UNIFORM_BUFFER, this.bvhBuf);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_BV_COUNT * SIZEOF_BV, GL.STATIC_DRAW);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, scene.bvhArrayBuffer); // upload to GPU

        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_bvh'), 4);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 4, this.bvhBuf);

        this.noiseTexture = new NoiseTexture(GL, this.program, this.wd, this.ht);
    }

    async init(scene: Scene): Promise<void> {
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
            this.initFSData(scene);
            this.initialized = true;
        } 
        catch(e) {
            throw e;
        }
    }

    draw(scene: Scene, invViewMatrix: Matrix4x4) {
        const {
            numSamples,
            numBounces,
            cameraFov,
        } = reduxStore.getState();

        const origin = new Vector1x4(0.0, 0.0, 0.0);
        const eyePos = origin.mul(invViewMatrix);

        GL.uniform1i(
            GL.getUniformLocation(this.program, 'u_num_samples'),
            numSamples
        );
        GL.uniform1i(
            GL.getUniformLocation(this.program, 'u_num_bounces'),
            numBounces
        );
        GL.uniformMatrix4fv(
            GL.getUniformLocation(this.program, 'u_eye_to_world'), false,
            invViewMatrix.toFloat32Array()
        );
        GL.uniform1f(
            GL.getUniformLocation(this.program, 'u_eye_to_image'),
            (this.ht * 0.5) / (Math.tan(cameraFov * 0.5 * (Math.PI / 180.0)))
        );
        GL.uniform3f(
            GL.getUniformLocation(this.program, 'u_eye_position'),
            eyePos.x,
            eyePos.y,
            eyePos.z
        );

        GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}
