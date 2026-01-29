export default class RandomTexture {
  private source: WebGLTexture | null = null;

  constructor(GL: WebGL2RenderingContext, wd: number, ht: number) {
    const data = new Uint32Array(wd * ht * 4); // require 4 random values for each fragment to seed
    for (let i = 0; i < data.length; ++i) {
      // tausworthe/LCG random number generator
      let n = Math.random() * 4294967295;
      while (n < 129) {
        // tausworthe/LCG random number generator seed must be 129 or larger
        n = Math.random() * 4294967295;
      }
      data[i] = n;
    }

    GL.activeTexture(GL.TEXTURE2);
    this.source = GL.createTexture();
    if (this.source) {
      GL.bindTexture(GL.TEXTURE_2D, this.source);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
      GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32UI, wd, ht, 0, GL.RGBA_INTEGER, GL.UNSIGNED_INT, data);
    }
  }

  bindToSampleShader(GL: WebGL2RenderingContext, program: WebGLProgram): void {
    // using texture unit 2
    GL.activeTexture(GL.TEXTURE2);
    GL.bindTexture(GL.TEXTURE_2D, this.source);
    GL.uniform1i(GL.getUniformLocation(program, 'u_random_sampler'), 2);
  }
}
