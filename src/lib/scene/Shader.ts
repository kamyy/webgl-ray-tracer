export default class Shader {
  vs: WebGLShader | null;
  fs: WebGLShader | null;
  va: WebGLVertexArrayObject | null;
  program: WebGLProgram | null;

  constructor() {
    this.vs = null;
    this.fs = null;
    this.va = null;
    this.program = null;
  }

  async fetchShader(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to GET ${url} status=${response.status}`);
    }
    return response.text();
  }

  async init(GL: WebGL2RenderingContext, vsURL: string, fsURL: string): Promise<void> {
    const responses = await Promise.all([this.fetchShader(vsURL), this.fetchShader(fsURL)]);

    this.vs = GL.createShader(GL.VERTEX_SHADER);
    if (this.vs) {
      GL.shaderSource(this.vs, responses[0]);
      GL.compileShader(this.vs);
      if (!GL.getShaderParameter(this.vs, GL.COMPILE_STATUS)) {
        throw new Error(`Error compiling ${vsURL} !\n ${GL.getShaderInfoLog(this.vs)}\n`);
      }

      this.fs = GL.createShader(GL.FRAGMENT_SHADER);
      if (this.fs) {
        GL.shaderSource(this.fs, responses[1]);
        GL.compileShader(this.fs);
        if (!GL.getShaderParameter(this.fs, GL.COMPILE_STATUS)) {
          throw new Error(`Error compiling ${fsURL} !\n ${GL.getShaderInfoLog(this.fs)}\n`);
        }

        this.program = GL.createProgram();
        if (this.program) {
          GL.attachShader(this.program, this.vs);
          GL.attachShader(this.program, this.fs);
          GL.linkProgram(this.program);
          if (!GL.getProgramParameter(this.program, GL.LINK_STATUS)) {
            const log = GL.getProgramInfoLog(this.program);
            throw new Error(`Error linking shader program!\n ${log}\n`);
          }

          // vertices for clip space rectangle covering entire canvas
          this.va = GL.createVertexArray(); // begin vertex array object
          if (this.va) {
            GL.bindVertexArray(this.va);
            const vtxBuf = GL.createBuffer();
            GL.bindBuffer(GL.ARRAY_BUFFER, vtxBuf);
            GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([-1, -1, +1, -1, +1, +1, -1, +1]), GL.STATIC_DRAW);
            const desc = {
              length: 2,
              stride: 8,
              offset: 0,
            };
            const loc = GL.getAttribLocation(this.program, "a_vert_data");
            GL.vertexAttribPointer(loc, desc.length, GL.FLOAT, false, desc.stride, desc.offset);

            GL.enableVertexAttribArray(loc);
            GL.bindVertexArray(null); // end vertex array object
          }
        }
      }
    }
  }
}
