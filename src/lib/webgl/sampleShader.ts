import { CanvasVars } from '../../types/canvasVars'
import Vector1x4 from '../math/vector1x4'
import Shader from './shader'

export default class SampleShader extends Shader {
  private frameBuffer: WebGLFramebuffer | null = null

  constructor(gl: WebGL2RenderingContext | null) {
    super()

    if (gl) {
      this.frameBuffer = gl.createFramebuffer()
      if (this.frameBuffer) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer)
        gl.drawBuffers([gl.COLOR_ATTACHMENT0])
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
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

    gl,
    colorTextures,
    randomTexture,
    scene,
  }: CanvasVars) {
    if (this.pgm && gl && colorTextures && randomTexture && scene?.cameraNode) {
      const origin = new Vector1x4(0.0, 0.0, 0.0) // in view space
      const eyePos = origin.mul(scene.cameraNode.modelMatrix) // in world space

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer)
      // eslint-disable-next-line react-hooks/rules-of-hooks
      gl.useProgram(this.pgm)
      gl.bindVertexArray(this.vao)

      gl.uniform1f(gl.getUniformLocation(this.pgm, 'u_half_wd'), canvasWd * 0.5)
      gl.uniform1f(gl.getUniformLocation(this.pgm, 'u_half_ht'), canvasHt * 0.5)
      gl.uniform1i(gl.getUniformLocation(this.pgm, 'u_num_objects'), scene.objCount)
      gl.uniform1i(gl.getUniformLocation(this.pgm, 'u_render_pass'), renderingPass)
      gl.uniform1i(gl.getUniformLocation(this.pgm, 'u_num_bounces'), renderingPass === 1 ? 1 : numBounces)
      gl.uniform1i(gl.getUniformLocation(this.pgm, 'u_shadingMethod'), shadingMethod)
      gl.uniform1f(
        gl.getUniformLocation(this.pgm, 'u_eye_to_image'),
        (canvasHt * 0.5) / Math.tan(cameraFov * 0.5 * (Math.PI / 180.0)),
      )
      gl.uniform3f(gl.getUniformLocation(this.pgm, 'u_eye_position'), eyePos.x, eyePos.y, eyePos.z)
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.pgm, 'u_eye_to_world'),
        false,
        scene.cameraNode.modelMatrix.toFloat32Array(),
      )

      scene.bindToSampleShader(gl, this.pgm)
      colorTextures.bindToSampleShader(gl, this.pgm)
      randomTexture.bindToSampleShader(gl, this.pgm)
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    }
  }
}
