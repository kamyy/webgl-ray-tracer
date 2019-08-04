import ColorTextures from '../texture/ColorTextures';
import Shader from './Shader';

export default class CanvasShader extends Shader {
    colorTextures: ColorTextures;

    constructor(colorTextures: ColorTextures) {
        super();
        this.colorTextures = colorTextures;
    }

    draw(GL: WebGL2RenderingContext, renderPass: number) {
        if (this.va && this.program) {
            GL.bindFramebuffer(GL.FRAMEBUFFER, null);
            GL.useProgram(this.program);
            GL.bindVertexArray(this.va);
            this.colorTextures.bindToCanvasShader(GL, this.program);

            GL.uniform1f(GL.getUniformLocation(this.program, 'u_inv_render_pass'), 1.0 / renderPass);

            GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
        }
    }
}
