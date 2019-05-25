// @flow
import {
    store
}   from './redux/reducers.js';

import { 
    GL 
}   from './components/Canvas.js';

import MetallicMaterial from './materials/MetallicMaterial.js';
import LambertianMaterial from './materials/LambertianMaterial.js';
import DielectricMaterial from './materials/DielectricMaterial.js';

//const g_up     = new Vector1x4(0.0, 0.0, 1.0, 0.0);
//const g_origin = new Vector1x4(0.0, 0.0, 0.0, 1.0);

const vertShaderURL = '/vert.glsl';
const fragShaderURL = '/frag.glsl';

export default class Shader {
    initialized: boolean;
    halfWd: number;
    halfHt: number;
    vs: WebGLShader | null;
    fs: WebGLShader | null;
    program: WebGLProgram | null;
    vtxBuff: WebGLBuffer  | null;

    constructor(halfWd: number, halfHt: number) {
        this.initialized = false;
        this.halfWd = halfWd;
        this.halfHt = halfHt;
        this.vs = null;
        this.fs = null;
        this.program = null;
        this.vtxBuff = null;
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
            this.vtxBuff = GL.createBuffer();
            GL.bindBuffer(GL.ARRAY_BUFFER, this.vtxBuff);
            GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([ -1, -1, +1, -1, +1, +1, -1, +1, ]), 
                GL.STATIC_DRAW
            );

            // ----------------------------------------------------------------
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

            // ----------------------------------------------------------------
            // vertex shader uniforms
            GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_wd'), this.halfWd);
            GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_ht'), this.halfHt);

            // ----------------------------------------------------------------
            // promise resolved
            this.initialized = true;
        } 
        catch(e) {
            GL.bindBuffer(GL.ARRAY_BUFFER, null);

            if (this.vtxBuff) {
                GL.deleteBuffer(this.vtxBuff);
                this.vtxBuff = null;
            }
            if (this.program) {
                GL.deleteProgram(this.program);
                this.program = null;
            }
            if (this.fs) {
                GL.deleteShader(this.fs);
                this.fs = null;
            }
            if (this.vs) {
                GL.deleteShader(this.vs);
                this.vs = null;
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
        } = store.getState();

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
                s.center.xyz,
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
            this.halfHt / (Math.tan(cameraFov * Math.PI / 180))
        );

        /*
        metallicMaterials.forEach((m, i) => {
            GL.uniform3fv(
                GL.getUniformLocation(this.program, `u_metallic_materials[${i}].attenuation`),
                m.attenuation.rgb
            );
            GL.uniform1f(
                GL.getUniformLocation(this.program, `u_metallic_materials[${i}].shininess`),
                m.shininess
            );
        });

        lambertianMaterials.forEach((m, i) => {
            GL.uniform3fv(
                GL.getUniformLocation(this.program, `u_lambertian_materials[${i}].attenuation`),
                m.attenuation.rgb
            );
        });

        dielectricMaterials.forEach((m, i) => {
            GL.uniform3fv(
                GL.getUniformLocation(this.program, `u_dielectric_materials[${i}].attenuation`),
                m.attenuation.rgb
            );
            GL.uniform1f(
                GL.getUniformLocation(this.program, `u_dielectric_materials[${i}].refractionIndex`),
                m.refractionIndex
            );
        });
        */

        // ----------------------------------------------------------------
        // cover entire canvas in a clip-space rectangle
        GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}

