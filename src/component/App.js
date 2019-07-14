import React from 'react';
import Canvas from './Canvas.js';
import TPages from './TPages.js';

import {
    canvasWd,
}   from './Canvas.js';

export default function App(props) {
    const appStyle = {
        fontFamily: 'Arial',
        backgroundColor: '#f5f5f5',
        position: 'relative',
        padding: 16,
        width: canvasWd + 4,
        margin: 'auto',
    }

    return <div style={appStyle}>
        <Canvas/>
        <TPages/>
    </div>
}
