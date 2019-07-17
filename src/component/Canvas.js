// @flow

import React from 'react';

import {
    bindActionCreators
}   from 'redux';

import {
    connect
}   from 'react-redux';

import {
    setRenderingPass,
    setElapsedTime,
    setEtaTime,
    setAvgTime,
}   from '../redux/actions.js';

import Vector1x4 from '../math/Vector1x4.js';
import RefFrame from '../math/RefFrame.js';

import SceneTextures from '../texture/SceneTextures.js';
import ColorTextures from '../texture/ColorTextures.js';
import RandomTexture from '../texture/RandomTexture.js';
import SampleShader from '../shader/SampleShader.js';
import CanvasShader from '../shader/CanvasShader.js';

import {
    reduxStore
}   from '../redux/reducers.js';

export const canvasWd = 1280;
export const canvasHt = 720;

export const rootNode = new RefFrame();
export const parentNode = new RefFrame(rootNode);
export const cameraNode = new RefFrame(parentNode);
cameraNode.translate(new Vector1x4(0.0, -15.0, 2.5));

type Props = {
    numSamples: number,
    numBounces: number,
    cameraFov:  number,
    shadingMethod: number,

    setRenderingPass: (a: number) => void,
    setElapsedTime: (a: string) => void,
    setEtaTime: (a: string) => void,
    setAvgTime: (a: string) => void,
};

class Canvas extends React.Component<Props> {
    lx: number;
    ly: number;
    TXYZ_SCALAR: number;
    RXYZ_SCALAR: number;
    lButtonDown: boolean;
    rButtonDown: boolean;

    restartRenderTimestamp: number;
    bRendering: boolean;

    canvas: any;
    GL:     any;

    sceneTextures: SceneTextures;
    colorTextures: ColorTextures;
    randomTexture: RandomTexture;
    sampleShader: SampleShader;
    canvasShader: CanvasShader;

    constructor(props) {
        super(props);

        this.lx = 0;
        this.ly = 0;
        this.TXYZ_SCALAR = 0.01;
        this.RXYZ_SCALAR = 0.25;
        this.lButtonDown = false;
        this.rButtonDown = false;

        this.bRendering = false;
    }

    render() {
        return <canvas id='Canvas' width={canvasWd} height={canvasHt} style={{ borderStyle: 'ridge', borderWidth: 'medium'}}>
            Please use a GPU and browser that supports WebGL 2
        </canvas>
    }

    refreshTimers() {
        const renderPass = reduxStore.getState().renderingPass;
        const numSamples = reduxStore.getState().numSamples;

        if (renderPass > 1) {
            const durationMs = Date.now() - this.restartRenderTimestamp;
            const avg = (durationMs / renderPass);
            const eta = (numSamples - renderPass) * avg;

            this.props.setElapsedTime(new Date(durationMs).toISOString().substr(11, 8));
            this.props.setEtaTime(new Date(eta).toISOString().substr(11, 8));
            this.props.setAvgTime(avg.toFixed(0) + 'ms');
        }
    }

    restartTimers() {
        this.restartRenderTimestamp = Date.now();
        this.props.setElapsedTime('00:00:00');
        this.props.setEtaTime('??:??:??');
        this.props.setAvgTime('????');
    }

    restartRender() {
        if (this.GL) {
            this.props.setRenderingPass(0);
            this.restartTimers();
            if(!this.bRendering) {
                this.bRendering = true;
                this.executeRenderingPass();
            }
        }
    }

    executeRenderingPass() {
        requestAnimationFrame(() => {
            let renderPass = reduxStore.getState().renderingPass;
            let numSamples = reduxStore.getState().numSamples;

            if (renderPass < numSamples) {
                if (renderPass === 0 || (!this.lButtonDown && !this.rButtonDown)) { // render 1st pass only if still moving camera around
                    renderPass ++;
                    this.sampleShader.draw(this.GL, renderPass, cameraNode.modelMatrix);
                    this.canvasShader.draw(this.GL, renderPass);
                    this.props.setRenderingPass(renderPass);
                }
                this.executeRenderingPass();
                this.refreshTimers();
            } else {
                this.bRendering = false;
            }
        });
    }

    log_GPU_Caps() {
        console.log(`MAX_ARRAY_TEXTURE_LAYERS = ${this.GL.getParameter(this.GL.MAX_ARRAY_TEXTURE_LAYERS)}`);
        console.log(`MAX_TEXTURE_IMAGE_UNITS = ${this.GL.getParameter(this.GL.MAX_TEXTURE_IMAGE_UNITS)}`);
        console.log(`MAX_RENDERBUFFER_SIZE = ${this.GL.getParameter(this.GL.MAX_RENDERBUFFER_SIZE)}`);
        console.log(`MAX_TEXTURE_SIZE = ${this.GL.getParameter(this.GL.MAX_TEXTURE_SIZE)}`);
    }

