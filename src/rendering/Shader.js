// @flow
import {
    reduxStore
}   from '../redux/reducers.js';

import { 
    GL, camera
}   from '../components/Canvas.js';

import Matrix4x4 from '../math/Matrix4x4.js';

import NoiseTexture from './NoiseTexture.js';
import MetallicMaterial from './MetallicMaterial.js';
import LambertianMaterial from './LambertianMaterial.js';
import DielectricMaterial from './DielectricMaterial.js';

const vertShaderURL = '/vert.glsl';
const fragShaderURL = '/frag.glsl';

export default class Shader {
    initialized: boolean;
    wd: number;
    ht: number;
    vs: WebGLShader;
    fs: WebGLShader;
    program: WebGLProgram;
    vtxBuff: WebGLBuffer;
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

    async init(): Promise<void> {
        try {
            // ----------------------------------------------------------------
            // shader program compile/link
            //
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
                throw new Error(`Error compiling ${vertShaderURL} !\n ${GL.getShaderInfoLog(this.vs)}`);
            }
            if (!GL.getShaderParameter(this.fs, GL.COMPILE_STATUS)) {
                throw new Error(`Error compiling ${fragShaderURL} !\n ${GL.getShaderInfoLog(this.fs)}`);
            }

            this.program = GL.createProgram();
            GL.attachShader(this.program, this.vs);
            GL.attachShader(this.program, this.fs);
            GL.linkProgram(this.program);
            if (!GL.getProgramParameter(this.program, GL.LINK_STATUS)) {
                throw new Error('Error linking shader program!\n');
            } else {
                GL.useProgram(this.program);
            }

            // ----------------------------------------------------------------
            // vertex buffer for clip space rectangle
            //
            this.vtxBuff = GL.createBuffer();
            GL.bindBuffer(GL.ARRAY_BUFFER, this.vtxBuff);
            GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([
                -1, -1, 0, 0, 
                +1, -1, 1, 0,
                +1, +1, 1, 1, 
                -1, +1, 0, 1
                ]), 
                GL.STATIC_DRAW
            );

            // ----------------------------------------------------------------
            // vertex shader attributes
            //
            const desc = {
                length: 4,
                stride: 16,
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

            // ----------------------------------------------------------------
            // vertex shader uniforms
            //
            GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_wd'), this.wd * 0.5);
            GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_ht'), this.ht * 0.5);

            // ----------------------------------------------------------------
            // noise texture for seeding PRNG in fragment shader
            //
            this.noiseTexture = new NoiseTexture(this.wd, this.ht);

            // ----------------------------------------------------------------
            // promise resolved
            //
            this.initialized = true;
        } 
        catch(e) {
            GL.bindBuffer(GL.ARRAY_BUFFER, null);

            if (this.vtxBuff) {
                GL.deleteBuffer(this.vtxBuff);
                delete this.vtxBuff;
            }
            if (this.program) {
                GL.deleteProgram(this.program);
                delete this.program;
            }
            if (this.fs) {
                GL.deleteShader(this.fs);
                delete this.fs;
            }
            if (this.vs) {
                GL.deleteShader(this.vs);
                delete this.vs;
            }

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

        this.noiseTexture.activate(this.program);
 
        // ----------------------------------------------------------------
        // draw clip-space rectangle over entire canvas
        //
        GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}
