// @flow
import { GL } from './App';

//const g_up     = new Vector1x4(0.0, 0.0, 1.0, 0.0);
//const g_origin = new Vector1x4(0.0, 0.0, 0.0, 1.0);

const vertShaderURL = '/vert.glsl';
const fragShaderURL = '/frag.glsl';

async function fetchShader(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Cannot GET ${url} status=${response.status}`);
    }
    return response.text();
}

export default class Shader {
    vs: WebGLShader | null;
    fs: WebGLShader | null;
    program: WebGLProgram | null;
    vtxBuff: WebGLBuffer  | null;

    constructor() {
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
            GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([ -1, -1, +1, -1, +1, +1, -1, +1 ]), GL.STATIC_DRAW);

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

            console.log(`${e}`);
            return false;
        });
    }

    drawScene(): boolean {
        if (this.program && this.vtxBuff) {
            console.log('drawing scene');
            GL.useProgram(this.program);

            const vertexAttributeDescs = Object.freeze([ 
                {   attrib: 'a_clip_space_pos',
                    length: 2,
                    stride: 8,
                    offset: 0
                },
            ]);

            for (let desc of vertexAttributeDescs) {
                const loc = GL.getAttribLocation(this.program, desc.attrib);
                if (loc !== -1) {
                    GL.vertexAttribPointer(loc, desc.length, GL.FLOAT, false, desc.stride, desc.offset);
                    GL.enableVertexAttribArray(loc);
                }
            }

            GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
            return true;
        }
        return false;
    }
}

