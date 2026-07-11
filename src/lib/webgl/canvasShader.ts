import { CanvasVars } from '../../types/canvasVars'
import Shader from './shader'

export default class CanvasShader extends Shader {
  constructor() {
    super()
  }

  draw({ gl, renderingPass, colorTextures }: CanvasVars) {
    if (this.pgm && gl && colorTextures) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.useProgram(this.pgm)
      gl.bindVertexArray(this.vao)
      colorTextures.bindToCanvasShader(gl, this.pgm)

      gl.uniform1f(gl.getUniformLocation(this.pgm, 'u_inv_render_pass'), 1.0 / renderingPass)
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    }
  }
}
