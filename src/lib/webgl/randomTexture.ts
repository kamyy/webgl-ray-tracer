export default class RandomTexture {
  private source: WebGLTexture | null = null

  constructor(gl: WebGL2RenderingContext, wd: number, ht: number) {
    const data = new Uint32Array(wd * ht * 4) // require 4 random values for each fragment to seed
    for (let i = 0; i < data.length; ++i) {
      // tausworthe/LCG random number generator
      let n = Math.random() * 4294967295
      while (n < 129) {
        // tausworthe/LCG random number generator seed must be 129 or larger
        n = Math.random() * 4294967295
      }
      data[i] = n
    }

    gl.activeTexture(gl.TEXTURE2)
    this.source = gl.createTexture()
    if (this.source) {
      gl.bindTexture(gl.TEXTURE_2D, this.source)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, wd, ht, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, data)
    }
  }

  bindToSampleShader(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    // using texture unit 2
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.source)
    gl.uniform1i(gl.getUniformLocation(program, 'u_random_sampler'), 2)
  }
}
