import * as React from 'react';

import Shader from './Shader';

/*
import Vector1x4 from './Vector1x4';
import Sphere from './Sphere';
import Ray from './Ray';

import {
    RayIntersectSphereResult,
    rayIntersectSphere
}
from './Intersect';
*/

export let GL = null;

class App extends React.Component {
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

/*
    testSphere() {
        if (x2d) {
            const image = x2d.createImageData(this.props.wd, this.props.ht);

            const halfWd = this.props.wd * 0.5;
            const halfHt = this.props.ht * 0.5;
            const x = -halfWd;
            const y = +halfHt / Math.tan(45 * Math.PI / 180);
            const z = +halfHt;

            const org = new Vector1x4();
            const dir = new Vector1x4(x, y, z);
            const ray = new Ray(org, dir);

            const sphere = new Sphere(new Vector1x4(-50, 100, 0), 30);

            let k = 0;

            for (let i = 0; i < this.props.ht; ++i) { // top to bottom
                for (let j = 0; j < this.props.wd; ++j) { // left to right

                    let r = 0;

                    for (let n = 0; n < 100; ++n) {
                        dir.x = x + j + Math.random();
                        dir.z = z - i - Math.random();
                        if (rayIntersectSphere(ray, sphere)) {
                            r += 128;
                        }
                    }

                    image.data[k++] = r / 100;
                    image.data[k++] = 0;
                    image.data[k++] = 0;
                    image.data[k++] = 255;
                }
            }

            x2d.putImageData(image, 0, 0);
        }
    }
    */

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

            const shader = new Shader();
            shader.init().then(ok => {
                if (ok) {
                    shader.drawScene();
                }
            });

            // this.testSphere();

            //GL.clearColor(0.392156899, 0.584313750, 0.929411829, 1.0); // cornflower blue
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
