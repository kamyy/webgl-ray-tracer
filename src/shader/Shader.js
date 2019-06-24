
// @flow

import {
    GL
}   from '../component/Canvas.js';

export default class Shader {
    vs: WebGLShader;
    fs: WebGLShader;
    va: WebGLVertexArrayObject;
    program: WebGLProgram;

    async fetchShader(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Cannot GET ${url} status=${response.status}`);
        }
        return response.text();
    }

    initVSData() {
        this.va = GL.createVertexArray(); // begin vertex array object
        GL.bindVertexArray(this.va);

        const vtxBuf = GL.createBuffer();
        GL.bindBuffer(GL.ARRAY_BUFFER, vtxBuf);
        GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([ // vertices for for clip space rectangle covering entire canvas
            -1, -1, 
            +1, -1,
            +1, +1, 
            -1, +1,
            ]), 
            GL.STATIC_DRAW
        );

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
        GL.bindVertexArray(null); // end vertex array object
    }

    initFSData() {
    }

    async init(vsURL:string, fsURL: string): Promise<void> {
        try {
            const responses = await Promise.all([
                this.fetchShader(vsURL),
                this.fetchShader(fsURL),
            ]);

            this.vs = GL.createShader(GL.VERTEX_SHADER);
            this.fs = GL.createShader(GL.FRAGMENT_SHADER);
            GL.shaderSource(this.vs, responses[0]);
            GL.shaderSource(this.fs, responses[1]);
            GL.compileShader(this.vs);
            GL.compileShader(this.fs);

            if (!GL.getShaderParameter(this.vs, GL.COMPILE_STATUS)) {
                throw new Error(`Error compiling ${vsURL} !\n ${GL.getShaderInfoLog(this.vs)}\n`);
            }
            if (!GL.getShaderParameter(this.fs, GL.COMPILE_STATUS)) {
                throw new Error(`Error compiling ${fsURL} !\n ${GL.getShaderInfoLog(this.fs)}\n`);
            }

            this.program = GL.createProgram();
            GL.attachShader(this.program, this.vs);
            GL.attachShader(this.program, this.fs);
            GL.linkProgram(this.program);
            if (!GL.getProgramParameter(this.program, GL.LINK_STATUS)) {
                const log = GL.getProgramInfoLog(this.program);
                throw new Error(`Error linking shader program!\n ${log}\n`);
            }

            this.initVSData();
            this.initFSData();
        } 
        catch(e) {
            throw e;
        }
    }

}