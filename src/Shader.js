// @flow
import { GL } from './App';
import Sphere from './Sphere';
import Vector1x4 from './Vector1x4';
import MetallicMaterial from './materials/MetallicMaterial.js';
import LambertianMaterial from './materials/LambertianMaterial.js';
import DielectricMaterial from './materials/DielectricMaterial.js';

//const g_up     = new Vector1x4(0.0, 0.0, 1.0, 0.0);
//const g_origin = new Vector1x4(0.0, 0.0, 0.0, 1.0);

const vertShaderURL = '/vert.glsl';
const fragShaderURL = '/frag.glsl';

export default class Shader {
    halfWd: number;
    halfHt: number;
    vs: WebGLShader | null;
    fs: WebGLShader | null;
    program: WebGLProgram | null;
    vtxBuff: WebGLBuffer  | null;

    constructor(halfWd: number, halfHt: number) {
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

    init(): Promise<boolean> {
        return Promise.all([
            this.fetchShader(vertShaderURL),
            this.fetchShader(fragShaderURL),
        ])
        .then(responses => {
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
            }

            this.vtxBuff = GL.createBuffer();
            GL.bindBuffer(GL.ARRAY_BUFFER, this.vtxBuff);
            GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([
                    -1, -1, Math.random(),
                    +1, -1, Math.random(),
                    +1, +1, Math.random(),
                    -1, +1, Math.random()
                ]), GL.STATIC_DRAW
            );

            return true;
        })
        .catch(e => {
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
        });
    }

    drawScene() {
        const materialClass = {
            METALLIC_MATERIAL:   0,
            LAMBERTIAN_MATERIAL: 1,
            DIELECTRIC_MATERIAL: 2,
        };

        const metallicMaterials = [
            new MetallicMaterial(
                new Vector1x4(0.9, 0.9, 0.9), 
                0.15,
            ),
        ];

        const lambertianMaterials = [
            new LambertianMaterial(
                new Vector1x4(0.4, 0.4, 0.8)
            ),
            new LambertianMaterial(
                new Vector1x4(0.5, 0.1, 0.1)
            ),
        ];

        const dielectricMaterials = [
        ];

        const spheres = [
            {
                sphere: new Sphere(
                    new Vector1x4(-200.0, 1200.0, 300.0), 200.0
                ),
                materialClass: materialClass.METALLIC_MATERIAL,
                materialIndex: 0
            },
            {
                sphere: new Sphere(
                    new Vector1x4(400.0, 1200.0, 100.0), 260.0
                ),
                materialClass: materialClass.LAMBERTIAN_MATERIAL,
                materialIndex: 0
            },
            {
                sphere: new Sphere(
                    new Vector1x4(0.0, 1300.0, -1000.0), 900.0
                ),
                materialClass: materialClass.LAMBERTIAN_MATERIAL,
                materialIndex: 1
            },
        ];

        if (this.program && this.vtxBuff) {
            GL.useProgram(this.program);

            // ----------------------------------------------------------------
            // vertex shader attributes
            const desc = {
                attrib: 'a_vert_data',
                length: 3,
                stride: 12,
                offset: 0
            };
            const loc = GL.getAttribLocation(this.program, desc.attrib);
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
            // fragment shader uniforms
            spheres.forEach((s, i) => {
                GL.uniform3fv(
                    GL.getUniformLocation(this.program, `u_spheres[${i}].center`),
                    s.sphere.center.xyz,
                );
                GL.uniform1f(
                    GL.getUniformLocation(this.program, `u_spheres[${i}].radius`),
                    s.sphere.radius
                );
                GL.uniform1f(
                    GL.getUniformLocation(this.program, `u_spheres[${i}].radiusSquared`),
                    s.sphere.radiusSquared
                );
                GL.uniform1i(
                    GL.getUniformLocation(this.program, `u_spheres[${i}].materialClass`),
                    s.materialClass
                );
                GL.uniform1i(
                    GL.getUniformLocation(this.program, `u_spheres[${i}].materialIndex`),
                    s.materialIndex
                );
            });

            GL.uniform1i(
                GL.getUniformLocation(this.program, 'u_num_samples'),
                256
            );
            GL.uniform1i(
                GL.getUniformLocation(this.program, 'u_num_bounces'),
                32
            );
            GL.uniform1i(
                GL.getUniformLocation(this.program, 'u_num_spheres'),
                3
            );
            GL.uniform1f(
                GL.getUniformLocation(this.program, 'u_eye_to_y'),
                this.halfHt / (Math.tan(30 * Math.PI / 180))
            );

            metallicMaterials.forEach((m, i) => {
                GL.uniform3fv(
                    GL.getUniformLocation(this.program, `u_metallic_materials[${i}].albedo`),
                    m.albedo.rgb
                );
                GL.uniform1f(
                    GL.getUniformLocation(this.program, `u_metallic_materials[${i}].fuzziness`),
                    m.fuzziness
                );
            });

            lambertianMaterials.forEach((m, i) => {
                GL.uniform3fv(
                    GL.getUniformLocation(this.program, `u_lambertian_materials[${i}].albedo`),
                    m.albedo.rgb
                );
            });

            dielectricMaterials.forEach((m, i) => {
            });

            // ----------------------------------------------------------------
            // cover entire canvas in a clip-space rectangle
            GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
        }
    }
}

