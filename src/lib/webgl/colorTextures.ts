export default class ColorTextures {
  private source: WebGLTexture | null = null
  private target: WebGLTexture | null = null

  constructor(gl: WebGL2RenderingContext, wd: number, ht: number) {
    gl.activeTexture(gl.TEXTURE0)
    this.source = gl.createTexture()
    this.target = gl.createTexture()

    if (this.source && this.target) {
      gl.bindTexture(gl.TEXTURE_2D, this.source)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, wd, ht)

      gl.bindTexture(gl.TEXTURE_2D, this.target)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, wd, ht)
    }
  }

  bindToSampleShader(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    const textureSwap = this.source
    this.source = this.target
    this.target = textureSwap

    // using texture unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.target)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.target, 0)

    // using texture unit 1
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.source)
    gl.uniform1i(gl.getUniformLocation(program, 'u_color_sampler'), 1)
  }

  bindToCanvasShader(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    // using texture unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.target)
    gl.uniform1i(gl.getUniformLocation(program, 'u_color_sampler'), 0)
  }
}
