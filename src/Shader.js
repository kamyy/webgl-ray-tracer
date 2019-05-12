// @flow
import { GL } from './App';
import Sphere from './Sphere';
import Vector1x4 from './Vector1x4';

//const g_up     = new Vector1x4(0.0, 0.0, 1.0, 0.0);
//const g_origin = new Vector1x4(0.0, 0.0, 0.0, 1.0);

const vertShaderURL = '/vert.glsl';
const fragShaderURL = '/frag.glsl';

async function fetchShader(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Cannot GET ${url} status=${response.status}`);
    }
    return response.text();
}

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

    init(): Promise<boolean> {
        return Promise.all([
            fetchShader(vertShaderURL),
            fetchShader(fragShaderURL),
        ])
        .then(responseTexts => {
            this.vs = GL.createShader(GL.VERTEX_SHADER);
            this.fs = GL.createShader(GL.FRAGMENT_SHADER);
            GL.shaderSource(this.vs, responseTexts[0]);
            GL.shaderSource(this.fs, responseTexts[1]);
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
            GL.bindBuffer(GL.ARRAY_BUFFER, null);
            throw e;
        });
    }

    drawScene() {
        const spheres = [
            new Sphere(
                new Vector1x4(0.0, 1200.0, 0.0), 200.0
            ),
            new Sphere(
                new Vector1x4(0.0, 1300.0, -700.0), 400.0
            ),
        ];

        if (this.program && this.vtxBuff) {
            GL.useProgram(this.program);
            
            // vertex shader attributes
            const desc = {
                attrib: 'att_vert_data',
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
                desc.offset
            );
            GL.enableVertexAttribArray(loc);

            // vertex shader uniforms
            GL.uniform1f(GL.getUniformLocation(this.program, 'uni_half_wd'), this.halfWd);
            GL.uniform1f(GL.getUniformLocation(this.program, 'uni_half_ht'), this.halfHt);

            // fragment shader uniforms
            spheres.forEach((sphere, i) => {
                GL.uniform3f(
                    GL.getUniformLocation(this.program, `uni_spheres[${i}].center`), 
                    sphere.center.x, 
                    sphere.center.y, 
                    sphere.center.z 
                );
                GL.uniform1f(
                    GL.getUniformLocation(this.program, `uni_spheres[${i}].radius`), 
                    sphere.radius
                );
                GL.uniform1f(
                    GL.getUniformLocation(this.program, `uni_spheres[${i}].radiusSquared`), 
                    sphere.radiusSquared
                );
            });
            GL.uniform1f(
                GL.getUniformLocation(this.program, 'uni_eye_to_y'), 
                this.halfHt / (Math.tan(30 * Math.PI / 180))
            );

            // cover entire canvas in rectangle
            GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
        }
    }
}

