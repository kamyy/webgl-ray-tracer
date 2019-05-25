import React from 'react';
import Canvas from './Canvas.js';
import Params from './Params.js';
import {
    canvasWd,
}   from './Canvas.js';

export default function App(props) {
    const appStyle = {
        fontFamily: 'sans-serif',
        backgroundColor: '#f5f5f5',
        position: 'relative',
        padding: 16,
        width: canvasWd + 4,
        margin: 'auto',
    }

    const projectInfoStyle = {
        margin: 6,
        fontSize: 14,
        textAlign: 'center',
    }

    return <div style={appStyle}>
        <Canvas/>
        <hr/>
        <Params/>
        <p style={projectInfoStyle}>MIT License</p>
        <p style={projectInfoStyle}><a href='https://github.com/kamyy/webgl-ray-tracer'>Project @ GitHub</a></p>
        <p style={projectInfoStyle}>Copyright &copy; 2019 <a href='mailto:kam.yin.yip@gmail.com'>Kam Y Yip</a></p>
    </div>
}