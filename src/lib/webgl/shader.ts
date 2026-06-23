export default class Shader {
  vs: WebGLShader | null = null
  fs: WebGLShader | null = null
  vao: WebGLVertexArrayObject | null = null
  pgm: WebGLProgram | null = null

  async fetchShader(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Unable to GET ${url} status=${response.status}`)
    }
    return response.text()
  }

  async init(gl: WebGL2RenderingContext, vsURL: string, fsURL: string): Promise<void> {
    const responses = await Promise.all([this.fetchShader(vsURL), this.fetchShader(fsURL)])

    this.vs = gl.createShader(gl.VERTEX_SHADER)
    if (this.vs) {
      gl.shaderSource(this.vs, responses[0])
      gl.compileShader(this.vs)
      if (!gl.getShaderParameter(this.vs, gl.COMPILE_STATUS)) {
        throw new Error(`Error compiling ${vsURL} !\n ${gl.getShaderInfoLog(this.vs)}\n`)
      }
    }

    this.fs = gl.createShader(gl.FRAGMENT_SHADER)
    if (this.fs) {
      gl.shaderSource(this.fs, responses[1])
      gl.compileShader(this.fs)
      if (!gl.getShaderParameter(this.fs, gl.COMPILE_STATUS)) {
        throw new Error(`Error compiling ${fsURL} !\n ${gl.getShaderInfoLog(this.fs)}\n`)
      }
    }

    this.pgm = gl.createProgram()
    if (this.pgm && this.vs && this.fs) {
      gl.attachShader(this.pgm, this.vs)
      gl.attachShader(this.pgm, this.fs)
      gl.linkProgram(this.pgm)
      if (!gl.getProgramParameter(this.pgm, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(this.pgm)
        throw new Error(`Error linking shader program!\n ${log}\n`)
      }

      // vertices for clip space rectangle covering entire canvas
      this.vao = gl.createVertexArray() // begin vertex array object
      if (this.vao) {
        gl.bindVertexArray(this.vao)
        const f32 = new Float32Array([-1, -1, +1, -1, +1, +1, -1, +1])
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, f32, gl.STATIC_DRAW)
        const desc = {
          length: 2,
          stride: 8,
          offset: 0,
        }
        const loc = gl.getAttribLocation(this.pgm, 'a_vert_data')
        gl.vertexAttribPointer(loc, desc.length, gl.FLOAT, false, desc.stride, desc.offset)
        gl.enableVertexAttribArray(loc)
        gl.bindVertexArray(null) // end vertex array object
      }
    }
  }
}
