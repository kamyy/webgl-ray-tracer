// @flow

import {
    SIZEOF_TRI,
    SIZEOF_POS,
    SIZEOF_NRM,
    SIZEOF_MAT,
    SIZEOF_BV,
}   from '../scene/Scene.js';

import {
    reduxStore
}   from '../redux/reducers.js';

import {
    GL
}   from '../component/Canvas.js';

import ColorCache from '../cache/ColorCache.js';
import NoiseCache from '../cache/NoiseCache.js';
import Vector1x4 from '../math/Vector1x4.js'
import Scene from '../scene/Scene.js';

import Shader from './Shader.js';

const MAX_TRI_COUNT = 1024;
const MAX_POS_COUNT = MAX_TRI_COUNT * 3;
const MAX_NRM_COUNT = MAX_TRI_COUNT * 3 + MAX_TRI_COUNT; // 1 normal and 3 vertex normals per face
const MAX_MAT_COUNT = 8;
const MAX_BV_COUNT  = MAX_TRI_COUNT + 1;

export default class SampleShader extends Shader {
    scene: Scene;
    wd: number;
    ht: number;
    colorCache: ColorCache;
    noiseCache: NoiseCache;
    frameBuffer: WebGLFrameBuffer;

    constructor(scene: Scene, wd: number, ht: number) {
        super();
        this.scene = scene;
        this.wd = wd;
        this.ht = ht;

        this.colorCache = new ColorCache(GL, wd, ht);
        this.noiseCache = new NoiseCache(GL, wd, ht);

        this.frameBuffer = GL.createFramebuffer();
        GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
        GL.drawBuffers([ GL.COLOR_ATTACHMENT0 ]);
        GL.bindFramebuffer(GL.FRAMEBUFFER, null);
    }

    initFSData() {
        const triBuf = GL.createBuffer(); // create GPU buffer object for triangular faces
        GL.bindBuffer(GL.UNIFORM_BUFFER, triBuf); // bind GPU buffer object to UNIFORM_BUFFER target in order to manipulate it
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_TRI_COUNT * SIZEOF_TRI, GL.STATIC_DRAW); // allocate memory on GPU for GPU buffer object
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, this.scene.triTypedArray); // upload data to allocated GPU memory belonging to GPU buffer object
        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_tri'), 0); // bind uniform block in shader to a binding point
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 0, triBuf); // bind GPU buffer object (uniform buffer object) to same binding point

        const posBuf = GL.createBuffer(); // vertex positions
        GL.bindBuffer(GL.UNIFORM_BUFFER, posBuf);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_POS_COUNT * SIZEOF_POS, GL.STATIC_DRAW);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, this.scene.posTypedArray);
        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_pos'), 1);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 1, posBuf);

        const nrmBuf = GL.createBuffer(); // vertex normals
        GL.bindBuffer(GL.UNIFORM_BUFFER, nrmBuf);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_NRM_COUNT * SIZEOF_NRM, GL.STATIC_DRAW);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, this.scene.nrmTypedArray);
        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_nrm'), 2);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 2, nrmBuf);

        const matBuf = GL.createBuffer(); // materials
        GL.bindBuffer(GL.UNIFORM_BUFFER, matBuf);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_MAT_COUNT * SIZEOF_MAT, GL.STATIC_DRAW);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, this.scene.matArrayBuffer);
        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_mat'), 3);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 3, matBuf);

        const bvhBuf = GL.createBuffer(); // bounding volume hierarchy
        GL.bindBuffer(GL.UNIFORM_BUFFER, bvhBuf);
        GL.bufferData(GL.UNIFORM_BUFFER, MAX_BV_COUNT * SIZEOF_BV, GL.STATIC_DRAW);
        GL.bufferSubData(GL.UNIFORM_BUFFER, 0, this.scene.bvhArrayBuffer);
        GL.uniformBlockBinding(this.program, GL.getUniformBlockIndex(this.program, 'uniform_block_bvh'), 4);
        GL.bindBufferBase(GL.UNIFORM_BUFFER, 4, bvhBuf);
    }

    draw(renderPass: number, invViewMatrix: Matrix4x4) {
        const {
            numSamples,
            numBounces,
            cameraFov,
        } = reduxStore.getState();

        const origin = new Vector1x4(0.0, 0.0, 0.0); // in view space
        const eyePos = origin.mul(invViewMatrix); // in world space

        GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
        GL.useProgram(this.program);
        GL.bindVertexArray(this.va);

        GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_wd'), this.wd * 0.5);
        GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_ht'), this.ht * 0.5);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_render_pass'), renderPass);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_num_samples'), numSamples);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_num_bounces'), numBounces);
        GL.uniform1f(GL.getUniformLocation(this.program, 'u_eye_to_image'), (this.ht * 0.5) / (Math.tan(cameraFov * 0.5 * (Math.PI / 180.0))));
        GL.uniform3f(GL.getUniformLocation(this.program, 'u_eye_position'), eyePos.x, eyePos.y, eyePos.z);
        GL.uniformMatrix4fv(GL.getUniformLocation(this.program, 'u_eye_to_world'), false, invViewMatrix.toFloat32Array());

        this.colorCache.bindToSampleShader(GL, this.program);
        this.noiseCache.bindToSampleShader(GL, this.program);
        GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}
