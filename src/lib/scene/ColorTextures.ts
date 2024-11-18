export default class ColorTextures {
  private source: WebGLTexture | null = null;
  private target: WebGLTexture | null = null;

  constructor(GL: WebGL2RenderingContext, wd: number, ht: number) {
    GL.activeTexture(GL.TEXTURE0);
    this.source = GL.createTexture();
    this.target = GL.createTexture();

    if (this.source && this.target) {
      GL.bindTexture(GL.TEXTURE_2D, this.source);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
      GL.texStorage2D(GL.TEXTURE_2D, 1, GL.RGBA32F, wd, ht);

      GL.bindTexture(GL.TEXTURE_2D, this.target);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
      GL.texStorage2D(GL.TEXTURE_2D, 1, GL.RGBA32F, wd, ht);
    }
  }

  bindToSampleShader(GL: WebGL2RenderingContext, program: WebGLProgram): void {
    const textureSwap = this.source;
    this.source = this.target;
    this.target = textureSwap;

    // using texture unit 0
    GL.activeTexture(GL.TEXTURE0);
    GL.bindTexture(GL.TEXTURE_2D, this.target);
    GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, this.target, 0);

    // using texture unit 1
    GL.activeTexture(GL.TEXTURE1);
    GL.bindTexture(GL.TEXTURE_2D, this.source);
    GL.uniform1i(GL.getUniformLocation(program, 'u_color_sampler'), 1);
  }

  bindToCanvasShader(GL: WebGL2RenderingContext, program: WebGLProgram): void {
    // using texture unit 0
    GL.activeTexture(GL.TEXTURE0);
    GL.bindTexture(GL.TEXTURE_2D, this.target);
    GL.uniform1i(GL.getUniformLocation(program, 'u_color_sampler'), 0);
  }
}