    componentDidMount() {
        this.canvas = document.getElementById('Canvas');
        if (this.canvas instanceof HTMLCanvasElement) {
            this.GL = this.canvas.getContext('webgl2', {
                depth: false,
                alpha: false,
            });

            if (this.GL instanceof WebGL2RenderingContext) {
                if (this.GL.getExtension('EXT_color_buffer_float')) {
                    this.log_GPU_Caps();

                    this.canvas.oncontextmenu = event => event.preventDefault(); // disable right click context menu
                    this.canvas.onmousedown = e => this.onMouseDown(e);
                    window.onmousemove = e => this.onMouseMove(e);
                    window.onmouseup = e => this.onMouseUp(e);

                    this.sceneTextures = new SceneTextures(this.GL, '/suzanne.obj', '/suzanne.mtl');
                    this.colorTextures = new ColorTextures(this.GL, canvasWd, canvasHt);
                    this.randomTexture = new RandomTexture(this.GL, canvasWd, canvasHt);
                    this.sampleShader = new SampleShader(this.GL, this.sceneTextures,
                                                        this.colorTextures,
                                                        this.randomTexture,
                                                        canvasWd,
                                                        canvasHt);
                    this.canvasShader = new CanvasShader(this.colorTextures);

                    this.sceneTextures.init(this.GL)
                        .then(() => this.sampleShader.init(this.GL, '/sample-vs.glsl', '/sample-fs.glsl'))
                        .then(() => this.canvasShader.init(this.GL, '/canvas-vs.glsl', '/canvas-fs.glsl'))
                        .then(() => this.restartRender());

                    return;
                }
            }
            this.GL = null;
        }
    }

    shouldComponentUpdate() {
        this.restartRender();
        return false;
    }

    degreesToRadians(degrees) {
        return degrees * Math.PI / 180.0;
    }

    onMouseUp(event) {
        switch (event.button) {
        case 0: this.lButtonDown = false; break;
        case 2: this.rButtonDown = false; break;
        default: break;
        }
    }

    onMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;

        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
            switch (event.button) {
            case 0: this.lButtonDown = true; break;
            case 2: this.rButtonDown = true; break;
            default: break;
            }
            this.lx = x;
            this.ly = y;
        }
    }

    onMouseMove(event) {
        if (this.lButtonDown ||
            this.rButtonDown) {

            const x = event.clientX;
            const y = event.clientY;

            if ((this.lButtonDown && this.rButtonDown) || (this.lButtonDown && event.shiftKey)) { // dolly
                if (x !== this.lx) {
                    cameraNode.translate(new Vector1x4(0, (x - this.lx) * this.TXYZ_SCALAR, 0));
                    this.lx = x;
                    this.ly = y;
                    this.restartRender();
                }
            } else if ((this.lButtonDown && event.ctrlKey) || this.rButtonDown) { // move
                if (x !== this.lx || y !== this.ly) {
                    const dx = (this.lx - x) * this.TXYZ_SCALAR;
                    const dz = (y - this.ly) * this.TXYZ_SCALAR;
                    const dv = cameraNode.mapPos(new Vector1x4(dx, 0, dz, 0), parentNode);
                    parentNode.translate(dv) // move parent in camera space
                    this.lx = x;
                    this.ly = y;
                    this.restartRender();
                }
            } else if (this.lButtonDown) { // rotate
                if (x !== this.lx || y !== this.ly) {
                    parentNode.rotateZ(this.degreesToRadians(this.lx - x) * this.RXYZ_SCALAR); // yaw camera target around it's own z-axis
                    cameraNode.rotateX(this.degreesToRadians(this.ly - y) * this.RXYZ_SCALAR, parentNode); // pitch around camera's parent x-axis
                    this.lx = x;
                    this.ly = y;
                    this.restartRender();
                }
            }
        }
    }
}

function mapStateToProps(state) {
    const props = {
        numSamples: state.numSamples,
        numBounces: state.numBounces,
        cameraFov:  state.cameraFov,
        shadingMethod: state.shadingMethod,
    };
    return props;
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({
        setRenderingPass,
        setElapsedTime,
        setEtaTime,
        setAvgTime,
    }, dispatch);
}

// triggers Canvas.shouldComponentUpdate() when redux state changes
export default connect(mapStateToProps, mapDispatchToProps)(Canvas);
