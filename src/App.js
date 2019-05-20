import React, { Component } from 'react';
import { connect } from 'react-redux';
import Shader from './Shader';

export let GL = null;

export default class App extends Component {
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

        this.rootNode = null;
        this.state = {};
    }

    render() {
        const appStyle = {
            fontFamily: 'sans-serif',
            backgroundColor: '#f5f5f5',
            position: 'relative',
            padding: 16,
            width: this.props.wd + 4,
            margin: 'auto',
        }

        const projectInfoStyle = {
            margin: 6,
            fontSize: 14,
            textAlign: 'center',
        }

        return <div style={appStyle}>
            <canvas id='Canvas' width={this.props.wd} height={this.props.ht}>Please use a browser that supports WebGL 2</canvas>
            <hr/>
            <p style={projectInfoStyle}>MIT License</p>
            <p style={projectInfoStyle}><a href='https://github.com/kamyy/webgl-ray-tracer'>Project @ GitHub</a></p>
            <p style={projectInfoStyle}>Copyright &copy; 2019 <a href='mailto:kam.yin.yip@gmail.com'>Kam Y Yip</a></p>
        </div>
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

            const shader = new Shader(this.props.wd / 2, this.props.ht / 2);
            shader.init().then(ok => {
                if (ok) {
                    shader.drawScene();
                }
            });
        }
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