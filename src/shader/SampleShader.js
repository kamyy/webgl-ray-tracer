import {
  reduxStore,
} from '../redux/reducers.js';

import Scene from '../texture/Scene.js';
import ColorTextures from '../texture/ColorTextures.js';
import RandomTexture from '../texture/RandomTexture.js';
import Matrix4x4 from '../math/Matrix4x4.js';
import Vector1x4 from '../math/Vector1x4.js';
import Shader from './Shader.js';

export default class SampleShader extends Shader {
    colorTextures: ColorTextures;

    randomTexture: RandomTexture;

    wd: number;

    ht: number;

    frameBuffer: WebGLFramebuffer;

    constructor(GL: any,
      colorTextures: ColorTextures,
      randomTexture: RandomTexture,
      wd: number,
      ht: number) {
      super();

      this.colorTextures = colorTextures;
      this.randomTexture = randomTexture;
      this.wd = wd;
      this.ht = ht;

      this.frameBuffer = GL.createFramebuffer();
      GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
      GL.drawBuffers([GL.COLOR_ATTACHMENT0]);
      GL.bindFramebuffer(GL.FRAMEBUFFER, null);
    }

    draw(GL: any, scene: Scene, renderPass: number, invViewMatrix: Matrix4x4) {
      const {
        numBounces,
        cameraFov,
        shadingMethod,
      } = reduxStore.getState();

      const origin = new Vector1x4(0.0, 0.0, 0.0); // in view space
      const eyePos = origin.mul(invViewMatrix); // in world space

      GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
      GL.useProgram(this.program);
      GL.bindVertexArray(this.va);

      GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_wd'), this.wd * 0.5);
      GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_ht'), this.ht * 0.5);
      GL.uniform1i(GL.getUniformLocation(this.program, 'u_num_objects'), scene.objCount);
      GL.uniform1i(GL.getUniformLocation(this.program, 'u_render_pass'), renderPass);
      GL.uniform1i(GL.getUniformLocation(this.program, 'u_num_bounces'), renderPass === 1 ? 1 : numBounces);
      GL.uniform1i(GL.getUniformLocation(this.program, 'u_shadingMethod'), shadingMethod);
      GL.uniform1f(GL.getUniformLocation(this.program, 'u_eye_to_image'), (this.ht * 0.5) / (Math.tan(cameraFov * 0.5 * (Math.PI / 180.0))));
      GL.uniform3f(GL.getUniformLocation(this.program, 'u_eye_position'), eyePos.x, eyePos.y, eyePos.z);
      GL.uniformMatrix4fv(GL.getUniformLocation(this.program, 'u_eye_to_world'), false, invViewMatrix.toFloat32Array());

      scene.bindToSampleShader(GL, this.program);
      this.colorTextures.bindToSampleShader(GL, this.program);
      this.randomTexture.bindToSampleShader(GL, this.program);
      GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}
