export default class Shader {
    program?: WebGLProgram;
    va?: WebGLVertexArrayObject;

    private async fetchShader(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Cannot GET ${url} status=${response.status}`);
        }
        return response.text();
    }

    private initVSData(GL: WebGL2RenderingContext): void {
        this.va = <WebGLVertexArrayObject>GL.createVertexArray(); // begin vertex array object
        GL.bindVertexArray(this.va);

        const vtxBuf = <WebGLBuffer>GL.createBuffer();
        GL.bindBuffer(GL.ARRAY_BUFFER, vtxBuf);
        GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([ // vertices for clip space rectangle covering entire canvas
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

        const loc = GL.getAttribLocation(<WebGLProgram>this.program, 'a_vert_data');
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

    async init(
        GL: WebGL2RenderingContext,
        vsURL: string,
        fsURL: string
    ): Promise<void> {
        try {
            const responses = await Promise.all([
                this.fetchShader(vsURL),
                this.fetchShader(fsURL),
            ]);

            this.program = <WebGLProgram>GL.createProgram();
            const vs = <WebGLShader>GL.createShader(GL.VERTEX_SHADER);
            const fs = <WebGLShader>GL.createShader(GL.FRAGMENT_SHADER);

            GL.shaderSource(vs, responses[0]);
            GL.shaderSource(fs, responses[1]);
            GL.compileShader(vs);
            GL.compileShader(fs);

            if (!GL.getShaderParameter(vs, GL.COMPILE_STATUS)) {
                throw new Error(`Error compiling ${vsURL} !\n ${GL.getShaderInfoLog(vs)}\n`);
            }
            if (!GL.getShaderParameter(fs, GL.COMPILE_STATUS)) {
                throw new Error(`Error compiling ${fsURL} !\n ${GL.getShaderInfoLog(fs)}\n`);
            }

            GL.attachShader(this.program, vs);
            GL.attachShader(this.program, fs);
            GL.linkProgram(this.program);
            if (!GL.getProgramParameter(this.program, GL.LINK_STATUS)) {
                const log = GL.getProgramInfoLog(this.program);
                throw new Error(`Error linking shader program!\n ${log}\n`);
            }

            this.initVSData(GL);
        }
        catch(e) {
            throw e;
        }
    }

}