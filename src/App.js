import React, { Component } from 'react';

export let x2d = null;

class App extends Component {
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

    clearImage() {
        if (x2d) {
            const image = x2d.createImageData(this.props.wd, this.props.ht);
            const dy = 255 / this.props.ht;
            const dx = 255 / this.props.wd;

            let i = 0;
            let g = 255;
            for (let y = 0; y < this.props.ht; ++y) {

                let r = 0;
                for (let x = 0; x < this.props.wd; ++x) {
                    image.data[i++] = r;
                    image.data[i++] = g;
                    image.data[i++] = 0;
                    image.data[i++] = 255;
                    r += dx;
                }
                g -= dy;
            }
            x2d.putImageData(image, 0, 0);
        }
    }

    componentDidMount() {
        this.canvas = document.getElementById('Canvas');
        x2d = this.canvas.getContext('2d');

        if (x2d) {
            this.canvas.oncontextmenu = event => event.preventDefault(); // disable right click context menu
            this.canvas.onmousedown = this.onMouseDown;
            window.onmousemove = this.onMouseMove;
            window.onmouseup = this.onMouseUp;

            this.clearImage();

            //x2d.getSupportedExtensions().forEach(item => console.log(item));
            //GL.clearColor(0.392156899, 0.584313750, 0.929411829, 1.0); // cornflower blue
            //GL.clearDepth(1.0); // depth buffer clear value
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

export default App;
