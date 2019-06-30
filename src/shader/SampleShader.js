// @flow

import {
    reduxStore
}   from '../redux/reducers.js';

import {
    GL
}   from '../component/Canvas.js';

import ColorTexture from '../texture/ColorTexture.js';
import NoiseTexture from '../texture/NoiseTexture.js';
import SceneTexture from '../texture/SceneTexture.js';
import Matrix4x4 from '../math/Matrix4x4.js'
import Vector1x4 from '../math/Vector1x4.js'
import Shader from './Shader.js';

export default class SampleShader extends Shader {
    colorTexture: ColorTexture;
    noiseTexture: NoiseTexture;
    sceneTexture: SceneTexture;
    wd: number;
    ht: number;
    frameBuffer: WebGLFramebuffer;

    constructor(colorTexture: ColorTexture,
                noiseTexture: NoiseTexture,
                sceneTexture: SceneTexture,
                wd: number,
                ht: number) {
        super();

        this.colorTexture = colorTexture;
        this.noiseTexture = noiseTexture;
        this.sceneTexture = sceneTexture;
        this.wd = wd;
        this.ht = ht;

        this.frameBuffer = GL.createFramebuffer();
        GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
        GL.drawBuffers([ GL.COLOR_ATTACHMENT0 ]);
        GL.bindFramebuffer(GL.FRAMEBUFFER, null);
    }

    draw(renderPass: number, invViewMatrix: Matrix4x4) {
        const {
            numBounces,
            cameraFov,
            shading,
        } = reduxStore.getState();

        const origin = new Vector1x4(0.0, 0.0, 0.0); // in view space
        const eyePos = origin.mul(invViewMatrix); // in world space

        GL.bindFramebuffer(GL.FRAMEBUFFER, this.frameBuffer);
        GL.useProgram(this.program);
        GL.bindVertexArray(this.va);

        GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_wd'), this.wd * 0.5);
        GL.uniform1f(GL.getUniformLocation(this.program, 'u_half_ht'), this.ht * 0.5);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_render_pass'), renderPass);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_num_bounces'), numBounces);
        GL.uniform1i(GL.getUniformLocation(this.program, 'u_shading'), shading);
        GL.uniform1f(GL.getUniformLocation(this.program, 'u_eye_to_image'), (this.ht * 0.5) / (Math.tan(cameraFov * 0.5 * (Math.PI / 180.0))));
        GL.uniform3f(GL.getUniformLocation(this.program, 'u_eye_position'), eyePos.x, eyePos.y, eyePos.z);
        GL.uniformMatrix4fv(GL.getUniformLocation(this.program, 'u_eye_to_world'), false, invViewMatrix.toFloat32Array());

        this.colorTexture.bindToSampleShader(this.program);
        this.noiseTexture.bindToSampleShader(this.program);
        this.sceneTexture.bindToSampleShader(this.program);
        GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}
