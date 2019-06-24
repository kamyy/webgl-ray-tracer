// @flow

import {
    GL
}   from '../component/Canvas.js';

import ColorCache from '../cache/ColorCache.js';
import Shader from './Shader.js';

export default class CanvasShader extends Shader {
    draw(renderPass: number, colorCache: ColorCache) {
        GL.bindFramebuffer(GL.FRAMEBUFFER, null);
        GL.useProgram(this.program);
        GL.bindVertexArray(this.va);

        GL.uniform1f(GL.getUniformLocation(this.program, 'u_inv_render_pass'), 1.0 / renderPass);

        colorCache.bindToCanvasShader(GL, this.program); 
        GL.drawArrays(GL.TRIANGLE_FAN, 0, 4);
    }
}
