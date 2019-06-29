// @flow

import {
    GL
}   from '../component/Canvas.js';

import ColorTexture from '../texture/ColorTexture.js';
import Shader from './Shader.js';

export default class CanvasShader extends Shader {
    colorTexture: ColorTexture;

    constructor(colorTexture: ColorTexture) {
        super();
        this.colorTexture = colorTexture;
    }

    draw(renderPass: number) {
        GL.bindFramebuffer(GL.FRAMEBUFFER, null);
        GL.useProgram(this.program);
        GL.bindVertexArray(this.va);
        this.colorTexture.bindToCanvasShader(this.program);

        GL.uniform1f(GL.getUniformLocation(this.program, 'u_inv_render_pass'), 1.0 / renderPass);

        GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}
