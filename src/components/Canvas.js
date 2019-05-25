import React from 'react';
import { 
    connect 
}   from 'react-redux';

import Shader from '../Shader';

export const canvasWd = 800;
export const canvasHt = 600;
export let GL = null;

class Canvas extends React.Component {
    constructor(props) {
        super(props);

        this.TXYZ_SCALAR = 0.01;
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

    componentDidMount() {
        this.canvas = document.getElementById('Canvas');

        GL = this.canvas.getContext('webgl2', {
            depth: false,
            alpha: false,
        });

        if (GL) {
            this.canvas.oncontextmenu = event => event.preventDefault(); // disable right click context menu
            this.canvas.onmousedown = this.onMouseDown;
            window.onmousemove = this.onMouseMove;
            window.onmouseup = this.onMouseUp;

            this.shader = new Shader(canvasWd * 0.5, canvasHt * 0.5);
            this.shader.init().then(() => this.renderScene());
        }
    }

    shouldComponentUpdate() {
        this.renderScene();
        return false;
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
        if (this.lButtonDown || this.rButtonDown) {
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
