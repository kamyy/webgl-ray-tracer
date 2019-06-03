// @flow
import { GL } from '../components/Canvas.js'

export default class NoiseTexture {
    texture: WebGLTexture;

    constructor(wd: number, ht: number) {
        this.texture = GL.createTexture();
        GL.bindTexture(GL.TEXTURE_2D, this.texture);

        const data = new Uint32Array(wd * ht * 4);
        for (let i = 0; i < data.length; ++i) {
            let n = Math.random() * 2147483647;
            while (n < 129) {
                n = Math.random() * 2147483647;
            }
            data[i] = n;
        }

        GL.texImage2D (
            GL.TEXTURE_2D, 
            0, 
            GL.RGBA32UI, 
            wd, 
            ht, 
            0, 
            GL.RGBA_INTEGER, 
            GL.UNSIGNED_INT, 
            data
        );

        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    }

    activate(program: WebGLProgram) {
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D, this.texture);
        GL.uniform1i(
            GL.getUniformLocation(program, 'u_rndSampler'), 
            0
        );
    }
}