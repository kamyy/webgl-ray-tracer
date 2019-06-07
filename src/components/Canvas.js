import React from 'react';

import { 
    connect 
}   from 'react-redux';

import Vector1x4 from '../math/Vector1x4.js';
import RefFrame from '../math/RefFrame.js';

import Shader from '../rendering/Shader.js';

export const canvasWd = 800;
export const canvasHt = 600;
export let GL = null;

const        root = new RefFrame(null);
const        parent = new RefFrame(root);
export const camera = new RefFrame(parent);

class Canvas extends React.Component {
    constructor(props) {
        super(props);

        this.TXYZ_SCALAR = 0.20;
        this.RXYZ_SCALAR = 0.25;
        this.lButtonDown = false;
        this.rButtonDown = false;
        this.lx = 0;
        this.ly = 0;

        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);

        this.shader = null;
    }

    renderScene() {
        if (this.shader.initialized) {
            window.requestAnimationFrame(() => this.shader.drawScene());
        }
    }

    render() {
        return <canvas id='Canvas' width={canvasWd} height={canvasHt}>
            Please use a browser that supports WebGL 2
        </canvas>
    }

    reportGLStats() {
        console.log(`MAX_UNIFORM_BLOCK_SIZE=${GL.getParameter(GL.MAX_UNIFORM_BLOCK_SIZE)}`);
        console.log(`MAX_FRAGMENT_UNIFORM_BLOCKS=${GL.getParameter(GL.MAX_FRAGMENT_UNIFORM_BLOCKS)}`);
        console.log(`MAX_UNIFORM_BUFFER_BINDINGS=${GL.getParameter(GL.MAX_UNIFORM_BUFFER_BINDINGS)}`);
        console.log(`MAX_FRAGMENT_UNIFORM_VECTORS=${GL.getParameter(GL.MAX_FRAGMENT_UNIFORM_VECTORS)}`);
    }

    componentDidMount() {
        this.canvas = document.getElementById('Canvas');

        GL = this.canvas.getContext('webgl2', {
            depth: false,
            alpha: false,
        });

        if (GL) {
            this.reportGLStats();

            this.canvas.oncontextmenu = event => event.preventDefault(); // disable right click context menu
            this.canvas.onmousedown = this.onMouseDown;
            window.onmousemove = this.onMouseMove;
            window.onmouseup = this.onMouseUp;

            this.shader = new Shader(canvasWd, canvasHt);
            this.shader.init().then(() => this.renderScene());
        }
    }

    shouldComponentUpdate() {
        this.renderScene();
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
                camera.translate(new Vector1x4(0, (x - this.lx) * this.TXYZ_SCALAR, 0));
                this.lx = x;
                this.ly = y;
                this.renderScene();

            } else if ((this.lButtonDown && event.ctrlKey) || this.rButtonDown) { // move
                const dx = (this.lx - x) * this.TXYZ_SCALAR;
                const dz = (y - this.ly) * this.TXYZ_SCALAR;
                const dv = camera.mapPos(new Vector1x4(dx, 0, dz, 0), parent);
                parent.translate(dv) // move parent in camera space
                this.lx = x;
                this.ly = y;
                this.renderScene();

            } else if (this.lButtonDown) { // rotate
                parent.rotateZ(this.degreesToRadians(this.lx - x) * this.RXYZ_SCALAR); // yaw camera target around it's own z-axis
                camera.rotateX(this.degreesToRadians(this.ly - y) * this.RXYZ_SCALAR, parent); // pitch around camera's parent x-axis
                this.lx = x;
                this.ly = y;
                this.renderScene();
            }
        }
    }
}

function mapStateToProps(state) {
    return {
        numSamples: state.numSamples,
        numBounces: state.numBounces,
        cameraFov: state.cameraFov,
    };
}

export default connect(mapStateToProps, null)(Canvas);
