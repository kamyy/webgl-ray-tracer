// @flow

export default class NoiseTexture {
    texture: WebGLTexture;

    constructor(GL: WebGL2RenderingContext, program: WebGLProgram, wd: number, ht: number) {
        this.texture = GL.createTexture();

        const data = new Uint32Array(wd * ht * 4);
        for (let i = 0; i < data.length; ++i) {
            let n = Math.random() * 4294967295;
            while (n < 129) {
                n = Math.random() * 4294967295;
            }
            data[i] = n;
        }

        GL.bindTexture(GL.TEXTURE_2D, this.texture);
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

        GL.activeTexture(GL.TEXTURE0);
        GL.uniform1i(
            GL.getUniformLocation(program, 'u_rndSampler'), 
            0
        );
    }
}