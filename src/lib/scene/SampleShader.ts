import Vector1x4 from '../math/Vector1x4';
import { CanvasVars } from '../types/CanvasVars';
import Shader from './Shader';

export default class SampleShader extends Shader {
  private frameBuffer: WebGLFramebuffer | null = null;

  constructor(GL: WebGL2RenderingContext | null) {
    super();

    if (GL) {
      this.frameBuffer = GL.createFramebuffer();
      if (this.frameBuffer) {
        GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
        GL.drawBuffers([GL.COLOR_ATTACHMENT0]);
        GL.bindFramebuffer(GL.FRAMEBUFFER, null);
      }
    }
  }

  draw({
    canvasWd,
    canvasHt,

    cameraFov,
    numBounces,
    shadingMethod,
    renderingPass,

    GL,
    colorTextures,
    randomTexture,
    scene,
  }: CanvasVars) {
    if (this.program && GL && colorTextures && randomTexture && scene?.cameraNode) {
      const origin = new Vector1x4(0.0, 0.0, 0.0); // in view space
      const eyePos = origin.mul(scene.cameraNode.modelMatrix); // in world space

      GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
      // eslint-disable-next-line react-hooks/rules-of-hooks
      GL.useProgram(this.program);
      GL.bindVertexArray(this.va);

      GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_wd'), canvasWd * 0.5);
      GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_ht'), canvasHt * 0.5);
      GL.uniform1i(GL.getUniformLocation(this.program, 'u_num_objects'), scene.objCount);
      GL.uniform1i(GL.getUniformLocation(this.program, 'u_render_pass'), renderingPass);
      GL.uniform1i(GL.getUniformLocation(this.program, 'u_num_bounces'), renderingPass === 1 ? 1 : numBounces);
      GL.uniform1i(GL.getUniformLocation(this.program, 'u_shadingMethod'), shadingMethod);
      GL.uniform1f(
        GL.getUniformLocation(this.program, 'u_eye_to_image'),
        (canvasHt * 0.5) / Math.tan(cameraFov * 0.5 * (Math.PI / 180.0)),
      );
      GL.uniform3f(GL.getUniformLocation(this.program, 'u_eye_position'), eyePos.x, eyePos.y, eyePos.z);
      GL.uniformMatrix4fv(
        GL.getUniformLocation(this.program, 'u_eye_to_world'),
        false,
        scene.cameraNode.modelMatrix.toFloat32Array(),
      );

      scene.bindToSampleShader(GL, this.program);
      colorTextures.bindToSampleShader(GL, this.program);
      randomTexture.bindToSampleShader(GL, this.program);
      GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
  }
}
