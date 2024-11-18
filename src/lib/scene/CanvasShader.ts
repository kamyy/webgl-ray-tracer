import { CanvasVars } from '../types/CanvasVars';
import Shader from './Shader';

export default class CanvasShader extends Shader {
  constructor() {
    super();
  }

  draw({ GL, renderingPass, colorTextures }: CanvasVars) {
    if (this.program && GL && colorTextures) {
      GL.bindFramebuffer(GL.FRAMEBUFFER, null);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      GL.useProgram(this.program);
      GL.bindVertexArray(this.va);
      colorTextures.bindToCanvasShader(GL, this.program);

      GL.uniform1f(GL.getUniformLocation(this.program, 'u_inv_render_pass'), 1.0 / renderingPass);
      GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
  }
}
